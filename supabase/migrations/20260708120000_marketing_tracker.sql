CREATE TABLE IF NOT EXISTS public.marketing_tracker_column (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    label text NOT NULL,
    column_type text NOT NULL CHECK (column_type IN ('text', 'boolean', 'date')),
    position integer NOT NULL,
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_tracker_row (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position integer NOT NULL,
    values jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_tracker_row_position_idx
    ON public.marketing_tracker_row (position);

CREATE INDEX IF NOT EXISTS marketing_tracker_row_values_gin_idx
    ON public.marketing_tracker_row USING gin (values);
