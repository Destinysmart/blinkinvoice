ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_advanced boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET show_advanced = true WHERE show_advanced = false;