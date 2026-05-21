## Blink connection settings — redesign

Reshape the "Blink Lightning" card in `src/routes/settings.tsx` only. No backend or business-logic changes.

### New layout (top to bottom)

1. **Wallet Name** — text input above API key. Friendly label for this connection (e.g. "Main BTC wallet"). Stored locally in settings as `walletName`; purely cosmetic, shown next to the connected indicator.
2. **API Key** — input with a clipboard **Paste** button inside on the right (alongside the existing show/hide eye toggle). Clicking it calls `navigator.clipboard.readText()` and fills the field, with a toast on success/failure.
3. **Inline "How to get your API key" guide** — compact 3-step list rendered directly under the input:
   1. Go to [dashboard.blink.sv](https://dashboard.blink.sv) and sign in
   2. Open [API Keys](https://dashboard.blink.sv/api-keys) and click "Create API Key"
   3. Copy the key and paste it above
   Each step links to the relevant page on dashboard.blink.sv (opens in a new tab).
4. **Encryption note** — small muted text: *"Your API key is encrypted and stored securely."*
5. **Test connection** button + connected wallets list (unchanged behavior).

### Wallet ID — remove from UI

The Wallet ID field is removed from the settings form. It's still required at invoice-creation time, so we auto-populate it:

- After **Test connection** succeeds, automatically set `form.walletId` to the BTC wallet's id (falling back to the first wallet). User no longer needs to copy/paste it.
- On initial load, if `apiKey` exists but `walletId` is empty, trigger a silent fetch to populate it.
- The underlying `walletId` field in `Settings` type and store remains intact (used by `invoices.$id.tsx`, `pay.functions.ts`).

### Non-goals

- No changes to `src/lib/store.ts`, `src/lib/blink.ts`, `src/lib/types.ts` (beyond adding optional `walletName?: string` to `Settings`).
- No changes to invoice creation flow.
- Save button behavior unchanged.

### Files touched

- `src/routes/settings.tsx` — UI rework of the Blink Lightning card
- `src/lib/types.ts` — add optional `walletName?: string` to `Settings`
- `src/lib/store.ts` — persist/load `walletName` (map to a profile column or keep client-only; will use existing settings persistence path)
