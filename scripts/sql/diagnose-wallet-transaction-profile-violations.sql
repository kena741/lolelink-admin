-- Run after add-wallet-transaction-profile-ids.sql
-- Lists rows that would block wallet_transaction_profile_type_check

SELECT
    'customer_missing_profile' AS issue,
    COUNT(*) AS row_count
FROM public.wallet_transaction
WHERE lower(coalesce(type, '')) = 'customer'
  AND customer_id IS NULL

UNION ALL

SELECT
    'provider_missing_profile' AS issue,
    COUNT(*) AS row_count
FROM public.wallet_transaction
WHERE lower(coalesce(type, '')) IN ('provider', 'provider_payout')
  AND provider_id IS NULL

UNION ALL

SELECT
    'customer_has_provider_id' AS issue,
    COUNT(*) AS row_count
FROM public.wallet_transaction
WHERE lower(coalesce(type, '')) = 'customer'
  AND provider_id IS NOT NULL

UNION ALL

SELECT
    'provider_has_customer_id' AS issue,
    COUNT(*) AS row_count
FROM public.wallet_transaction
WHERE lower(coalesce(type, '')) IN ('provider', 'provider_payout')
  AND customer_id IS NOT NULL;

-- Sample offending rows
SELECT
    wt.id,
    wt."createdDate",
    wt.type,
    wt."userId",
    wt.provider_id,
    wt.customer_id,
    wt.amount,
    wt."isCredit",
    wt.note,
    wt."transactionId"
FROM public.wallet_transaction wt
WHERE (
        lower(coalesce(wt.type, '')) = 'customer'
        AND (wt.customer_id IS NULL OR wt.provider_id IS NOT NULL)
    )
    OR (
        lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout')
        AND (wt.provider_id IS NULL OR wt.customer_id IS NOT NULL)
    )
ORDER BY wt."createdDate" DESC NULLS LAST
LIMIT 100;

-- Helpful: see if userId matches anything
SELECT
    wt.id,
    wt.type,
    wt."userId",
    p.id AS provider_profile_id,
    p.user_id AS provider_auth_id,
    c.id AS customer_profile_id,
    c.user_id AS customer_auth_id
FROM public.wallet_transaction wt
LEFT JOIN public.provider p ON p.id = wt."userId" OR p.user_id = wt."userId"
LEFT JOIN public.customer c ON c.id = wt."userId" OR c.user_id = wt."userId"
WHERE (
        lower(coalesce(wt.type, '')) = 'customer' AND wt.customer_id IS NULL
    )
    OR (
        lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout') AND wt.provider_id IS NULL
    )
ORDER BY wt."createdDate" DESC NULLS LAST
LIMIT 100;
