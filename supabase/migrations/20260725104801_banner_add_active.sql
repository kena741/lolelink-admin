ALTER TABLE public.banner
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.banner.active IS 'When false, banner is deactivated and should not be shown to users.';
