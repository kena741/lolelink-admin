-- Allow every-minute / hourly recurring rates used by admin + mobile.
-- Previous check only allowed WEEK/MONTH/QUARTER/YEAR, so saving MINUTE failed.

ALTER TABLE public.service
  DROP CONSTRAINT IF EXISTS service_billing_interval_check;

ALTER TABLE public.service
  ADD CONSTRAINT service_billing_interval_check
  CHECK (
    billing_interval IS NULL
    OR billing_interval IN ('MINUTE', 'HOUR', 'WEEK', 'MONTH', 'QUARTER', 'YEAR')
  );
