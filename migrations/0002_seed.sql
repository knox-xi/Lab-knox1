-- 0002_seed.sql — deterministic target data (TARGET_ID = 1)
-- Invoice id=1 belongs to the seeded victim user. No flag literal is stored here;
-- the flag only appears inside the generated PDF for invoice 1 at download time.

INSERT INTO users (id, name, email, password_hash, created_at) VALUES (
  1,
  'Layla Hassan',
  'layla@acme.support',
  'pbkdf2$100000$68nQXl04NYIOv6dqyqEPjg==$IZ+pJ98i9AcdDXzynWBkmY9cHYG4J6eMXdHRzOvBXx8=',
  '2026-01-15T10:00:00.000Z'
);

INSERT INTO tickets (id, user_id, subject, category, priority, message, status, created_at) VALUES (
  1,
  1,
  'VPN access intermittent in Riyadh office',
  'Technical',
  'High',
  'Hello team, our Riyadh office VPN drops every 20-30 minutes since Monday. 12 users affected. Router: AcmeEdge 400, firmware 6.2.1. Please advise urgently, it blocks our billing sync.',
  'closed',
  '2026-01-15T10:05:00.000Z'
);

INSERT INTO invoices (id, user_id, ticket_id, invoice_number, amount_cents, currency, status, billing_name, billing_email, items_json, created_at, due_date) VALUES (
  1,
  1,
  1,
  'INV-2026-0001',
  18900,
  'USD',
  'paid',
  'Layla Hassan',
  'layla@acme.support',
  '[{"description":"Premium Technical Support - VPN Diagnostics (4h)","qty":1,"unit_cents":14900},{"description":"Priority Handling Fee","qty":1,"unit_cents":4000}]',
  '2026-01-16T09:00:00.000Z',
  '2026-01-30T09:00:00.000Z'
);
