-- Step 2 (if needed): Extra backfill for rows diagnose still flags.
-- Safe to run multiple times.

BEGIN;

-- Customer: try any userId match when type = customer
UPDATE public.wallet_transaction wt
SET customer_id = c.id,
    provider_id = NULL
FROM public.customer c
WHERE lower(coalesce(wt.type, '')) = 'customer'
  AND wt.customer_id IS NULL
  AND (wt."userId" = c.id OR wt."userId" = c.user_id);

-- Provider: try any userId match when type is provider-side
UPDATE public.wallet_transaction wt
SET provider_id = p.id,
    customer_id = NULL
FROM public.provider p
WHERE lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout')
  AND wt.provider_id IS NULL
  AND (wt."userId" = p.id OR wt."userId" = p.user_id);

-- If userId matches a provider but type was mis-tagged as customer, fix type + profile
UPDATE public.wallet_transaction wt
SET type = 'provider',
    provider_id = p.id,
    customer_id = NULL
FROM public.provider p
WHERE lower(coalesce(wt.type, '')) = 'customer'
  AND wt.customer_id IS NULL
  AND wt."userId" = p.user_id
  AND NOT EXISTS (
      SELECT 1 FROM public.customer c WHERE c.user_id = wt."userId" OR c.id = wt."userId"
  );

-- If userId matches customer only, ensure customer_id set
UPDATE public.wallet_transaction wt
SET customer_id = c.id,
    provider_id = NULL
FROM public.customer c
WHERE lower(coalesce(wt.type, '')) = 'customer'
  AND wt.customer_id IS NULL
  AND wt."userId" = c.user_id;

COMMIT;
