## Goal

Solve the expiring Lightning invoice problem. Today the BOLT11 is generated when you click "Send" and embedded directly into the email PDF — it dies in 5 min (USD/stablesats) or ~24h (BTC). Instead, the email will link to a hosted pay page that mints a fresh BOLT11 on every load and auto-refreshes before expiry.

## What changes for the user

- Emails get a big **"Pay invoice"** button linking to `https://blinkinvoice.lovable.app/pay/<token>`
- That page shows: amount, business name, client name, due date, live QR + copyable BOLT11, and a countdown
- QR auto-regenerates ~30s before expiry — client never sees a dead invoice
- When the invoice is paid, the page flips to a green "Paid ✓" state in real-time (polls every 3s)
- PDF still includes a snapshot QR for offline/print use, with the pay-link printed underneath as fallback

## Technical design

### 1. Schema change
Add to `invoices` table:
- `pay_token text unique` — random 32-char URL-safe token, generated on insert via trigger or in the app
- Backfill existing rows with random tokens

No PII in the token. Token grants pay-only access — not edit access.

### 2. New public server route
`src/routes/api/public/pay.$token.tsx` (uses TSS server fn pattern, not edge function):

- **`getPayInfo({ token })`** — returns `{ businessName, clientName, number, currency, total, dueDate, status, paymentRequest, expiresAt, satoshis }` for a token. Uses `supabaseAdmin` (bypasses RLS — token IS the auth). Returns minimal info, no email/address.
- **`refreshPayInvoice({ token })`** — if status≠paid and (no `paymentRequest` or `expiresAt` within 60s), looks up owner's `blink_api_key` + wallet from `profiles`, mints a fresh BOLT11 via `createLnBtcInvoice` (USD invoices use `usdCentsToSats` first), writes new `payment_request` + `payment_hash` + `expires_at` back to the invoice row, returns the new bolt11.
- **`checkPayStatus({ token })`** — polls Blink `lnInvoicePaymentStatus`; if PAID, marks invoice paid + sets `paid_at`.

All three are `createServerFn` (no auth middleware) that validate the token against the DB. No `requireSupabaseAuth` since payers aren't logged in.

### 3. New public page route
`src/routes/pay.$token.tsx`:
- Calls `getPayInfo` on mount
- If unpaid: shows QR + BOLT11 + countdown, auto-calls `refreshPayInvoice` 30s before expiry
- Polls `checkPayStatus` every 3s while unpaid
- On paid: confetti + "Payment received" + receipt summary
- Clean standalone layout (no app sidebar) — branded with the business name + logo
- SEO: `noindex` (pay pages shouldn't be crawled)

### 4. Email + PDF updates
`src/components/SendInvoiceDialog.tsx` `buildHtml`:
- Add prominent **"Pay invoice"** CTA button → `https://<host>/pay/<token>`
- Keep amount/due date summary
- Drop reliance on embedded QR being scannable later — text says "Open this page to pay — the QR refreshes automatically"

`src/components/InvoicePDF.tsx`:
- Keep current QR (works for immediate scans / printed invoices)
- Add a small line under the QR: "QR expired? Pay online at /pay/<token>"

### 5. Files touched

**Created**
- `supabase` migration: add `pay_token` column + unique index + backfill
- `src/routes/api/public/pay.functions.ts` — the 3 server fns
- `src/routes/pay.$token.tsx` — the public pay page

**Edited**
- `src/components/SendInvoiceDialog.tsx` — pass pay URL into `buildHtml`, add CTA
- `src/components/InvoicePDF.tsx` — add pay URL fallback line
- `src/lib/types.ts` — add `payToken: string` to `Invoice`
- `src/lib/store.ts` — load/save `pay_token`

### 6. Out of scope (for this plan)
- LNURL-pay / Lightning Address support (could be a follow-up)
- Webhook from Blink (current 3s polling is fine for v1)
- Auth on the pay page (token is the auth — same model as Stripe payment links)

### 7. Risks
- The pay-page calls Blink using the **invoice owner's** API key (fetched server-side via service role). That key never leaves the server. Safe.
- If owner rotates their Blink key, old pay links keep working as long as the new key is in `profiles`.
- Cloudflare Worker runtime is fine — only `fetch` calls to Blink, no Node-only deps.
