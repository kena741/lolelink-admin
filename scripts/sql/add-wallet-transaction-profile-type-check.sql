-- Step 3 (optional): Add CHECK only after diagnose query returns 0 violations.
-- Run diagnose-wallet-transaction-profile-violations.sql first.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.wallet_transaction wt
        WHERE (
                lower(coalesce(wt.type, '')) = 'customer'
                AND (wt.customer_id IS NULL OR wt.provider_id IS NOT NULL)
            )
            OR (
                lower(coalesce(wt.type, '')) IN ('provider', 'provider_payout')
                AND (wt.provider_id IS NULL OR wt.customer_id IS NOT NULL)
            )
    ) THEN
        RAISE EXCEPTION
            'Cannot add wallet_transaction_profile_type_check: orphan or mismatched rows still exist. Run diagnose-wallet-transaction-profile-violations.sql';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transaction_profile_type_check'
    ) THEN
        ALTER TABLE public.wallet_transaction
            ADD CONSTRAINT wallet_transaction_profile_type_check
            CHECK (
                lower(coalesce(type, '')) NOT IN ('customer', 'provider', 'provider_payout')
                OR (
                    lower(coalesce(type, '')) = 'customer'
                    AND customer_id IS NOT NULL
                    AND provider_id IS NULL
                )
                OR (
                    lower(coalesce(type, '')) IN ('provider', 'provider_payout')
                    AND provider_id IS NOT NULL
                    AND customer_id IS NULL
                )
            );
    END IF;
END $$;
