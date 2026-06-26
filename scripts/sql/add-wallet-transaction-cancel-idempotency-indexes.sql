CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_cancel_refund_once
ON public.wallet_transaction ("transactionId", "userId")
WHERE "isCredit" = true
  AND lower(coalesce(note, '')) LIKE '%cancel refund%';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_provider_cancel_debit_once
ON public.wallet_transaction ("transactionId", "userId")
WHERE "isCredit" = false
  AND lower(coalesce(note, '')) LIKE '%cancel%'
  AND lower(coalesce(note, '')) NOT LIKE '%refund%';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_admin_commission_refund_once
ON public.wallet_transaction ("transactionId", "userId")
WHERE lower(coalesce(note, '')) LIKE '%admin commission refund%';
