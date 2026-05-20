## Problem

On `/settings`, every input, textarea, and `<select>` sits inside a `bg-card` panel but uses `bg-transparent` (see `src/components/ui/input.tsx`, `textarea.tsx`, and the inline `<select>` in `settings.tsx`). On a dark card, transparent fields disappear into the surface — they read as flat labels, not editable slots. The uploaded reference (Framer-style settings panel) solves this by giving the field a slightly lighter fill than the card so it pops as an input target.

## Fix

Give form fields on the Settings page a dedicated "input surface" tone that's a step lighter than the card in dark mode and a step darker than the card in light mode — same idea as the attached screenshot.

### 1. Token

In `src/styles.css`, repurpose / clarify `--input` so it's an actual fill color (not just a border-ish neutral):

- Dark: `--input: oklch(0.255 0 0)` (one step lighter than `--card` at 0.21)
- Light: `--input: oklch(0.955 0 0)` (one step darker than `--card` at 1.0)

Keep `--border` as-is so the subtle outline remains.

### 2. Apply to field primitives (page-wide, not just one input)

Since the user said "the entire page," update the shared primitives so every field on Settings (and elsewhere) benefits consistently:

- `src/components/ui/input.tsx`: swap `bg-transparent` → `bg-input`
- `src/components/ui/textarea.tsx`: swap `bg-transparent` → `bg-input`
- `src/routes/settings.tsx`: the inline `<select>` (payment terms) currently uses `bg-background` — change to `bg-input` so it matches the rest of the fields on the card.

That's it — no logic, no layout changes, just the fill tone. After this, every editable slot on `/settings` (Business name, Email, Address, API key, Wallet ID, Invoice prefix, Next invoice number, Net terms select, Tax rate, Footer) will have the same subtly lighter fill, making them clearly distinguishable from the surrounding card.

### Files touched
- `src/styles.css` — adjust `--input` value in `:root` and `.dark`
- `src/components/ui/input.tsx` — `bg-transparent` → `bg-input`
- `src/components/ui/textarea.tsx` — `bg-transparent` → `bg-input`
- `src/routes/settings.tsx` — inline `<select>` `bg-background` → `bg-input`

### Not in scope
- Other pages' visual audit (the token change will cascade naturally, but I'm not redesigning anything else)
- Border, radius, focus ring, or typography changes
