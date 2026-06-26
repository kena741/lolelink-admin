-- Duplicate wallet_transaction rows (same booking tx + user + direction + kind).
-- Matches scripts/export-suspicious-wallet-transactions.ts logic:
--   keep earliest createdDate per group; later rows are delete candidates.
--
-- Run in Supabase SQL editor. Review results before any DELETE.

-- ---------------------------------------------------------------------------
-- 1) All duplicate groups (refunds highlighted)
-- ---------------------------------------------------------------------------
WITH classified AS (
    SELECT
        wt.id,
        wt."createdDate",
        wt."userId",
        wt."transactionId",
        wt."isCredit",
        wt.amount,
        wt."paymentType",
        wt.type,
        wt.note,
        wt.customer_id,
        wt.provider_id,
        CASE
            WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%refund%' THEN 'refund_credit'
            WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%activation%' THEN 'activation_credit'
            WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%completed (payout%' THEN 'payout_credit'
            WHEN wt."isCredit" <> true
                AND (
                    lower(coalesce(wt.note, '')) LIKE '%service fee debited%'
                    OR lower(coalesce(wt.note, '')) LIKE '%service booking fee%'
                ) THEN 'fee_debit'
            WHEN wt."isCredit" <> true
                AND lower(coalesce(wt.note, '')) LIKE '%cancel%'
                AND lower(coalesce(wt.note, '')) NOT LIKE '%refund%' THEN 'cancel_debit'
            WHEN lower(coalesce(wt.note, '')) LIKE '%admin commission refund%' THEN 'zero_commission'
            WHEN lower(coalesce(wt.note, '')) LIKE '%admin reversal%' THEN 'admin_reversal'
            WHEN lower(coalesce(wt.note, '')) LIKE '%withdrawal payout%' THEN 'withdrawal'
            ELSE 'other'
        END AS kind
    FROM public.wallet_transaction wt
    WHERE coalesce(trim(wt."transactionId"), '') <> ''
),
ranked AS (
    SELECT
        c.*,
        row_number() OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
            ORDER BY c."createdDate" ASC, c.id ASC
        ) AS row_in_group,
        count(*) OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
        ) AS group_size
    FROM classified c
)
SELECT
    r.group_size,
    r.row_in_group,
    CASE WHEN r.row_in_group = 1 THEN 'KEEP' ELSE 'DELETE' END AS action,
    r.kind,
    r.id,
    r."createdDate",
    r."userId",
    r.type,
    r."isCredit",
    r.amount,
    r."paymentType",
    r."transactionId",
    r.note
FROM ranked r
WHERE r.group_size > 1
ORDER BY
    r."transactionId",
    r."userId",
    r."isCredit",
    r.kind,
    r.row_in_group;


-- ---------------------------------------------------------------------------
-- 2) Refund duplicates only (cancel / decline refunds)
-- ---------------------------------------------------------------------------
-- WITH classified AS ( ... same as above ... )
-- Add at end: AND r.kind = 'refund_credit'


-- ---------------------------------------------------------------------------
-- 3) Side-by-side: keeper vs delete candidate (refund credits only)
-- ---------------------------------------------------------------------------
WITH classified AS (
    SELECT
        wt.id,
        wt."createdDate",
        wt."userId",
        wt."transactionId",
        wt."isCredit",
        wt.amount,
        wt."paymentType",
        wt.type,
        wt.note,
        CASE
            WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%refund%' THEN 'refund_credit'
            ELSE 'other'
        END AS kind
    FROM public.wallet_transaction wt
    WHERE coalesce(trim(wt."transactionId"), '') <> ''
),
ranked AS (
    SELECT
        c.*,
        row_number() OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
            ORDER BY c."createdDate" ASC, c.id ASC
        ) AS row_in_group,
        count(*) OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
        ) AS group_size,
        first_value(c.id) OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
            ORDER BY c."createdDate" ASC, c.id ASC
        ) AS keep_id,
        first_value(c."createdDate") OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
            ORDER BY c."createdDate" ASC, c.id ASC
        ) AS keep_created_at
    FROM classified c
    WHERE c.kind = 'refund_credit'
)
SELECT
    r."transactionId" AS booking_tx_id,
    r."userId" AS auth_user_id,
    r.type,
    r.amount,
    r.keep_id,
    r.keep_created_at,
    r.id AS delete_id,
    r."createdDate" AS delete_created_at,
    r.note AS delete_note
FROM ranked r
WHERE r.group_size > 1
  AND r.row_in_group > 1
ORDER BY r."transactionId", r."createdDate";


-- ---------------------------------------------------------------------------
-- 4) Exact IDs to delete (refund duplicates) — copy/paste review list
-- ---------------------------------------------------------------------------
WITH classified AS (
    SELECT
        wt.id,
        wt."createdDate",
        wt."userId",
        wt."transactionId",
        wt."isCredit",
        wt.amount,
        wt.note,
        CASE
            WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%refund%' THEN 'refund_credit'
            ELSE 'other'
        END AS kind
    FROM public.wallet_transaction wt
    WHERE coalesce(trim(wt."transactionId"), '') <> ''
),
ranked AS (
    SELECT
        c.*,
        row_number() OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
            ORDER BY c."createdDate" ASC, c.id ASC
        ) AS row_in_group,
        count(*) OVER (
            PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
        ) AS group_size
    FROM classified c
    WHERE c.kind = 'refund_credit'
)
SELECT
    r.id AS wallet_row_id_to_delete,
    r."transactionId",
    r."userId",
    r.amount,
    r."createdDate",
    r.note
FROM ranked r
WHERE r.group_size > 1
  AND r.row_in_group > 1
ORDER BY r."transactionId", r."createdDate";


-- ---------------------------------------------------------------------------
-- 5) OPTIONAL DELETE (uncomment only after reviewing query #4)
-- ---------------------------------------------------------------------------
-- BEGIN;
--
-- WITH classified AS (
--     SELECT
--         wt.id,
--         wt."createdDate",
--         wt."userId",
--         wt."transactionId",
--         wt."isCredit",
--         CASE
--             WHEN wt."isCredit" = true AND lower(coalesce(wt.note, '')) LIKE '%refund%' THEN 'refund_credit'
--             ELSE 'other'
--         END AS kind
--     FROM public.wallet_transaction wt
--     WHERE coalesce(trim(wt."transactionId"), '') <> ''
-- ),
-- ranked AS (
--     SELECT
--         c.id,
--         row_number() OVER (
--             PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
--             ORDER BY c."createdDate" ASC, c.id ASC
--         ) AS row_in_group,
--         count(*) OVER (
--             PARTITION BY c."transactionId", c."userId", c."isCredit", c.kind
--         ) AS group_size
--     FROM classified c
--     WHERE c.kind = 'refund_credit'
-- ),
-- to_delete AS (
--     SELECT id FROM ranked WHERE group_size > 1 AND row_in_group > 1
-- )
-- DELETE FROM public.wallet_transaction wt
-- USING to_delete d
-- WHERE wt.id = d.id
-- RETURNING wt.id, wt."transactionId", wt.note, wt.amount;
--
-- COMMIT;
