CREATE TABLE IF NOT EXISTS public.marketing_tracker_sheet (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_tracker_sheet (name, position)
SELECT 'Sheet 1', 1
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_tracker_sheet);

ALTER TABLE public.marketing_tracker_column
ADD COLUMN IF NOT EXISTS sheet_id uuid REFERENCES public.marketing_tracker_sheet (id) ON DELETE CASCADE;

ALTER TABLE public.marketing_tracker_row
ADD COLUMN IF NOT EXISTS sheet_id uuid REFERENCES public.marketing_tracker_sheet (id) ON DELETE CASCADE;

UPDATE public.marketing_tracker_column
SET sheet_id = (SELECT id FROM public.marketing_tracker_sheet ORDER BY position ASC LIMIT 1)
WHERE sheet_id IS NULL;

UPDATE public.marketing_tracker_row
SET sheet_id = (SELECT id FROM public.marketing_tracker_sheet ORDER BY position ASC LIMIT 1)
WHERE sheet_id IS NULL;

ALTER TABLE public.marketing_tracker_column
ALTER COLUMN sheet_id SET NOT NULL;

ALTER TABLE public.marketing_tracker_row
ALTER COLUMN sheet_id SET NOT NULL;

ALTER TABLE public.marketing_tracker_column
DROP CONSTRAINT IF EXISTS marketing_tracker_column_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_tracker_column_sheet_key_idx
    ON public.marketing_tracker_column (sheet_id, key);

CREATE INDEX IF NOT EXISTS marketing_tracker_column_sheet_idx
    ON public.marketing_tracker_column (sheet_id);

DROP INDEX IF EXISTS public.marketing_tracker_row_position_idx;

CREATE INDEX IF NOT EXISTS marketing_tracker_row_sheet_position_idx
    ON public.marketing_tracker_row (sheet_id, position);
