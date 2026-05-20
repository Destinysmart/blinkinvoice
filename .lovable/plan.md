## Goal

Make BlinkInvoice feel like a serious, niche invoicing tool — Invoice → Send → Get paid — without throwing away the work already shipped. Hide advanced modules behind a toggle, calm down the UI, and make the app installable in one click from any device.

You didn't pick a distribution option, so I'm proposing the cheapest first step (PWA — works on Mac, Windows, iOS, Android, Linux from the browser, no app store) and flagging real native desktop/mobile builds as a clear follow-up step.

---

## 1. Scope: hide advanced, keep data

Add a single setting: **Settings → "Show advanced features"** (off by default for new users, on for existing users so nothing disappears unexpectedly).

When OFF, the sidebar shows only:

- Dashboard
- Invoices
- Clients
- Settings
- Products

When ON, also show:

- Projects
- Expenses
- Reports

note products is a defaul feature not an advance so it shouldnt go to the advance toogle

Implementation:

- Store `show_advanced` boolean on `profiles` (default `false`, set `true` for existing rows in the migration so current users don't lose anything).
- `Sidebar.tsx` reads the flag and filters nav items.
- Routes for hidden features stay live (typing the URL still works) — only the nav entry disappears. Database tables untouched.
- Dashboard hides the Expenses/Projects widgets when the flag is off.

## 2. Visual tone: serious & trustworthy

Not a clone of Invoice Ninja — just the tone. Targeted, low-risk changes:

- Tighten the sidebar: smaller icons, denser spacing, single accent color, neutral grays for everything else.
- Replace any playful gradients / glow with flat surfaces + subtle 1px borders.
- Invoice list: convert to a dense, sortable data table (Number · Client · Issued · Due · Amount · Status) — Invoice Ninja's strongest pattern.
- Status badges: muted neutrals + one clear "paid" green and one clear "overdue" red.
- Typography: keep current body font, swap display font to something more businesslike (Inter or similar) if our current heading font is decorative.
- Remove any "fun" copy / emoji from empty states; use plain, direct language ("No invoices yet. Create one.").

This is presentational only — no logic changes.

## 3. One-click install (Phase 1: PWA)

Ship an installable PWA so users on Mac, Windows, Linux, iOS, and Android can install BlinkInvoice from a single button:

- Add a proper `manifest.json` (already exists — verify name, icons, theme color, `display: "standalone"`, `start_url: "/invoices"`).
- Add an **"Install app"** button in the sidebar footer and on Settings → About. Uses the `beforeinstallprompt` event on desktop/Android; shows iOS-specific "Add to Home Screen" instructions on iOS Safari.
- Generate proper PWA icons (192, 512, maskable, Apple touch icon).
- A landing/download section on Settings that says: *"Install BlinkInvoice on this device"* with one button — same UX across all platforms.
- **No service worker** for caching (Lovable preview restriction). PWA = installable + standalone window, not offline.

This is the "one click, anyone can download and use" boss is asking for, today.

## 4. Native downloads (Phase 2 — separate effort, called out only)

True downloadable installers (`.dmg`, `.exe`, `.AppImage`, App Store, Play Store) are real work and I will NOT bundle them in this round. When you're ready, the path is:

- **Desktop (Mac/Win/Linux)**: wrap the app in Electron, ship `.dmg` / `.exe` / `.AppImage` from a Downloads page.
- **iOS/Android**: wrap with Capacitor, requires Apple ($99/yr) + Google ($25 one-time) developer accounts and store review.

I'll flag this in the Settings → About page as "Native apps coming soon" so the intent is visible to users.

---

## Files touched

**Migration**

- Add `profiles.show_advanced boolean not null default false`; backfill existing rows to `true`.

**Edited**

- `src/components/Sidebar.tsx` — filter nav by `show_advanced`.
- `src/routes/settings.tsx` — add "Show advanced features" toggle + "Install app" button + "Native apps coming soon" note.
- `src/routes/index.tsx` (Dashboard) — hide expense/project widgets when advanced is off.
- `src/routes/invoices.index.tsx` — switch card/grid layout to dense sortable table.
- `src/styles.css` — calmer tokens (flatten gradients, neutralize accents, tighten radii).
- `src/components/StatusBadge.tsx` — muted palette.
- `public/manifest.json` — verify PWA fields.
- `src/components/InstallBanner.tsx` — repurpose as the cross-platform install button (already exists).

**Created**

- `src/hooks/use-install-prompt.ts` — wraps `beforeinstallprompt` + iOS detection.
- PWA icon set in `public/icons/`.

## Out of scope (deferred)

- Electron / Capacitor builds (Phase 2).
- Removing any database tables.
- Rewriting Reports/Expenses/Projects/Products — they keep working, just hidden.
- Service worker / offline mode.

## Risks

- The "Show advanced features" toggle is the only way to find hidden modules — if a user turns it off and forgets, they may think features were deleted. Mitigation: clear helper text under the toggle: *"Hide Expenses, Projects, Products and Reports from the sidebar. You can turn them back on anytime."*
- PWA install on iOS still requires the "Share → Add to Home Screen" tap — there's no programmatic install on iOS. We show clear instructions instead of a fake button.