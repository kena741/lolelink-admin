ALTER TABLE public.marketing_tracker_column
ADD COLUMN IF NOT EXISTS width_px integer CHECK (width_px IS NULL OR (width_px >= 80 AND width_px <= 800));
