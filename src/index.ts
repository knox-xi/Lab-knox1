/* SupportDesk — Acme Support Customer Support Portal
 * Cloudflare Workers + D1. Real auth (PBKDF2 + HttpOnly sessions),
 * real tickets/invoices, real PDF generation.
 */

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface PublicUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

// ---------- small helpers ----------

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const h = req.headers.get("Cookie");
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

const SESSION_COOKIE = "sd_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function newSessionId(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function sessionCookieHeader(sessionId: string, req: Request, maxAgeSec: number): string {
  const url = new URL(req.url);
  const secure = url.protocol === "https:";
  let c = `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
  if (secure) c += "; Secure";
  return c;
}

function clearedCookieHeader(req: Request): string {
  const url = new URL(req.url);
  const secure = url.protocol === "https:";
  let c = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (secure) c += "; Secure";
  return c;
}

// ---------- password hashing (PBKDF2-SHA256, WebCrypto) ----------

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as Uint8Array<ArrayBuffer>, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$100000$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < 10000) return false;
    const salt = b64ToBytes(parts[2]);
    const expected = b64ToBytes(parts[3]);
    const enc = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as unknown as Uint8Array<ArrayBuffer>, iterations, hash: "SHA-256" },
      key,
      expected.length * 8
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// ---------- auth ----------

async function getSessionUser(req: Request, env: Env): Promise<PublicUser | null> {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  if (!sid || !/^[a-f0-9]{32,128}$/i.test(sid)) return null;
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  )
    .bind(sid)
    .first<{ id: number; name: string; email: string; created_at: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run().catch(() => {});
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
}

async function createSession(env: Env, userId: number): Promise<{ id: string; expiresAt: number }> {
  const id = newSessionId();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(id, userId, expiresAt)
    .run();
  return { id, expiresAt };
}

// ---------- validation ----------

const CATEGORIES = ["Technical", "Billing", "Account", "Feature", "General"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------- pricing (real business logic) ----------

function priceForTicket(category: string, priority: string): { amount_cents: number; items: { description: string; qty: number; unit_cents: number }[] } {
  const baseMap: Record<string, number> = {
    Technical: 14900,
    Billing: 4900,
    Account: 7900,
    Feature: 9900,
    General: 5900,
  };
  const base = baseMap[category] ?? 5900;
  const feeMap: Record<string, number> = { Low: 0, Medium: 2000, High: 4000, Urgent: 8000 };
  const fee = feeMap[priority] ?? 0;
  const items = [{ description: `${category} Support - Ticket Resolution`, qty: 1, unit_cents: base }];
  if (fee > 0) items.push({ description: `${priority} Priority Handling Fee`, qty: 1, unit_cents: fee });
  return { amount_cents: base + fee, items };
}

// ---------- PDF helpers (real downloadable PDF, no dependencies) ----------

function pdfEscape(s: string): string {
  // Helvetica WinAnsi: keep printable ASCII only, escape PDF delimiters.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .split("")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c < 32 || c > 126) return "?";
      return ch;
    })
    .join("");
}

// Intentionally obfuscated so the literal flag never appears in source/seed/frontend.
// Only the generated PDF bytes for invoice id=1 contain the assembled value.
function internalReference(invoiceId: number, invoiceNumber: string): string {
  if (invoiceId === 1) {
    const a = "inv01ce_id0r";
    const b = "_acme_7f3a9c1e";
    const open = "SD" + "C{";
    const close = "}";
    return open + a + b + close;
  }
  return "ACME-" + invoiceNumber;
}

interface PdfInvoiceInput {
  id: number;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: string;
  billing_name: string;
  billing_email: string;
  items_json: string;
  created_at: string;
  due_date: string;
  ticket_id: number;
  ticket_subject: string;
  ticket_category: string;
  ticket_priority: string;
}

function generateInvoicePdf(inv: PdfInvoiceInput): Uint8Array {
  let items: { description: string; qty: number; unit_cents: number }[] = [];
  try {
    const p = JSON.parse(inv.items_json);
    if (Array.isArray(p)) items = p;
  } catch {
    items = [];
  }

  const lines: { text: string; size: number; gap: number }[] = [];
  const T = (text: string, size = 11, gap = 16) => lines.push({ text, size, gap });

  T("Acme Support - Customer Support Portal", 16, 22);
  T("support@acme.support | +966 11 234 5678 | Riyadh, Saudi Arabia", 9, 14);
  T("------------------------------------------------------------", 9, 14);
  T(`INVOICE ${inv.invoice_number}`, 14, 20);
  T(`Issue date: ${inv.created_at.slice(0, 10)}    Due date: ${inv.due_date.slice(0, 10)}    Status: ${inv.status}`, 10, 15);
  T(`Billed to: ${inv.billing_name} <${inv.billing_email}>`, 11, 16);
  T(`Related ticket #${inv.ticket_id}: ${inv.ticket_subject}`, 10, 15);
  T(`Category: ${inv.ticket_category}    Priority: ${inv.ticket_priority}`, 10, 18);
  T("Line items:", 11, 16);
  if (items.length === 0) {
    T(`  Support service  1 x ${money(inv.amount_cents)} = ${money(inv.amount_cents)}`, 10, 14);
  } else {
    for (const it of items) {
      const total = it.qty * it.unit_cents;
      T(`  ${it.description}  ${it.qty} x ${money(it.unit_cents)} = ${money(total)}`, 10, 14);
    }
  }
  T(`TOTAL DUE (${inv.currency}): ${money(inv.amount_cents)}`, 12, 20);
  T(`Internal Reference: ${internalReference(inv.id, inv.invoice_number)}`, 9, 14);
  T("Thank you for choosing Acme Support. Payment due within 14 days.", 9, 14);
  T("Commercial Registration 1010-XXXXXX | VAT 3000-XXXXXX", 8, 12);

  // Build content stream
  let y = 800;
  let stream = "";
  for (const l of lines) {
    if (y < 50) break; // single page is enough for workshop invoices
    stream += `BT /F1 ${l.size} Tf 50 ${y} Td (${pdfEscape(l.text).slice(0, 160)}) Tj ET\n`;
    y -= l.gap;
  }

  const enc = new TextEncoder();
  const contentBytes = enc.encode(stream);

  const objs: string[] = [];
  objs[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objs[2] = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  objs[3] =
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
    `/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  objs[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const obj5Head = `5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`;
  const obj5Tail = `\nendstream\nendobj\n`;

  const header = `%PDF-1.4\n`;
  // compute offsets (all ASCII so string length === byte length, except content stream)
  let offset = enc.encode(header).length;
  const offsets: number[] = [0];
  for (let i = 1; i <= 4; i++) {
    offsets[i] = offset;
    offset += enc.encode(objs[i]).length;
  }
  offsets[5] = offset;
  offset += enc.encode(obj5Head).length + contentBytes.length + enc.encode(obj5Tail).length;

  const xrefPos = offset;
  const n = 6;
  let xref = `xref\n0 ${n}\n`;
  xref += `0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const trailer =
    `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const parts: Uint8Array[] = [
    enc.encode(header),
    enc.encode(objs[1]),
    enc.encode(objs[2]),
    enc.encode(objs[3]),
    enc.encode(objs[4]),
    enc.encode(obj5Head),
    contentBytes,
    enc.encode(obj5Tail),
    enc.encode(xref),
    enc.encode(trailer),
  ];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ---------- router ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // ----- API -----
      if (path.startsWith("/api/")) {
        return await handleApi(request, env, path, method);
      }

      // ----- static frontend (Workers Assets) -----
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
      return new Response("SupportDesk API. Frontend assets not configured.", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (e) {
      console.error("unhandled", e);
      if (path.startsWith("/api/")) return json({ error: "Internal server error" }, 500);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

async function handleApi(request: Request, env: Env, path: string, method: string): Promise<Response> {
  // Auth
  if (path === "/api/register" && method === "POST") return handleRegister(request, env);
  if (path === "/api/login" && method === "POST") return handleLogin(request, env);
  if (path === "/api/logout" && method === "POST") return handleLogout(request, env);
  if (path === "/api/me" && method === "GET") {
    const u = await getSessionUser(request, env);
    if (!u) return json({ error: "Not authenticated" }, 401);
    return json({ user: u });
  }

  // Tickets
  if (path === "/api/tickets" && method === "GET") return handleListTickets(request, env);
  if (path === "/api/tickets" && method === "POST") return handleCreateTicket(request, env);
  {
    const m = path.match(/^\/api\/tickets\/(\d+)$/);
    if (m && method === "GET") return handleGetTicket(request, env, parseInt(m[1], 10));
  }

  // Invoices
  if (path === "/api/invoices" && method === "GET") return handleListInvoices(request, env);
  if (path === "/api/invoices" && method === "POST") return handleCreateInvoice(request, env);
  {
    const m = path.match(/^\/api\/invoices\/(\d+)$/);
    if (m && method === "GET") return handleGetInvoice(request, env, parseInt(m[1], 10));
  }
  {
    const m = path.match(/^\/api\/invoices\/(\d+)\/download$/);
    if (m && method === "GET") return handleDownloadInvoice(request, env, parseInt(m[1], 10));
  }

  return json({ error: "Not found" }, 404);
}

// ----- handlers -----

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const t = await req.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (name.length < 2 || name.length > 80) return json({ error: "Name must be 2-80 characters" }, 400);
  if (!isEmail(email)) return json({ error: "Invalid email address" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Password must be at least 8 characters" }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (existing) return json({ error: "Email already registered" }, 409);

  const password_hash = await hashPassword(password);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(`INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)`)
    .bind(name, email, password_hash, now)
    .run();
  const userId = Number(res.meta.last_row_id);
  const sess = await createSession(env, userId);
  const user: PublicUser = { id: userId, name, email, created_at: now };
  return json(
    { user },
    201,
    { "Set-Cookie": sessionCookieHeader(sess.id, request, SESSION_TTL_MS / 1000) }
  );
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!isEmail(email) || !password) return json({ error: "Invalid email or password" }, 400);

  const row = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first<UserRow>();
  // Generic error to avoid user enumeration; still constant-ish work.
  if (!row) return json({ error: "Invalid email or password" }, 401);
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return json({ error: "Invalid email or password" }, 401);

  const sess = await createSession(env, row.id);
  const user: PublicUser = { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
  return json(
    { user },
    200,
    { "Set-Cookie": sessionCookieHeader(sess.id, request, SESSION_TTL_MS / 1000) }
  );
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookies(request);
  const sid = cookies[SESSION_COOKIE];
  if (sid) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run().catch(() => {});
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookieHeader(request) });
}

async function handleListTickets(request: Request, env: Env): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  const { results } = await env.DB.prepare(`SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC`)
    .bind(u.id)
    .all();
  return json({ tickets: results ?? [] });
}

async function handleCreateTicket(request: Request, env: Env): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const subject = String(body.subject ?? "").trim();
  const category = String(body.category ?? "").trim();
  const priority = String(body.priority ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (subject.length < 5 || subject.length > 120) return json({ error: "Subject must be 5-120 characters" }, 400);
  if (!(CATEGORIES as readonly string[]).includes(category)) return json({ error: "Invalid category" }, 400);
  if (!(PRIORITIES as readonly string[]).includes(priority)) return json({ error: "Invalid priority" }, 400);
  if (message.length < 10 || message.length > 5000) return json({ error: "Message must be 10-5000 characters" }, 400);

  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO tickets (user_id, subject, category, priority, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  )
    .bind(u.id, subject, category, priority, message, now)
    .run();
  const id = Number(res.meta.last_row_id);
  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  return json({ ticket }, 201);
}

async function handleGetTicket(request: Request, env: Env, id: number): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid ticket id" }, 400);
  // SECURE: ownership enforced.
  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ? AND user_id = ?`)
    .bind(id, u.id)
    .first();
  if (!ticket) return json({ error: "Ticket not found" }, 404);
  return json({ ticket });
}

async function handleListInvoices(request: Request, env: Env): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  const { results } = await env.DB.prepare(
    `SELECT i.*, t.subject AS ticket_subject
     FROM invoices i LEFT JOIN tickets t ON t.id = i.ticket_id
     WHERE i.user_id = ? ORDER BY i.id DESC`
  )
    .bind(u.id)
    .all();
  return json({ invoices: results ?? [] });
}

async function handleCreateInvoice(request: Request, env: Env): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const ticketId = Number(body.ticket_id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) return json({ error: "Invalid ticket_id" }, 400);

  // SECURE: verify the ticket belongs to the caller before invoicing.
  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ? AND user_id = ?`)
    .bind(ticketId, u.id)
    .first<{ id: number; subject: string; category: string; priority: string }>();
  if (!ticket) return json({ error: "Ticket not found" }, 404);

  const existing = await env.DB.prepare(`SELECT * FROM invoices WHERE ticket_id = ? AND user_id = ?`)
    .bind(ticketId, u.id)
    .first();
  if (existing) return json({ invoice: existing });

  const { amount_cents, items } = priceForTicket(ticket.category, ticket.priority);
  const maxRow = await env.DB.prepare(`SELECT MAX(id) AS m FROM invoices`).first<{ m: number | null }>();
  const nextId = (maxRow?.m ?? 0) + 1;
  const invoice_number = `INV-2026-${String(nextId).padStart(4, "0")}`;
  const now = new Date();
  const created_at = now.toISOString();
  const due_date = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await env.DB.prepare(
      `INSERT INTO invoices (user_id, ticket_id, invoice_number, amount_cents, currency, status, billing_name, billing_email, items_json, created_at, due_date)
       VALUES (?, ?, ?, ?, 'USD', 'unpaid', ?, ?, ?, ?, ?)`
    )
      .bind(u.id, ticketId, invoice_number, amount_cents, u.name, u.email, JSON.stringify(items), created_at, due_date)
      .run();
    const id = Number(res.meta.last_row_id);
    const invoice = await env.DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first();
    return json({ invoice }, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return json({ error: "Invoice already exists for this ticket" }, 409);
    throw e;
  }
}

async function handleGetInvoice(request: Request, env: Env, id: number): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid invoice id" }, 400);
  // SECURE: ownership enforced here. The JSON detail endpoint is NOT vulnerable.
  const invoice = await env.DB.prepare(`SELECT * FROM invoices WHERE id = ? AND user_id = ?`)
    .bind(id, u.id)
    .first();
  if (!invoice) return json({ error: "Invoice not found" }, 404);
  return json({ invoice });
}

async function handleDownloadInvoice(request: Request, env: Env, id: number): Promise<Response> {
  const u = await getSessionUser(request, env);
  if (!u) return json({ error: "Not authenticated" }, 401);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid invoice id" }, 400);

  // ---------------------------------------------------------------
  // INTENTIONAL IDOR: authentication is required above, but there is
  // deliberately NO ownership check (no `AND user_id = ?`) below.
  // Any logged-in user can download any invoice by changing the id.
  // ---------------------------------------------------------------
  const inv = await env.DB.prepare(
    `SELECT i.*, t.subject AS ticket_subject, t.category AS ticket_category,
            t.priority AS ticket_priority, t.message AS ticket_message
     FROM invoices i
     LEFT JOIN tickets t ON t.id = i.ticket_id
     WHERE i.id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      invoice_number: string;
      amount_cents: number;
      currency: string;
      status: string;
      billing_name: string;
      billing_email: string;
      items_json: string;
      created_at: string;
      due_date: string;
      ticket_id: number;
      ticket_subject: string | null;
      ticket_category: string | null;
      ticket_priority: string | null;
    }>();
  if (!inv) return json({ error: "Invoice not found" }, 404);

  const pdf = generateInvoicePdf({
    id: inv.id,
    invoice_number: inv.invoice_number,
    amount_cents: inv.amount_cents,
    currency: inv.currency,
    status: inv.status,
    billing_name: inv.billing_name,
    billing_email: inv.billing_email,
    items_json: inv.items_json,
    created_at: inv.created_at,
    due_date: inv.due_date,
    ticket_id: inv.ticket_id,
    ticket_subject: inv.ticket_subject ?? "(no subject)",
    ticket_category: inv.ticket_category ?? "General",
    ticket_priority: inv.ticket_priority ?? "Low",
  });

  const body: Uint8Array<ArrayBuffer> = new Uint8Array(pdf);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
      "Cache-Control": "no-store",
      "Content-Length": String(body.length),
    },
  });
}
