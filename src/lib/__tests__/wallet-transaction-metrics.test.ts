import { describe, expect, it } from 'vitest';
import {
    isDirectPaymentCredit,
    sumDirectPaymentCredits,
    sumNonChapaNetFlow,
    type WalletTransactionMetricRow,
} from '@/lib/wallet-transaction-metrics';

function row(partial: Partial<WalletTransactionMetricRow>): WalletTransactionMetricRow {
    return partial;
}

describe('direct payment credits', () => {
    it('counts non-Chapa credits but not debits', () => {
        const rows = [
            row({ isCredit: true, amount: '100', paymentType: 'manual', note: 'Activation fee' }),
            row({ isCredit: false, amount: '50', paymentType: 'cash', note: 'Booking debit' }),
        ];

        expect(sumDirectPaymentCredits(rows)).toBe(100);
        expect(sumNonChapaNetFlow(rows)).toBe(50);
    });

    it('excludes Chapa-tagged credits', () => {
        const rows = [
            row({ isCredit: true, amount: '80', paymentType: 'chapa', note: 'Booking payment' }),
            row({ isCredit: true, amount: '20', paymentType: 'manual', note: 'Cash activation' }),
        ];

        expect(sumDirectPaymentCredits(rows)).toBe(20);
    });

    it('excludes provider job payout credits', () => {
        const rows = [
            row({ isCredit: true, amount: '300', paymentType: 'cash', note: 'Completed (payout) booking #abc' }),
            row({ isCredit: true, amount: '40', paymentType: 'manual', note: 'Manual activation' }),
        ];

        expect(sumDirectPaymentCredits(rows)).toBe(40);
        expect(isDirectPaymentCredit(rows[0])).toBe(false);
        expect(isDirectPaymentCredit(rows[1])).toBe(true);
    });

    it('stays non-negative when debits exceed non-payout credits', () => {
        const rows = [
            row({ isCredit: true, amount: '10', paymentType: 'manual', note: 'Manual top up' }),
            row({ isCredit: false, amount: '280', paymentType: 'cash', note: 'Customer booking debit' }),
            row({ isCredit: false, amount: '2.59', paymentType: 'cash', note: 'Withdrawal deduction' }),
        ];

        expect(sumDirectPaymentCredits(rows)).toBe(10);
        expect(sumNonChapaNetFlow(rows)).toBe(-272.59);
    });
});
