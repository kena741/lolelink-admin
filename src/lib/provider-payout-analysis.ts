import { BOOKING_PAYMENT_STATUS, resolveBookingPaymentStatus } from '@/lib/booking-status';
import { hasBookingCustomerRefund, parseBookingAmount } from '@/lib/booking-display';
import { isActivationCredit, walletTransactionMagnitude } from '@/lib/wallet-transaction-metrics';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export type PayoutAnalysisRisk = 'clean' | 'review' | 'high';
export type PayoutAnalysisReviewMode = 'active' | 'transfer_pending' | 'historical';

export interface PayoutAnalysisFinding {
    id: string;
    severity: 'info' | 'warning' | 'error';
    label: string;
    detail?: string;
    amount?: number;
}

export interface ProviderWalletTransactionLine {
    id: string;
    createdDate: string | null;
    isCredit: boolean;
    amount: number;
    paymentType: string | null;
    note: string | null;
    category: 'activation' | 'legitimate_payout' | 'suspicious_payout' | 'erroneous_payout' | 'withdrawal' | 'decline_fee' | 'other';
    bookingId?: string;
}

export interface ProviderPayoutAnalysis {
    providerId: string;
    providerName: string;
    providerEmail: string | null;
    storedWalletAmount: number;
    ledgerNet: number;
    ledgerMatchesStored: boolean;
    breakdown: {
        activationCredits: number;
        legitimateJobPayouts: number;
        suspiciousJobPayouts: number;
        erroneousPayouts: number;
        otherCredits: number;
        withdrawals: number;
        declineFees: number;
        otherDebits: number;
    };
    defensibleBalance: number;
    planMinimumRetainedBalance: number | null;
    postWithdrawalBalance: number | null;
    requestedWithdrawalAmount: number | null;
    withdrawalCoversRequest: boolean | null;
    risk: PayoutAnalysisRisk;
    riskLabel: string;
    reviewMode: PayoutAnalysisReviewMode;
    withdrawalStatus: string | null;
    findings: PayoutAnalysisFinding[];
    transactions: ProviderWalletTransactionLine[];
    stats: {
        completedBookings: number;
        rejectedPaidWithoutRefund: number;
    };
}

interface WalletRow {
    id: string;
    amount?: string | number | null;
    isCredit?: boolean | null;
    note?: string | null;
    paymentType?: string | null;
    transactionId?: string | null;
    createdDate?: string | null;
}

interface BookingRow {
    id: string;
    customer_id?: string | null;
    customer_user_id?: string | null;
    status?: string | null;
    totalAmount?: string | number | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
}

interface CustomerRow {
    id: string;
    user_id?: string | null;
}

interface CustomerWalletRow {
    userId?: string | null;
    isCredit?: boolean | null;
    note?: string | null;
    transactionId?: string | null;
}

function parseAmount(value: unknown): number {
    const parsed = parseBookingAmount(value);
    return parsed ?? 0;
}

function findLinkedBookingId(note: string, transactionId: string, bookings: BookingRow[]): string | null {
    const normalizedNote = note.toLowerCase();
    const normalizedTx = transactionId.toLowerCase();

    for (const booking of bookings) {
        const id = booking.id.toLowerCase();
        const short6 = id.slice(0, 6);
        const short8 = id.slice(0, 8);
        if (
            normalizedNote.includes(id)
            || normalizedTx.includes(id)
            || normalizedNote.includes(`order #${short6}`)
            || normalizedNote.includes(`order #${short8}`)
            || normalizedNote.includes(short8)
        ) {
            return booking.id;
        }
    }

    return null;
}

function isJobPayoutCredit(note: string): boolean {
    const normalized = note.toLowerCase();
    return normalized.includes('completed (payout') || normalized.includes('payout after admin commission');
}

function isWithdrawalDebit(note: string): boolean {
    return note.toLowerCase().includes('withdrawal payout');
}

function isDeclineFeeDebit(note: string): boolean {
    const normalized = note.toLowerCase();
    return normalized.includes('decline') || normalized.includes('gateway fee');
}

function isErroneousPayoutReversalDebit(note: string): boolean {
    const normalized = note.toLowerCase();
    return normalized.includes('admin reversal') && normalized.includes('erroneous completion payout');
}

function parseBookingIdFromReversalNote(note: string): string | null {
    const match = note.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match?.[0] ?? null;
}

function classifyJobPayout(
    amount: number,
    booking: BookingRow | null,
    providerUserId: string | null,
    customerUserIdByCustomerId: Map<string, string | null>
): 'legitimate_payout' | 'suspicious_payout' | 'erroneous_payout' {
    if (!booking) return 'suspicious_payout';

    const bookingTotal = parseAmount(booking.totalAmount);
    const customerUserId = booking.customer_id
        ? customerUserIdByCustomerId.get(booking.customer_id) ?? null
        : null;

    if (bookingTotal < 0) return 'erroneous_payout';
    if (providerUserId && customerUserId && providerUserId === customerUserId) return 'suspicious_payout';
    if (booking.status !== 'completed') return 'suspicious_payout';
    if (bookingTotal > 0 && amount > bookingTotal * 1.05) return 'erroneous_payout';

    return 'legitimate_payout';
}

function resolveRisk(
    findings: PayoutAnalysisFinding[],
    defensibleBalance: number,
    requestedAmount: number | null,
    reviewMode: PayoutAnalysisReviewMode
): { risk: PayoutAnalysisRisk; riskLabel: string } {
    if (reviewMode === 'historical') {
        const hasError = findings.some((item) => item.severity === 'error');
        const hasWarning = findings.some((item) => item.severity === 'warning');
        if (hasError || hasWarning) {
            return {
                risk: 'review',
                riskLabel: 'Historical wallet notes — payout already processed',
            };
        }
        return { risk: 'clean', riskLabel: 'Payout completed — no outstanding wallet issues' };
    }

    if (reviewMode === 'transfer_pending') {
        const hasError = findings.some((item) => item.severity === 'error');
        if (hasError) {
            return {
                risk: 'review',
                riskLabel: 'Transfer submitted — verify with Chapa to complete payout',
            };
        }
        return {
            risk: 'review',
            riskLabel: 'Transfer submitted — awaiting Chapa confirmation',
        };
    }

    const hasError = findings.some((item) => item.severity === 'error');
    const hasWarning = findings.some((item) => item.severity === 'warning');

    if (hasError) {
        return { risk: 'high', riskLabel: 'High risk — review before paying out' };
    }

    if (requestedAmount !== null && defensibleBalance + 0.01 < requestedAmount) {
        return { risk: 'high', riskLabel: 'High risk — defensible balance below request' };
    }

    if (hasWarning) {
        return { risk: 'review', riskLabel: 'Review — suspicious activity detected' };
    }

    return { risk: 'clean', riskLabel: 'Clean — no suspicious wallet activity found' };
}

function resolveReviewMode(
    withdrawalStatus: string | null | undefined,
    hasTransferStarted: boolean
): PayoutAnalysisReviewMode {
    const normalized = (withdrawalStatus ?? '').trim().toLowerCase();
    if (normalized === 'completed' || normalized === 'rejected') {
        return 'historical';
    }
    if (normalized === 'approved' && hasTransferStarted) {
        return 'transfer_pending';
    }
    return 'active';
}

export function analyzeProviderPayoutWallet(input: {
    providerId: string;
    providerName: string;
    providerEmail: string | null;
    providerUserId: string | null;
    storedWalletAmount: number;
    walletTransactions: WalletRow[];
    bookings: BookingRow[];
    customers: CustomerRow[];
    customerWalletCredits: CustomerWalletRow[];
    planMinimumRetainedBalance?: number | null;
    requestedWithdrawalAmount?: number | null;
    withdrawalStatus?: string | null;
    hasTransferStarted?: boolean;
}): ProviderPayoutAnalysis {
    const reviewMode = resolveReviewMode(input.withdrawalStatus, Boolean(input.hasTransferStarted));
    const withdrawalStatus = (input.withdrawalStatus ?? '').trim() || null;
    const bookingById = new Map(input.bookings.map((booking) => [booking.id, booking]));
    const customerUserIdByCustomerId = new Map(
        input.customers.map((customer) => [customer.id, customer.user_id ?? null])
    );

    const breakdown = {
        activationCredits: 0,
        legitimateJobPayouts: 0,
        suspiciousJobPayouts: 0,
        erroneousPayouts: 0,
        otherCredits: 0,
        withdrawals: 0,
        declineFees: 0,
        otherDebits: 0,
    };

    const transactions: ProviderWalletTransactionLine[] = [];
    let ledgerNet = 0;
    let reversedErroneousPayouts = 0;

    for (const row of input.walletTransactions) {
        const amount = walletTransactionMagnitude(row.amount);
        const isCredit = row.isCredit === true;
        const note = row.note ?? '';
        const transactionId = row.transactionId ?? '';
        ledgerNet += isCredit ? amount : -amount;

        let category: ProviderWalletTransactionLine['category'] = 'other';
        let bookingId: string | undefined;

        if (isCredit) {
            if (isActivationCredit(row) || note.toLowerCase().includes('listing plan')) {
                category = 'activation';
                breakdown.activationCredits += amount;
            } else if (isJobPayoutCredit(note)) {
                bookingId = findLinkedBookingId(note, transactionId, input.bookings) ?? undefined;
                const linkedBooking = bookingId ? bookingById.get(bookingId) ?? null : null;
                const payoutClass = classifyJobPayout(
                    amount,
                    linkedBooking,
                    input.providerUserId,
                    customerUserIdByCustomerId
                );
                category = payoutClass;
                if (payoutClass === 'legitimate_payout') breakdown.legitimateJobPayouts += amount;
                if (payoutClass === 'suspicious_payout') breakdown.suspiciousJobPayouts += amount;
                if (payoutClass === 'erroneous_payout') breakdown.erroneousPayouts += amount;
            } else {
                breakdown.otherCredits += amount;
            }
        } else if (isWithdrawalDebit(note)) {
            category = 'withdrawal';
            breakdown.withdrawals += amount;
        } else if (isDeclineFeeDebit(note)) {
            category = 'decline_fee';
            breakdown.declineFees += amount;
        } else if (isErroneousPayoutReversalDebit(note)) {
            reversedErroneousPayouts += amount;
            bookingId = parseBookingIdFromReversalNote(note) ?? undefined;
        } else {
            breakdown.otherDebits += amount;
        }

        transactions.push({
            id: row.id,
            createdDate: row.createdDate ?? null,
            isCredit,
            amount,
            paymentType: row.paymentType ?? null,
            note: row.note ?? null,
            category,
            bookingId,
        });
    }

    breakdown.erroneousPayouts = Math.max(0, breakdown.erroneousPayouts - reversedErroneousPayouts);

    const ledgerMatchesStored = Math.abs(ledgerNet - input.storedWalletAmount) < 0.02;
    const defensibleBalance =
        breakdown.activationCredits
        + breakdown.legitimateJobPayouts
        + breakdown.otherCredits
        - breakdown.withdrawals
        - breakdown.declineFees
        - breakdown.otherDebits;

    const customerAuthUserIdByProfileId = new Map<string, string>();
    for (const customer of input.customers) {
        const authUserId = readAuthUserId(customer.user_id);
        if (authUserId) {
            customerAuthUserIdByProfileId.set(customer.id, authUserId);
        }
    }

    const rejectedPaidWithoutRefund = input.bookings.filter((booking) => {
        if (booking.status !== 'rejected') return false;
        const paid =
            resolveBookingPaymentStatus(booking.payment_status ?? '', booking.paymentCompleted)
            === BOOKING_PAYMENT_STATUS.COMPLETED;
        if (!paid || !booking.customer_id) return false;
        const customerAuthUserId =
            readAuthUserId(booking.customer_user_id) ??
            customerAuthUserIdByProfileId.get(booking.customer_id);
        if (!customerAuthUserId) return false;
        const customerCredits = input.customerWalletCredits.filter(
            (tx) => tx.userId === customerAuthUserId
        );
        return !hasBookingCustomerRefund(booking.id, customerCredits);
    }).length;

    const findings: PayoutAnalysisFinding[] = [];

    if (!ledgerMatchesStored) {
        findings.push({
            id: 'ledger-mismatch',
            severity: 'error',
            label: 'Wallet balance does not match ledger',
            detail: `Stored ETB ${input.storedWalletAmount.toFixed(2)} vs ledger ETB ${ledgerNet.toFixed(2)}`,
        });
    }

    if (breakdown.erroneousPayouts > 0) {
        findings.push({
            id: 'erroneous-payouts',
            severity: 'error',
            label: 'Erroneous job payout credits detected',
            detail: 'Credits linked to negative amounts or exceeding booking totals',
            amount: breakdown.erroneousPayouts,
        });
    }

    if (breakdown.suspiciousJobPayouts > 0) {
        findings.push({
            id: 'suspicious-payouts',
            severity: 'warning',
            label: 'Suspicious job payout credits',
            detail: 'Incomplete bookings, unlinked completion payouts, or same-account customer and provider',
            amount: breakdown.suspiciousJobPayouts,
        });
    }

    if (breakdown.legitimateJobPayouts === 0 && breakdown.suspiciousJobPayouts + breakdown.erroneousPayouts > 0) {
        findings.push({
            id: 'no-legitimate-earnings',
            severity: 'warning',
            label: 'No verified marketplace job earnings',
            detail: 'Wallet job credits appear to be from test or internal flows only',
        });
    }

    if (rejectedPaidWithoutRefund > 0) {
        findings.push({
            id: 'customer-refunds-missing',
            severity: 'warning',
            label: 'Rejected paid bookings without customer refund',
            detail: `${rejectedPaidWithoutRefund} booking(s) on this provider may have stuck customer funds`,
        });
    }

    if (breakdown.activationCredits > 0 && breakdown.legitimateJobPayouts === 0) {
        findings.push({
            id: 'activation-heavy',
            severity: 'info',
            label: 'Balance is mostly listing activation credits',
            detail: 'Not earned from completed marketplace jobs',
            amount: breakdown.activationCredits,
        });
    }

    const requestedWithdrawalAmount =
        typeof input.requestedWithdrawalAmount === 'number' && Number.isFinite(input.requestedWithdrawalAmount)
            ? input.requestedWithdrawalAmount
            : null;
    const planMinimumRetainedBalance =
        typeof input.planMinimumRetainedBalance === 'number' && Number.isFinite(input.planMinimumRetainedBalance)
            ? input.planMinimumRetainedBalance
            : null;
    const postWithdrawalBalance =
        requestedWithdrawalAmount === null ? null : Math.round((defensibleBalance - requestedWithdrawalAmount) * 100) / 100;

    if (
        reviewMode === 'active'
        && requestedWithdrawalAmount !== null
        && defensibleBalance + 0.01 < requestedWithdrawalAmount
    ) {
        findings.push({
            id: 'request-exceeds-defensible',
            severity: 'error',
            label: 'Withdrawal request exceeds defensible balance',
            detail: `Request ETB ${requestedWithdrawalAmount.toFixed(2)} vs defensible ETB ${defensibleBalance.toFixed(2)}`,
            amount: requestedWithdrawalAmount,
        });
    }

    if (
        reviewMode === 'active'
        && requestedWithdrawalAmount !== null
        && planMinimumRetainedBalance !== null
        && postWithdrawalBalance !== null
        && postWithdrawalBalance + 0.01 < planMinimumRetainedBalance
    ) {
        findings.push({
            id: 'request-breaches-plan-floor',
            severity: 'warning',
            label: 'Withdrawal would drop below provider plan minimum',
            detail:
                `Post-withdrawal ETB ${postWithdrawalBalance.toFixed(2)} is below plan minimum ETB `
                + `${planMinimumRetainedBalance.toFixed(2)}.`,
            amount: requestedWithdrawalAmount,
        });
    }

    if (
        reviewMode === 'transfer_pending'
        && requestedWithdrawalAmount !== null
        && defensibleBalance + 0.01 < requestedWithdrawalAmount
    ) {
        findings.push({
            id: 'request-exceeds-defensible',
            severity: 'info',
            label: 'Request exceeded defensible balance when transfer was sent',
            detail: `You approved ETB ${requestedWithdrawalAmount.toFixed(2)} even though defensible balance was ETB ${defensibleBalance.toFixed(2)}. Verify the Chapa transfer to finish.`,
            amount: requestedWithdrawalAmount,
        });
    }

    const { risk, riskLabel } = resolveRisk(
        findings,
        defensibleBalance,
        reviewMode === 'active' ? requestedWithdrawalAmount : null,
        reviewMode
    );

    return {
        providerId: input.providerId,
        providerName: input.providerName,
        providerEmail: input.providerEmail,
        storedWalletAmount: input.storedWalletAmount,
        ledgerNet: Math.round(ledgerNet * 100) / 100,
        ledgerMatchesStored,
        breakdown,
        defensibleBalance: Math.round(defensibleBalance * 100) / 100,
        planMinimumRetainedBalance,
        postWithdrawalBalance,
        requestedWithdrawalAmount,
        withdrawalCoversRequest:
            requestedWithdrawalAmount === null
                ? null
                : defensibleBalance + 0.01 >= requestedWithdrawalAmount,
        risk,
        riskLabel,
        reviewMode,
        withdrawalStatus,
        findings,
        transactions: transactions.sort((left, right) => {
            const leftTime = left.createdDate ? new Date(left.createdDate).getTime() : 0;
            const rightTime = right.createdDate ? new Date(right.createdDate).getTime() : 0;
            return rightTime - leftTime;
        }),
        stats: {
            completedBookings: input.bookings.filter((booking) => booking.status === 'completed').length,
            rejectedPaidWithoutRefund,
        },
    };
}
