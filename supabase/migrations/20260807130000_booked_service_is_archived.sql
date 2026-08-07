-- Soft-archive bookings without changing job status.

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS archive_note text;

CREATE INDEX IF NOT EXISTS booked_service_is_archived_idx
ON public.booked_service (is_archived)
WHERE is_archived = false;
