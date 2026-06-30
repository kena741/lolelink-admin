import { describe, expect, it } from 'vitest';
import {
    calculateWithdrawalPayoutBreakdown,
    CHAPA_WITHDRAWAL_FEE_RATE,
} from '@/lib/withdrawal-payout';

describe('calculateWithdrawalPayoutBreakdown', () => {
    it('deducts 2.5% chapa fee from the requested withdrawal amount', () => {
        const breakdown = calculateWithdrawalPayoutBreakdown(300);
        expect(CHAPA_WITHDRAWAL_FEE_RATE).toBe(0.025);
        expect(breakdown.grossAmount).toBe(300);
        expect(breakdown.chapaFee).toBe(7.5);
        expect(breakdown.netTransferAmount).toBe(292.5);
    });

    it('rounds fee and net to two decimals', () => {
        const breakdown = calculateWithdrawalPayoutBreakdown('75.06');
        expect(breakdown.chapaFee).toBe(1.88);
        expect(breakdown.netTransferAmount).toBe(73.18);
    });
});
