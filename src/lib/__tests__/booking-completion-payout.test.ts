import { describe, expect, it } from 'vitest';
import {
    bookingGrossAmount,
    completionPayoutNote,
    computeProviderPayoutAmount,
} from '@/lib/booking-completion-payout';

describe('booking-completion-payout', () => {
    it('computes 10% commission like mobile ledger rows', () => {
        expect(computeProviderPayoutAmount(11.12, { value: 10, isFix: false })).toBe(10.01);
        expect(computeProviderPayoutAmount(83.4, { value: 10, isFix: false })).toBe(75.06);
        expect(computeProviderPayoutAmount(1.11, { value: 10, isFix: false })).toBe(1);
    });

    it('supports fixed commission', () => {
        expect(computeProviderPayoutAmount(100, { value: 15, isFix: true })).toBe(85);
    });

    it('builds mobile-shaped note from booking id prefix', () => {
        expect(completionPayoutNote('95bb9a66-b425-4c58-b10f-374fb7dcb07f')).toBe(
            'Order #95bb9a completed (payout after admin commission)'
        );
    });

    it('reads gross from totalAmount then price', () => {
        expect(bookingGrossAmount({ totalAmount: 11.12, price: 50 })).toBe(11.12);
        expect(bookingGrossAmount({ totalAmount: 0, price: 50 })).toBe(50);
    });
});
