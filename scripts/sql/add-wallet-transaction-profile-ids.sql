-- Step 1: Add profile FK columns + backfill (no CHECK yet).
-- Run this first in Supabase SQL editor.
--
-- After it succeeds, run:
--   scripts/sql/diagnose-wallet-transaction-profile-violations.sql
-- Fix any orphans, then optionally:
--   scripts/sql/add-wallet-transaction-profile-type-check.sql

BEGIN;

ALTER TABLE public.wallet_transaction
    ADD COLUMN IF NOT EXISTS provider_id uuid,
    ADD COLUMN IF NOT EXISTS customer_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transaction_provider_id_fkey'
    ) THEN
        ALTER TABLE public.wallet_transaction
            ADD CONSTRAINT wallet_transaction_provider_id_fkey
            FOREIGN KEY (provider_id) REFERENCES public.provider(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transaction_customer_id_fkey'
    ) THEN
        ALTER TABLE public.wallet_transaction
            ADD CONSTRAINT wallet_transaction_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customer(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_transaction_provider_id_idx
    ON public.wallet_transaction (provider_id);

CREATE INDEX IF NOT EXISTS wallet_transaction_customer_id_idx
    ON public.wallet_transaction (customer_id);

COMMENT ON COLUMN public.wallet_transaction.provider_id IS
    'Provider profile id (public.provider.id) for provider-side wallet rows.';

COMMENT ON COLUMN public.wallet_transaction.customer_id IS
    'Customer profile id (public.customer.id) for customer-side wallet rows.';

-- Backfill customer rows (profile id on userId)
UPDATE public.wallet_transaction wt
SET customer_id = c.id,
    provider_id = NULL
FROM public.customer c
WHERE lower(coalesce(wt.type, '')) = 'customer'
  AND wt."userId" = c.id;

-- Backfill customer rows (auth id on userId)
UPDATE public.wallet_transaction wt
SET customer_id = c.id,
    provider_id = NULL
FROM public.customer c
WHERE lower(coalesce(wt.type, '')) = 'customer'
  AND wt.customer_id IS NULL
  AND wt."userId" = c.user_id;

-- Backfill provider rows (profile id on userId)
UPDATE public.wallet_transaction wt
SET provider_id = p.id,
    customer_id = NULL
FROM public.provider p
WHERE lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout')
  AND wt."userId" = p.id;

-- Backfill provider rows (auth id on userId)
UPDATE public.wallet_transaction wt
SET provider_id = p.id,
    customer_id = NULL
FROM public.provider p
WHERE lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout')
  AND wt.provider_id IS NULL
  AND wt."userId" = p.user_id;

-- Clear wrong-side profile id if both were ever set
UPDATE public.wallet_transaction
SET provider_id = NULL
WHERE lower(coalesce(type, '')) = 'customer'
  AND provider_id IS NOT NULL;

UPDATE public.wallet_transaction
SET customer_id = NULL
WHERE lower(coalesce(type, '')) IN ('provider', 'provider_payout')
  AND customer_id IS NOT NULL;

COMMIT;
