-- Additive admin hardening migration (safe rollout)
-- NOTE: only additive schema changes in this file.

ALTER TABLE IF EXISTS public.withdrawal_history
ADD COLUMN IF NOT EXISTS "rejectionReason" text;
