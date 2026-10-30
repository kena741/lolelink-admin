-- Admin follow-up notes on hire / booking history (idempotent).
ALTER TABLE public.booked_service
  ADD COLUMN IF NOT EXISTS admin_note text;

COMMENT ON COLUMN public.booked_service.admin_note IS
  'Internal admin follow-up note on provider hire / service history.';
