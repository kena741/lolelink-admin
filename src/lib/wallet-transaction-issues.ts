import { parseWalletTransactionEvent } from '@/lib/wallet-transaction-display';
import { walletTransactionMagnitude } from '@/lib/wallet-transaction-metrics';
import { isCustomerWalletTransactionType } from '@/lib/wallet-transaction-user';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';

export interface WalletTransactionIssue {
    id: string;
    severity: 'error' | 'warning';
    label: string;
    detail?: string;
}

const LARGE_PAYOUT_CREDIT_ETB = 1000;
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

function buildRowsByTransactionId(items: WalletTransaction[]): Map<string, WalletTransaction[]> {
    const rowsByTransactionId = new Map<string, WalletTransaction[]>();

    for (const item of items) {
        const transactionId = item.transactionId.trim().toLowerCase();
        if (!transactionId) continue;

        const existing = rowsByTransactionId.get(transactionId) ?? [];
        existing.push(item);
        rowsByTransactionId.set(transactionId, existing);
    }

    return rowsByTransactionId;
}

function isExpectedBookingSharedTransactionId(
    sharedUsers: Set<string>,
    rowsForTransactionId: WalletTransaction[]
): boolean {
    if (sharedUsers.size !== 2) return false;

    const [userA, userB] = [...sharedUsers];

    for (const row of rowsForTransactionId) {
        const customerIds = new Set<string>();
        const providerIds = new Set<string>();

        for (const value of [
            row.bookingCustomerUserId,
            row.bookingCustomerId,
            row.customerProfileId,
            row.customer_id,
        ]) {
            const normalized = value?.trim().toLowerCase();
            if (normalized) customerIds.add(normalized);
        }

        for (const value of [
            row.bookingProviderUserId,
            row.bookingProviderId,
            row.providerProfileId,
            row.provider_id,
        ]) {
            const normalized = value?.trim().toLowerCase();
            if (normalized) providerIds.add(normalized);
        }

        if (customerIds.size === 0 || providerIds.size === 0) continue;

        const aIsCustomer = customerIds.has(userA);
        const aIsProvider = providerIds.has(userA);
        const bIsCustomer = customerIds.has(userB);
        const bIsProvider = providerIds.has(userB);

        if ((aIsCustomer && bIsProvider) || (aIsProvider && bIsCustomer)) {
            return true;
        }
    }

    return false;
}

export function getWalletTransactionIssues(
    item: WalletTransaction,
    sharedTransactionUsers: Map<string, Set<string>>,
    rowsByTransactionId: Map<string, WalletTransaction[]>
): WalletTransactionIssue[] {
    const issues: WalletTransactionIssue[] = [];
    const type = item.type.trim().toLowerCase();
    const rawAmount = Number.parseFloat(item.amount);
    const magnitude = walletTransactionMagnitude(item.amount);
    const transactionId = item.transactionId.trim();
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
    const rowsForTransactionId = transactionId
        ? rowsByTransactionId.get(transactionId.toLowerCase()) ?? []
        : [];
    if (
        sharedUsers &&
        sharedUsers.size > 1 &&
        !isExpectedBookingSharedTransactionId(sharedUsers, rowsForTransactionId)
    ) {
        issues.push({
            id: 'shared-transaction-id',
            severity: 'warning',
            label: `Transaction id shared by ${sharedUsers.size} different accounts`,
            detail:
                'The same reference appears on wallet rows for more than one user. That is expected when a booking has both a customer wallet entry and a provider payout, but unusual for withdrawals, fees, or duplicate rows.',
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
                label: `Provider payout is ETB ${magnitude.toFixed(2)}`,
                detail: `Credits of ETB ${LARGE_PAYOUT_CREDIT_ETB} or more are highlighted for a quick review. A larger completed job can be normal — this is not automatically wrong.`,
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
    const rowsByTransactionId = buildRowsByTransactionId(items);

    return items.map((item) => ({
        ...item,
        issues: getWalletTransactionIssues(item, sharedTransactionUsers, rowsByTransactionId),
    }));
}

export function countWalletTransactionsWithIssues(items: WalletTransaction[]): number {
    return items.filter((item) => (item.issues?.length ?? 0) > 0).length;
}

const ISSUE_SHORT_LABELS: Record<string, string> = {
    'negative-amount-stored': 'Negative amount',
    'zero-amount': 'Zero amount',
    'missing-user-id': 'No user id',
    'profile-id-as-user-id': 'Profile as userId',
    'customer-missing-profile': 'No customer profile',
    'customer-has-provider-profile': 'Extra provider id',
    'provider-missing-profile': 'No provider profile',
    'provider-has-customer-profile': 'Extra customer id',
    'shared-transaction-id': 'Shared txn id',
    'unlinked-payout': 'Unlinked payout',
    'payout-not-completed': 'Payout not completed',
    'self-booking-payout': 'Self-booking payout',
    'payout-exceeds-booking': 'Payout too high',
    'large-payout': 'Large payout',
    'large-fee-debit': 'Large fee',
    'payout-missing-customer': 'No customer link',
};

const ISSUE_CATEGORY_LABELS: Record<string, string> = {
    'negative-amount-stored': 'Ledger',
    'zero-amount': 'Ledger',
    'missing-user-id': 'Identity',
    'profile-id-as-user-id': 'Identity',
    'customer-missing-profile': 'Profile',
    'customer-has-provider-profile': 'Profile',
    'provider-missing-profile': 'Profile',
    'provider-has-customer-profile': 'Profile',
    'shared-transaction-id': 'Cross-row',
    'unlinked-payout': 'Booking',
    'payout-not-completed': 'Booking',
    'self-booking-payout': 'Booking',
    'payout-exceeds-booking': 'Booking',
    'large-payout': 'Amount',
    'large-fee-debit': 'Amount',
    'payout-missing-customer': 'Booking',
};

export function formatWalletTransactionIssueShortLabel(id: string): string {
    return ISSUE_SHORT_LABELS[id] ?? 'Issue';
}

export function getWalletTransactionIssueCategoryLabel(id: string): string {
    return ISSUE_CATEGORY_LABELS[id] ?? 'Data';
}

export function groupWalletTransactionIssuesBySeverity(
    issues: WalletTransactionIssue[]
): Array<{ severity: WalletTransactionIssue['severity']; label: string; items: WalletTransactionIssue[] }> {
    const order: WalletTransactionIssue['severity'][] = ['error', 'warning'];
    const grouped = new Map<WalletTransactionIssue['severity'], WalletTransactionIssue[]>();

    for (const issue of issues) {
        const existing = grouped.get(issue.severity) ?? [];
        existing.push(issue);
        grouped.set(issue.severity, existing);
    }

    return order
        .filter((severity) => grouped.has(severity))
        .map((severity) => ({
            severity,
            label: severity === 'error' ? 'Critical' : 'Warning',
            items: grouped.get(severity) ?? [],
        }));
}
