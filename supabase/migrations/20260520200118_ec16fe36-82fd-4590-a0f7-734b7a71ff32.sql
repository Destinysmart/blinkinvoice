-- Normalize invoices.expires_at to milliseconds.
-- Rows written by the pay-page server fn used seconds; rows from in-app flow used ms.
-- Anything below 10,000,000,000 is clearly seconds (year 2286 threshold), multiply by 1000.
UPDATE public.invoices
SET expires_at = expires_at * 1000
WHERE expires_at IS NOT NULL
  AND expires_at < 10000000000;