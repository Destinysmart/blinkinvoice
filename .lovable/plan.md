# BlinkInvoice — Fixes & Modern Refresh

Focused, surgical changes. I'm prioritizing the items that actually move the needle (per your own assessment at the bottom of the brief) over a full UI rewrite — the existing layout/cards are already on-brand. We can do a deeper redesign as a follow-up if you want.

## 1. Dark mode as default

- In `src/lib/theme.ts`, change `getInitialTheme()` to return `"dark"` when nothing is stored (ignore `prefers-color-scheme`).
- Tighten dark tokens in `src/styles.css` to the requested palette:
  - `--background: #0A0A0A`, `--surface: #141414`, `--card: #1A1A1A`, `--border: #242424`
  - `--foreground: #F2F2F2`, `--muted-foreground: #666666`
  - Keep `--primary` = `#F7931A`
- Light theme and the toggle stay intact.

## 2. Friendly "missing amount" warning

- In `src/routes/invoices.$id.tsx`, before calling `makeInvoice()`:
  - Compute total from line items.
  - If no items or total ≤ 0, render a warm orange warning card above the "Generate payment link" button: *"Add at least one item with a price before generating a payment link."*
  - Disable the generate button in that state. No toast, no raw BOLT11 errors surfaced.
- Wrap the `makeInvoice()` call in try/catch and swallow technical messages into a generic friendly fallback.

## 3. Business info no longer resets on wallet connect

- Audit `src/routes/settings.tsx`: today `useState(settings)` initializes once but `useWalletConnect()` re-renders can interact with the store's `saveSettings`/refetch pattern.
- Fix by:
  - Decoupling the form: seed `form` from `settings` via a `useEffect` that only syncs when `settings.id`/timestamp changes — never on wallet state.
  - Ensuring `useWalletConnect` is read in a sibling component (extract `<WalletCard />`) so its re-renders don't bubble into the business form.
- Confirm business profile loads from Supabase independently of wallet hook.

## 4. Payment note / memo for clients

- Add a "Payment note for client" textarea in the invoice editor (`src/routes/invoices.$id.tsx` / `invoices.new.tsx`), bound to the existing `memo` column.
- When generating the Lightning invoice, pass `memo` to `makeInvoice({ memo })`. Default memo when blank: `${invoice.number} — ${clientName}`.
- Pay page (`src/routes/pay.$token.tsx`): below the QR, show `Note: {memo}` in muted style.
- Invoice PDF (`src/components/InvoicePDF.tsx`): render the memo in the footer/notes area.
- No DB migration needed — `invoices.memo` already exists.

## 5. Targeted UX fixes from your second list

- **Dashboard stat cards** (`src/routes/index.tsx`): single column on mobile (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), numbers bumped to `text-3xl font-bold`, add `border-l-2 border-primary` on the "Total Invoiced" card.
- **Invoice list** (`src/routes/invoices.index.tsx`): in the default "All" filter, hide invoices where total = 0 (still visible under "Draft"). Add a subtle `<Separator />` between unpaid and paid groups.
- **Settings page**: make the section header (`<h2>` inside `Card`) `sticky top-0` with a `bg-card/95 backdrop-blur` band; reduce `space-y-4` → `space-y-3` inside sections.
- **Sidebar active state** (`src/components/Sidebar.tsx`): add a 3px orange left border indicator on the active item instead of (or in addition to) the pale fill.

## What I'm intentionally NOT doing

- A full rip-and-replace UI overhaul. Your own notes call out that the cards, status pills, and wallet connection UI already work. A blanket redesign risks regressions on the things that are working. If after the above you still want the full 2026 redesign, I'll generate 3 design directions for you to pick from.

## Technical notes

- No schema changes. `memo` and existing tables cover everything.
- `lightningconnect`'s `makeInvoice` already accepts a `memo` arg per its 0.1.0 API.
- Theme change is a one-line default + token swap; existing `useTheme` persistence keeps user choice sticky after first toggle.
