import { describe, expect, it } from 'vitest';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';
import {
    attachWalletTransactionIssues,
    getWalletTransactionIssues,
} from '@/lib/wallet-transaction-issues';

function baseRow(overrides: Partial<WalletTransaction> = {}): WalletTransaction {
    return {
        id: 'row-1',
        amount: '5.00',
        createdDate: '2026-06-29T10:00:00Z',
        isCredit: true,
        note: 'Order #cf7d20 completed (payout after admin commission)',
        paymentType: 'wallet',
        paymentDisplayLabel: 'Wallet credit',
        transactionId: 'cf7d20c0-0000-0000-0000-000000001798',
        type: 'provider',
        userId: 'auth-1',
        authUserId: 'auth-1',
        userIdStoredAsProfile: false,
        provider_id: 'provider-1',
        customer_id: '',
        providerProfileId: 'provider-1',
        providerName: 'Fozia Kassa',
        providerEmail: 'provider@example.com',
        providerPhone: '911111111',
        customerProfileId: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        authUserName: 'Fozia Kassa',
        authUserEmail: 'provider@example.com',
        authUserPhone: '911111111',
        bookingServiceName: 'Catering',
        bookingCustomerName: 'Fizia Kassa',
        bookingTotalAmount: 75.06,
        bookingAdminCommission: 0,
        bookingStatus: 'completed',
        bookingCustomerId: 'customer-1',
        bookingProviderId: 'provider-1',
        bookingCustomerUserId: 'auth-2',
        bookingProviderUserId: 'auth-1',
        walletEvent: 'booking_payout',
        walletEventLabel: 'Booking payout',
        issues: [],
        ...overrides,
    };
}

describe('getWalletTransactionIssues', () => {
    it('flags profile id stored as user id', () => {
        const issues = getWalletTransactionIssues(
            baseRow({ userIdStoredAsProfile: true }),
            new Map()
        );
        expect(issues.some((issue) => issue.id === 'profile-id-as-user-id')).toBe(true);
    });

    it('flags shared transaction ids across users', () => {
        const shared = new Map([['tx-1', new Set(['auth-1', 'auth-2'])]]);
        const issues = getWalletTransactionIssues(
            baseRow({ transactionId: 'tx-1' }),
            shared
        );
        expect(issues.some((issue) => issue.id === 'shared-transaction-id')).toBe(true);
    });

    it('flags self-booking payouts', () => {
        const issues = getWalletTransactionIssues(
            baseRow({
                bookingCustomerUserId: 'auth-1',
                bookingProviderUserId: 'auth-1',
            }),
            new Map()
        );
        expect(issues.some((issue) => issue.id === 'self-booking-payout')).toBe(true);
    });

    it('returns no issues for a clean payout row', () => {
        const issues = getWalletTransactionIssues(baseRow(), new Map());
        expect(issues).toEqual([]);
    });
});

describe('attachWalletTransactionIssues', () => {
    it('annotates rows with issue arrays', () => {
        const rows = attachWalletTransactionIssues([
            baseRow({ id: 'a', transactionId: 'shared-tx' }),
            baseRow({
                id: 'b',
                transactionId: 'shared-tx',
                authUserId: 'auth-2',
                userId: 'auth-2',
            }),
        ]);

        expect(rows[0]?.issues.some((issue) => issue.id === 'shared-transaction-id')).toBe(true);
        expect(rows[1]?.issues.some((issue) => issue.id === 'shared-transaction-id')).toBe(true);
    });
});
