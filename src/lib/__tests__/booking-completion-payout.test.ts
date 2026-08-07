import { describe, expect, it } from 'vitest';
import {
    bookingGrossAmount,
    completionPayoutNote,
    completionPayoutReversalNote,
    completionPayoutReversalTxId,
    computeProviderPayoutAmount,
    isProviderCompletionPayoutCredit,
    isProviderCompletionPayoutReversal,
    nextCompletionPayoutReversalSequence,
    providerCompletionNetOutstanding,
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

    it('can credit full service amount without commission', () => {
        expect(
            computeProviderPayoutAmount(12425, { value: 10, isFix: false, active: true }, false)
        ).toBe(12425);
        expect(
            computeProviderPayoutAmount(12425, { value: 10, isFix: false, active: true }, true)
        ).toBe(11182.5);
    });

    it('builds mobile-shaped note from booking id prefix', () => {
        expect(completionPayoutNote('95bb9a66-b425-4c58-b10f-374fb7dcb07f')).toBe(
            'Order #95bb9a completed (payout after admin commission)'
        );
        expect(completionPayoutNote('95bb9a66-b425-4c58-b10f-374fb7dcb07f', false)).toBe(
            'Order #95bb9a completed (full service amount)'
        );
    });

    it('reads gross from totalAmount then price', () => {
        expect(bookingGrossAmount({ totalAmount: 11.12, price: 50 })).toBe(11.12);
        expect(bookingGrossAmount({ totalAmount: 0, price: 50 })).toBe(50);
    });

    it('builds stable reversal transaction ids', () => {
        const bookingId = '95bb9a66-b425-4c58-b10f-374fb7dcb07f';
        expect(completionPayoutReversalTxId(bookingId)).toBe(`reversal-payout-${bookingId}`);
        expect(completionPayoutReversalTxId(bookingId, 2)).toBe(`reversal-payout-${bookingId}-2`);
        expect(completionPayoutReversalNote(bookingId)).toContain(bookingId);
    });

    it('detects completion payout credits by note', () => {
        expect(
            isProviderCompletionPayoutCredit({
                isCredit: true,
                note: 'Order #95bb9a completed (payout after admin commission)',
            })
        ).toBe(true);
        expect(
            isProviderCompletionPayoutCredit({
                isCredit: false,
                note: 'Order #95bb9a completed (payout after admin commission)',
            })
        ).toBe(false);
        expect(
            isProviderCompletionPayoutCredit({
                isCredit: true,
                note: 'Order #b30cc6 completed with extra payment',
            })
        ).toBe(true);
        expect(
            isProviderCompletionPayoutCredit({
                isCredit: true,
                note: 'Admin reversal: completion payout',
            })
        ).toBe(false);
    });

    it('treats completion credit as outstanding until clawed back', () => {
        const bookingId = '95bb9a66-b425-4c58-b10f-374fb7dcb07f';
        const credit = {
            isCredit: true as const,
            note: completionPayoutNote(bookingId),
            transactionId: bookingId,
            amount: '10.01',
        };
        const reversal = {
            isCredit: false as const,
            note: completionPayoutReversalNote(bookingId),
            transactionId: completionPayoutReversalTxId(bookingId),
            amount: '10.01',
        };
        const reversal2 = {
            isCredit: false as const,
            note: completionPayoutReversalNote(bookingId),
            transactionId: completionPayoutReversalTxId(bookingId, 2),
            amount: '10.01',
        };

        expect(providerCompletionNetOutstanding(bookingId, [])).toBe(false);
        expect(providerCompletionNetOutstanding(bookingId, [credit])).toBe(true);
        expect(providerCompletionNetOutstanding(bookingId, [credit, reversal])).toBe(false);
        expect(providerCompletionNetOutstanding(bookingId, [credit, reversal, credit])).toBe(true);
        expect(providerCompletionNetOutstanding(bookingId, [credit, reversal, credit, reversal2])).toBe(false);
        expect(isProviderCompletionPayoutReversal(bookingId, reversal2)).toBe(true);
        expect(nextCompletionPayoutReversalSequence(bookingId, [credit, reversal])).toBe(2);
    });
});
