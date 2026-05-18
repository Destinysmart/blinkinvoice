## Products Catalog + Invoice Autocomplete

### 1. Database (migration)
New table `products` with RLS scoped to `auth.uid() = user_id`:
- `name` (text, required)
- `description` (text)
- `price` (numeric, required)
- `currency` (text, default `USD`) — `USD` or `BTC` (sats)
- `unit` (text, default `unit`)
- `sku` (text)
- `category` (text)
- `is_active` (boolean, default true)
- standard `id`, `user_id`, `created_at`, `updated_at` + updated_at trigger

### 2. Server functions (`src/lib/products.functions.ts`)
`listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct` — all protected with `requireSupabaseAuth`, validated with Zod.

### 3. Products page (`src/routes/_authenticated/products.tsx`)
- Header: title + "New Product" button
- Search input (filters by name/SKU/category)
- List/table of products: name, SKU, price + unit, category badge, active toggle, edit/delete actions
- Slide-over (Sheet) form for create/edit with all fields
- Confirm delete dialog
- Empty state when no products

### 4. Sidebar
Insert "Products" link in `src/components/Sidebar.tsx` Workspace section between Invoices and Clients (Package icon).

### 5. Invoice line-item autocomplete (`src/routes/invoices.new.tsx` + edit if applicable)
- Description input becomes a Combobox/Command-driven autocomplete
- As user types, filter active products by name or SKU (case-insensitive, substring match)
- Dropdown shows: product name (bold) · SKU (muted) · price hint right-aligned
- Selecting a product fills `desc`, `price`, and (if line items have unit field — currently they don't, leave description-only fill if not) for that line
- Typing freely without selecting still works (manual entry preserved)
- No-op gracefully when product list is empty

### 6. Notes
- Line items in current schema only have `desc`, `qty`, `price`. We will auto-fill `desc` and `price` on selection. (Unit isn't stored per line item — out of scope to extend invoice schema for this iteration.)
- Currency on a product is informational; we won't force-switch invoice currency on selection.

### Technical details
- Use shadcn `Command` + `Popover` for autocomplete, anchored to the description input
- TanStack Query: `['products']` key, invalidated on create/update/delete
- Reuse existing patterns from `clients` route for the Sheet form and table layout
