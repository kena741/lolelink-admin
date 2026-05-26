import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCustomerWalletTopUpTransactionId } from '@/lib/wallet-transaction-metrics';

interface WalletCreditRow {
    transactionId?: string | null;
    isCredit?: boolean | null;
}

export interface PriorCustomerWalletTopUp {
    transactionId: string;
}

export async function findPriorCustomerWalletTopUp(
    admin: SupabaseClient,
    userId: string
): Promise<PriorCustomerWalletTopUp | null> {
    const { data, error } = await admin
        .from('wallet_transaction')
        .select('transactionId, isCredit')
        .eq('userId', userId)
        .eq('isCredit', true);

    if (error || !data) return null;

    for (const row of data as WalletCreditRow[]) {
        const transactionId = row.transactionId;
        if (transactionId && hasCustomerWalletTopUpTransactionId(transactionId)) {
            return { transactionId };
        }
    }

    return null;
}
