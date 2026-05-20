## Plan

### 1. "Send again" on invoice detail page
In `src/routes/invoices.$id.tsx`, add a **Send again** action in the header dropdown menu (next to existing actions). It will:
- Duplicate the current invoice (new id, new number via `genInvoiceNumber`, status reset to `draft`, payment fields cleared, copies client + line items + memo + currency + tax)
- Navigate to the new invoice's detail page
- Auto-open the existing `SendInvoiceDialog` so the user can send immediately

Also rename the existing list-page "Duplicate" action to **Send again** for consistency, and have it navigate to the new invoice + open send dialog (via a query param like `?send=1` that the detail page reads on mount).

### 2. Monthly CSV export on Invoices page
In `src/routes/invoices.index.tsx`, add an **Export CSV** button next to "New invoice" in the page header. Clicking opens a small popover with:
- **Month picker** (defaults to current month) — uses a simple `<select>` for month + year, plus an "All time" option and a "Custom range" option with two date inputs
- **Export** button → generates CSV client-side and triggers download

CSV columns:
`Number, Issue date, Due date, Paid date, Client name, Client email, Currency, Subtotal, Tax %, Total, Status, Memo, Payment hash`

Filename: `invoices-YYYY-MM.csv` (or `invoices-all.csv` / `invoices-YYYY-MM-DD-to-YYYY-MM-DD.csv`).

Per-currency totals are preserved by including the `Currency` column — no mixing.

### 3. Files touched
- `src/routes/invoices.$id.tsx` — add "Send again" menu item + auto-open send dialog when arriving with `?send=1`
- `src/routes/invoices.index.tsx` — rename "Duplicate" → "Send again", add CSV export button + popover
- `src/lib/csv.ts` *(new, tiny)* — `toCsv(rows)` helper with proper quoting

No backend / migration changes.