-- Recurring next-cycle billing flags (matches mobile recurring_next_cycle.sql).
-- currentPeriodStart/End may already exist on live; IF NOT EXISTS keeps this idempotent.

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS "currentPeriodStart" timestamptz;

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS "currentPeriodEnd" timestamptz;

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS "nextCycleDue" boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.booked_service
ADD COLUMN IF NOT EXISTS "nextCycleNotifiedAt" timestamptz;

COMMENT ON COLUMN public.booked_service."currentPeriodEnd" IS
  'End of the paid billing period. When this time passes, nextCycleDue is set and the provider is notified.';

COMMENT ON COLUMN public.booked_service."nextCycleDue" IS
  'True when the current cycle has ended and the customer must pay the next cycle.';
