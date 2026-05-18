
-- =========================
-- profiles
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  business_name text,
  business_email text,
  phone text,
  address text,
  city text,
  country text,
  vat_number text,
  blink_api_key text,
  btc_wallet_id text,
  usd_wallet_id text,
  default_currency text not null default 'USD',
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  default_payment_terms_days integer not null default 14,
  default_tax_rate numeric not null default 0,
  invoice_footer text,
  logo_url text,
  default_email_subject text not null default 'Invoice {number} from {businessName}',
  default_email_message text not null default 'Hi {clientName},

Please find your invoice {number} for {amount} attached.

Due date: {dueDate}

You can pay instantly via Bitcoin Lightning — the QR code is included in the attached PDF and below.

Thank you for your business.
{businessName}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- =========================
-- clients
-- =========================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  country text,
  vat_number text,
  notes text,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on public.clients(user_id);
alter table public.clients enable row level security;

create policy "clients_select_own" on public.clients for select using (auth.uid() = user_id);
create policy "clients_insert_own" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients_update_own" on public.clients for update using (auth.uid() = user_id);
create policy "clients_delete_own" on public.clients for delete using (auth.uid() = user_id);

-- =========================
-- invoices
-- =========================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_snapshot jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  currency text not null default 'USD',
  tax numeric not null default 0,
  memo text,
  status text not null default 'draft',
  issue_date date,
  due_date date,
  payment_request text,
  payment_hash text,
  satoshis bigint,
  expires_at bigint,
  paid_at timestamptz,
  sent_at timestamptz,
  activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create index invoices_user_id_idx on public.invoices(user_id);
create index invoices_client_id_idx on public.invoices(client_id);
alter table public.invoices enable row level security;

create policy "invoices_select_own" on public.invoices for select using (auth.uid() = user_id);
create policy "invoices_insert_own" on public.invoices for insert with check (auth.uid() = user_id);
create policy "invoices_update_own" on public.invoices for update using (auth.uid() = user_id);
create policy "invoices_delete_own" on public.invoices for delete using (auth.uid() = user_id);

-- =========================
-- email_logs
-- =========================
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);

create index email_logs_invoice_id_idx on public.email_logs(invoice_id);
create index email_logs_user_id_idx on public.email_logs(user_id);
alter table public.email_logs enable row level security;

create policy "email_logs_select_own" on public.email_logs for select using (auth.uid() = user_id);
create policy "email_logs_insert_own" on public.email_logs for insert with check (auth.uid() = user_id);
create policy "email_logs_delete_own" on public.email_logs for delete using (auth.uid() = user_id);

-- =========================
-- updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- =========================
-- handle_new_user trigger
-- =========================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, business_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'business_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- Storage: invoice-pdfs bucket
-- =========================
insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do nothing;

create policy "invoice_pdfs_select_own" on storage.objects for select
  using (bucket_id = 'invoice-pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "invoice_pdfs_insert_own" on storage.objects for insert
  with check (bucket_id = 'invoice-pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "invoice_pdfs_update_own" on storage.objects for update
  using (bucket_id = 'invoice-pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "invoice_pdfs_delete_own" on storage.objects for delete
  using (bucket_id = 'invoice-pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
