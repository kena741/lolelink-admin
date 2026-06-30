import { parseWalletTransactionEvent } from '@/lib/wallet-transaction-display';
import { walletTransactionMagnitude } from '@/lib/wallet-transaction-metrics';
import { isCustomerWalletTransactionType } from '@/lib/wallet-transaction-user';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';

export interface WalletTransactionIssue {
    id: string;
    severity: 'error' | 'warning';
    label: string;
}

const LARGE_PAYOUT_CREDIT_ETB = 20;
const LARGE_FEE_DEBIT_ETB = 50;

function isProviderWalletType(type: string): boolean {
    const normalized = type.trim().toLowerCase();
    return normalized === 'provider' || normalized === 'provider_payout';
}

function isJobPayoutNote(note: string): boolean {
    const normalized = note.toLowerCase();
    return normalized.includes('completed (payout') || normalized.includes('payout after admin commission');
}

function buildSharedTransactionIdUserIds(items: WalletTransaction[]): Map<string, Set<string>> {
    const usersByTransactionId = new Map<string, Set<string>>();

    for (const item of items) {
        const transactionId = item.transactionId.trim().toLowerCase();
        const userId = (item.authUserId || item.userId).trim().toLowerCase();
        if (!transactionId || !userId) continue;

        const existing = usersByTransactionId.get(transactionId) ?? new Set<string>();
        existing.add(userId);
        usersByTransactionId.set(transactionId, existing);
    }

    return usersByTransactionId;
}

export function getWalletTransactionIssues(
    item: WalletTransaction,
    sharedTransactionUsers: Map<string, Set<string>>
): WalletTransactionIssue[] {
    const issues: WalletTransactionIssue[] = [];
    const type = item.type.trim().toLowerCase();
    const rawAmount = Number.parseFloat(item.amount);
    const magnitude = walletTransactionMagnitude(item.amount);
    const transactionId = item.transactionId.trim();
    const authUserId = (item.authUserId || item.userId).trim().toLowerCase();
    const customerProfileId = (item.customerProfileId || item.customer_id).trim();
    const providerProfileId = (item.providerProfileId || item.provider_id).trim();
    const event = item.walletEvent || parseWalletTransactionEvent(item);

    if (Number.isFinite(rawAmount) && rawAmount < 0) {
        issues.push({
            id: 'negative-amount-stored',
            severity: 'error',
            label: 'Negative amount stored on ledger row',
        });
    }

    if (magnitude < 0.005) {
        issues.push({
            id: 'zero-amount',
            severity: 'warning',
            label: 'Zero or negligible amount',
        });
    }

    if (!item.userId.trim()) {
        issues.push({
            id: 'missing-user-id',
            severity: 'error',
            label: 'Missing ledger user id',
        });
    }

    if (item.userIdStoredAsProfile) {
        issues.push({
            id: 'profile-id-as-user-id',
            severity: 'warning',
            label: 'Ledger userId matches profile id, not auth user',
        });
    }

    if (isCustomerWalletTransactionType(type)) {
        if (!customerProfileId) {
            issues.push({
                id: 'customer-missing-profile',
                severity: 'error',
                label: 'Customer transaction missing customer profile',
            });
        }
        if (providerProfileId) {
            issues.push({
                id: 'customer-has-provider-profile',
                severity: 'warning',
                label: 'Customer transaction also has provider profile id',
            });
        }
    }

    if (isProviderWalletType(type)) {
        if (!providerProfileId) {
            issues.push({
                id: 'provider-missing-profile',
                severity: 'error',
                label: 'Provider transaction missing provider profile',
            });
        }
        if (customerProfileId) {
            issues.push({
                id: 'provider-has-customer-profile',
                severity: 'warning',
                label: 'Provider transaction also has customer profile id',
            });
        }
    }

    const sharedUsers = transactionId ? sharedTransactionUsers.get(transactionId.toLowerCase()) : undefined;
    if (sharedUsers && sharedUsers.size > 1) {
        issues.push({
            id: 'shared-transaction-id',
            severity: 'warning',
            label: 'Same transaction id used across multiple users',
        });
    }

    if (event === 'booking_payout' || isJobPayoutNote(item.note)) {
        if (!item.bookingStatus) {
            issues.push({
                id: 'unlinked-payout',
                severity: 'warning',
                label: 'Payout credit is not linked to a booking row',
            });
        } else if (item.bookingStatus !== 'completed') {
            issues.push({
                id: 'payout-not-completed',
                severity: 'warning',
                label: `Payout on booking with status "${item.bookingStatus}"`,
            });
        }

        const bookingCustomerAuth = item.bookingCustomerUserId?.trim().toLowerCase() ?? '';
        const bookingProviderAuth = item.bookingProviderUserId?.trim().toLowerCase() ?? '';
        if (
            (bookingCustomerAuth &&
                bookingProviderAuth &&
                bookingCustomerAuth === bookingProviderAuth) ||
            (item.bookingCustomerId &&
                item.bookingProviderId &&
                item.bookingCustomerId === item.bookingProviderId)
        ) {
            issues.push({
                id: 'self-booking-payout',
                severity: 'error',
                label: 'Payout linked to a self-booking',
            });
        }

        if (
            item.bookingTotalAmount !== null &&
            item.bookingTotalAmount > 0 &&
            magnitude > item.bookingTotalAmount * 1.05
        ) {
            issues.push({
                id: 'payout-exceeds-booking',
                severity: 'error',
                label: 'Payout amount exceeds booking total',
            });
        }

        if (item.isCredit && magnitude >= LARGE_PAYOUT_CREDIT_ETB) {
            issues.push({
                id: 'large-payout',
                severity: 'warning',
                label: 'Large provider payout credit',
            });
        }
    }

    if (event === 'decline_fee' && !item.isCredit && magnitude >= LARGE_FEE_DEBIT_ETB) {
        issues.push({
            id: 'large-fee-debit',
            severity: 'warning',
            label: 'Unusually large fee debit',
        });
    }

    if (event === 'booking_payout' && !item.bookingCustomerName && !item.customerName) {
        issues.push({
            id: 'payout-missing-customer',
            severity: 'warning',
            label: 'Payout row has no linked customer',
        });
    }

    return issues;
}

export function attachWalletTransactionIssues(items: WalletTransaction[]): WalletTransaction[] {
    const sharedTransactionUsers = buildSharedTransactionIdUserIds(items);

    return items.map((item) => ({
        ...item,
        issues: getWalletTransactionIssues(item, sharedTransactionUsers),
    }));
}

export function countWalletTransactionsWithIssues(items: WalletTransaction[]): number {
    return items.filter((item) => (item.issues?.length ?? 0) > 0).length;
}
