-- Admin internal notes on provider + customer profiles (idempotent).
ALTER TABLE public.provider
  ADD COLUMN IF NOT EXISTS admin_note text;

ALTER TABLE public.customer
  ADD COLUMN IF NOT EXISTS admin_note text;

COMMENT ON COLUMN public.provider.admin_note IS
  'Internal admin-only note shown on provider detail.';

COMMENT ON COLUMN public.customer.admin_note IS
  'Internal admin-only note shown on customer detail.';
