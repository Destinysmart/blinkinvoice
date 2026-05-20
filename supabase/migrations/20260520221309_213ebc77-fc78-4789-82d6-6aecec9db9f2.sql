ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS message_id text;
CREATE INDEX IF NOT EXISTS email_logs_message_id_idx ON public.email_logs(message_id);
CREATE INDEX IF NOT EXISTS email_logs_invoice_id_created_at_idx ON public.email_logs(invoice_id, created_at DESC);