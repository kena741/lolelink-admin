import { describe, expect, it } from 'vitest';
import {
    parseWalletTransactionEvent,
    resolveWalletPaymentDisplayLabel,
} from '@/lib/wallet-transaction-display';
import { getDefaultWalletColumnVisibility, loadWalletColumnVisibility } from '@/lib/wallet-transaction-columns';

describe('parseWalletTransactionEvent', () => {
    it('detects provider booking payout credits', () => {
        expect(
            parseWalletTransactionEvent({
                note: 'Order #c9aedf completed (payout after admin commission)',
                isCredit: true,
                type: 'provider',
            })
        ).toBe('booking_payout');
    });

    it('detects cancel refunds', () => {
        expect(
            parseWalletTransactionEvent({
                note: 'Order #1f43e8 cancel refund',
                isCredit: true,
                type: 'customer',
            })
        ).toBe('booking_cancel_refund');
    });

    it('detects decline fees', () => {
        expect(
            parseWalletTransactionEvent({
                note: 'Order #ef2eb8 decline — provider gateway fee (0.19 ETB)',
                isCredit: false,
                type: 'provider',
            })
        ).toBe('decline_fee');
    });
});

describe('resolveWalletPaymentDisplayLabel', () => {
    it('shows wallet credit for provider payout rows', () => {
        expect(
            resolveWalletPaymentDisplayLabel({
                paymentType: 'Chapa',
                note: 'Order #c9aedf completed (payout after admin commission)',
                isCredit: true,
                type: 'provider',
            })
        ).toBe('Wallet credit');
    });

    it('keeps original payment label for customer rows', () => {
        expect(
            resolveWalletPaymentDisplayLabel({
                paymentType: 'wallet',
                note: 'Order #cf7d20',
                isCredit: true,
                type: 'customer',
            })
        ).toBe('Wallet');
    });
});

describe('wallet transaction column visibility', () => {
    it('hides user, service, and booking total by default', () => {
        const defaults = getDefaultWalletColumnVisibility();
        expect(defaults.user).toBe(false);
        expect(defaults.service).toBe(false);
        expect(defaults.bookingTotal).toBe(false);
        expect(defaults.event).toBe(true);
    });

    it('falls back to defaults when localStorage is unavailable', () => {
        expect(loadWalletColumnVisibility().date).toBe(true);
    });
});
