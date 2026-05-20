
-- Add pay_token to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pay_token text;

-- Backfill existing rows with a URL-safe random token (base64url, no padding)
UPDATE public.invoices
SET pay_token = replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '')
WHERE pay_token IS NULL;

-- Enforce NOT NULL + uniqueness now that all rows have a value
ALTER TABLE public.invoices
  ALTER COLUMN pay_token SET NOT NULL;

ALTER TABLE public.invoices
  ALTER COLUMN pay_token SET DEFAULT replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '');

CREATE UNIQUE INDEX IF NOT EXISTS invoices_pay_token_key ON public.invoices(pay_token);
