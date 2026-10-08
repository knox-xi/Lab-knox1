# SupportDesk — Acme Support Customer Portal

A realistic small-SaaS customer support portal. Customers register, log in, open support
tickets, generate per-ticket invoices, and download real PDF invoices.

- **Business:** Customer Support Portal for **Acme Support** (Riyadh · Dubai · Cairo)
- **Languages:** English + Arabic (full UI toggle, RTL layout; invoices render in English, the accounting standard)
- **Workflow:** Register → Login → Create Ticket → Generate Invoice → Download Invoice
- **Stack:** Cloudflare Workers · Cloudflare D1 (SQLite) · TypeScript · vanilla HTML/CSS/JS (no backend framework, no external auth)

This is a real app, not a mockup: real D1 queries, real PBKDF2 password hashing,
real HttpOnly sessions, real forms, real PDF bytes.

## Quick start

```bash
npm install
npm run db:migrate:local   # creates tables + deterministic seed (invoice id=1)
npm run dev                # http://127.0.0.1:8787
```

Open the URL, switch EN/عربي in the top bar, register a new account, create a ticket,
open the ticket and click **Generate invoice**, then **Download PDF**.

Remote (production):

```bash
npm run db:create            # first time only, copy the database_id into wrangler.toml
npm run db:migrate:remote
npm run deploy
```

Useful scripts:

```bash
npm run build              # tsc --noEmit
npm run seed:check:local    # list invoices to confirm id=1 exists
npm run verify              # end-to-end test incl. IDOR check (needs `npm run dev` running)
# BASE_URL=https://supportdesk.<you>.workers.dev npm run verify
```

## Project layout

```
wrangler.toml            Workers + D1 + Assets config
migrations/0001_schema.sql  users, sessions, tickets, invoices
migrations/0002_seed.sql    deterministic victim data (TARGET_ID = 1, no flag literal)
src/index.ts             Worker: auth, tickets, invoices, PDF, routing
public/index.html        App shell
public/styles.css        SaaS styling + RTL
public/app.js            SPA + EN/AR dictionary, real fetch() calls
scripts/verify.mjs       full workflow + vulnerability verification
```

## Data model

- `users(id, name, email UNIQUE, password_hash, created_at)`
- `sessions(id PK, user_id FK, expires_at, created_at)` — 7-day HttpOnly cookie `sd_session`
- `tickets(id, user_id FK, subject, category, priority, message, status, created_at)`
- `invoices(id, user_id FK, ticket_id UNIQUE FK, invoice_number UNIQUE, amount_cents, currency, status, billing_name, billing_email, items_json, created_at, due_date)`

Pricing is real logic: base price per category
(Technical $149 / Billing $49 / Account $79 / Feature $99 / General $59)
plus a priority fee (Medium +$20, High +$40, Urgent +$80).
Invoice numbers are `INV-2026-0001`, `-0002`, … derived from `MAX(id)+1`.

Seed guarantees the target: user `layla@acme.support` (id 1) → ticket id 1 →
invoice **id 1 / INV-2026-0001**. The seed contains no flag; the flag only exists
inside the generated PDF bytes for invoice 1.

## API

All JSON except the PDF download. Auth via HttpOnly cookie, `credentials: same-origin`.

```
POST /api/register   {name, email, password}
POST /api/login      {email, password}
POST /api/logout
GET  /api/me
GET  /api/tickets
POST /api/tickets    {subject, category, priority, message}
GET  /api/tickets/:id
GET  /api/invoices
POST /api/invoices   {ticket_id}
GET  /api/invoices/:id
GET  /api/invoices/:id/download   -> application/pdf (vulnerable, see below)
```

Errors are JSON `{error: "..."}` with correct status codes (400/401/404/409/500).

## Security (what IS secure)

- Passwords: PBKDF2-SHA256, 100k iterations, 16-byte random salt, constant-time compare.
- Sessions: 256-bit random id, stored in D1 with expiry, `HttpOnly; SameSite=Lax` (+`Secure` on HTTPS).
- SQL: every D1 query is parameterized (`.bind(...)`), no string interpolation.
- XSS: frontend renders with `textContent`/escaped templates; no `innerHTML` with user data except via `esc()`.
- Auth: every `/api/*` except register/login requires a valid session; ticket-list, ticket-detail, invoice-list, invoice-create, and invoice-detail JSON all enforce ownership (`WHERE … AND user_id = ?`).

## Intentional vulnerability — IDOR / Broken Access Control

**Where:** `GET /api/invoices/:id/download` in `src/index.ts` (`handleDownloadInvoice`).

**Why it is vulnerable:** the handler authenticates the caller but looks the invoice up
by `id` alone:

```sql
SELECT … FROM invoices i LEFT JOIN tickets t … WHERE i.id = ?
```

There is deliberately no `AND user_id = ?` ownership check (compare with
`handleGetInvoice`, which does check ownership and is safe). So any logged-in user
can read any other user's invoice PDF by changing the id.

**How to demonstrate (as a normal new user):**

1. Register + log in, create a ticket, generate its invoice (you get e.g. id 2).
2. Download your own invoice — works: `GET /api/invoices/2/download`.
3. Change the id to the seeded target: `GET /api/invoices/1/download`.
4. The returned PDF is another customer's invoice (`INV-2026-0001`, billed to Layla Hassan)
   and contains an `Internal Reference: SDC{...}` line — that is the flag.
   Format is `SDC{...}`; it appears nowhere else (not in HTML/JS, not in JSON, not in seed).

**Correct fix:** enforce ownership on the download path, exactly like the detail endpoint:

```ts
const inv = await env.DB.prepare(
  `SELECT … WHERE i.id = ? AND i.user_id = ?`
).bind(id, user.id).first();
if (!inv) return json({ error: "Invoice not found" }, 404);
```

Optionally return 404 (not 403) to avoid confirming other users' ids, add per-user
authorization tests, and log repeated cross-user access attempts.

## Notes for the workshop

- Keep it simple: one vulnerability, one target id, one flag location (PDF bytes only).
- The PDF generator is dependency-free (hand-built PDF 1.4 with Helvetica) so it runs on Workers.
- Arabic UI is complete; PDF text is ASCII-sanitized (Helvetica has no Arabic glyphs), which is normal for cross-border invoices.
