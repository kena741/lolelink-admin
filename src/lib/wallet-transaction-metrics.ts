export interface WalletTransactionMetricRow {
    amount?: string | number | null;
    isCredit?: boolean | null;
    note?: string | null;
    transactionId?: string | null;
    type?: string | null;
    userId?: string | null;
    createdDate?: string | null;
    paymentType?: string | null;
    payment_type?: string | null;
}

export interface WalletMetricsSummary {
    totalCreditGross: number;
    totalCreditAdjusted: number;
    totalNetFlowGross: number;
    totalNetFlowAdjusted: number;
    totalTopUpGross: number;
    totalTopUpAdjusted: number;
    totalActivationFeeGross: number;
    totalActivationFeeAdjusted: number;
    totalCustomerTopUpGross: number;
    totalCustomerTopUpAdjusted: number;
}

function normalizeType(type: string | null | undefined): string {
    return (type ?? '').trim().toLowerCase();
}

export function parseWalletAmount(amount: string | number | null | undefined): number {
    const parsed = Number(amount ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function walletTransactionMagnitude(amount: string | number | null | undefined): number {
    return Math.abs(parseWalletAmount(amount));
}

export function isCustomerTransactionType(type: string | null | undefined): boolean {
    return normalizeType(type) === 'customer';
}

export function isActivationCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    const note = (row.note ?? '').toLowerCase();
    const transactionId = (row.transactionId ?? '').toLowerCase();
    return (
        note.includes('activation')
        || transactionId.startsWith('activation_')
        || transactionId.startsWith('act-')
    );
}

export function isTopUpCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    const note = (row.note ?? '').toLowerCase();
    const transactionId = (row.transactionId ?? '').toLowerCase();
    return (
        note.includes('top up')
        || note.includes('topup')
        || transactionId.startsWith('wallet_')
        || transactionId.startsWith('activation_')
        || transactionId.startsWith('act-')
    );
}

export function isCustomerTopUpCredit(row: WalletTransactionMetricRow): boolean {
    return isCustomerTransactionType(row.type) && isTopUpCredit(row);
}

export function buildUserIdsWithProviderActivation(rows: WalletTransactionMetricRow[]): Set<string> {
    const userIds = new Set<string>();
    for (const row of rows) {
        if (isActivationCredit(row) && row.userId) {
            userIds.add(row.userId);
        }
    }
    return userIds;
}

export function shouldExcludeFromAdjustedCredit(
    row: WalletTransactionMetricRow,
    providerActivationUserIds: Set<string>
): boolean {
    if (row.isCredit !== true) return false;
    if (!row.userId) return false;
    if (!providerActivationUserIds.has(row.userId)) return false;
    if (isActivationCredit(row)) return false;
    return isCustomerTransactionType(row.type) || hasCustomerWalletTopUpTransactionId(row.transactionId);
}

export function sumCredits(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        if (row.isCredit !== true) return sum;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            return sum;
        }
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function sumDebits(rows: WalletTransactionMetricRow[]): number {
    return rows.reduce((sum, row) => {
        if (row.isCredit === true) return sum;
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function sumTopUpCredits(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        if (!isTopUpCredit(row)) return sum;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            return sum;
        }
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function sumActivationCredits(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        if (!isActivationCredit(row)) return sum;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            return sum;
        }
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function sumCustomerTopUpCredits(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        if (!isCustomerTopUpCredit(row)) return sum;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            return sum;
        }
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function sumNetFlow(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        const magnitude = walletTransactionMagnitude(row.amount);
        if (row.isCredit === true) {
            if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
                return sum;
            }
            return sum + magnitude;
        }
        return sum - magnitude;
    }, 0);
}

export function computeWalletMetrics(rows: WalletTransactionMetricRow[]): WalletMetricsSummary {
    return {
        totalCreditGross: sumCredits(rows),
        totalCreditAdjusted: sumCredits(rows, { adjusted: true }),
        totalNetFlowGross: sumNetFlow(rows),
        totalNetFlowAdjusted: sumNetFlow(rows, { adjusted: true }),
        totalTopUpGross: sumTopUpCredits(rows),
        totalTopUpAdjusted: sumTopUpCredits(rows, { adjusted: true }),
        totalActivationFeeGross: sumActivationCredits(rows),
        totalActivationFeeAdjusted: sumActivationCredits(rows, { adjusted: true }),
        totalCustomerTopUpGross: sumCustomerTopUpCredits(rows),
        totalCustomerTopUpAdjusted: sumCustomerTopUpCredits(rows, { adjusted: true }),
    };
}

export function hasCustomerWalletTopUpTransactionId(transactionId: string | null | undefined): boolean {
    return (transactionId ?? '').trim().toLowerCase().startsWith('wallet_');
}

export function isChapaWalletTransaction(row: WalletTransactionMetricRow & {
    paymentType?: string | null;
    payment_type?: string | null;
}): boolean {
    const paymentType = String(row.paymentType ?? row.payment_type ?? '').toLowerCase();
    const note = (row.note ?? '').toLowerCase();
    const transactionId = (row.transactionId ?? '').toLowerCase();
    return paymentType.includes('chapa') || note.includes('chapa') || transactionId.includes('chapa');
}

export function sumChapaNetFlow(rows: WalletTransactionMetricRow[]): number {
    return sumNetFlow(rows.filter((row) => isChapaWalletTransaction(row)));
}

export function sumNonChapaNetFlow(rows: WalletTransactionMetricRow[]): number {
    return sumNetFlow(rows.filter((row) => !isChapaWalletTransaction(row)));
}

export function isProviderPayoutCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    const note = (row.note ?? '').toLowerCase();
    return note.includes('payout') || note.includes('completed (payout');
}

export function isDirectPaymentCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    if (isChapaWalletTransaction(row)) return false;
    if (isProviderPayoutCredit(row)) return false;
    return true;
}

export function sumDirectPaymentCredits(rows: WalletTransactionMetricRow[]): number {
    return rows.reduce((sum, row) => {
        if (!isDirectPaymentCredit(row)) return sum;
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export function isManualActivationCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    const paymentType = String(row.paymentType ?? row.payment_type ?? '').toLowerCase();
    return paymentType === 'manual' && isActivationCredit(row);
}

export function sumManualActivationCredits(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): number {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();

    return rows.reduce((sum, row) => {
        if (!isManualActivationCredit(row)) return sum;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            return sum;
        }
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

export interface WalletMetricBreakdownLine {
    label: string;
    amount: number;
    count: number;
}

export interface WalletDashboardBreakdown {
    walletRowCounts: {
        creditRows: number;
        debitRows: number;
        totalRows: number;
    };
    walletCredits: WalletMetricBreakdownLine[];
    walletDebits: WalletMetricBreakdownLine[];
    activationFee: WalletMetricBreakdownLine[];
    manualActivation: WalletMetricBreakdownLine[];
    customerTopUp: WalletMetricBreakdownLine[];
    totalTopUp: WalletMetricBreakdownLine[];
    chapaWalletNet: WalletMetricBreakdownLine[];
    nonChapaWalletNet: WalletMetricBreakdownLine[];
    directPaymentCredits: WalletMetricBreakdownLine[];
}

export type WalletCreditSegment =
    | 'manual_activation'
    | 'chapa_activation'
    | 'chapa_bookings_upgrades'
    | 'provider_payout'
    | 'customer_topup'
    | 'other_credit';

const WALLET_CREDIT_SEGMENT_LABELS: Record<WalletCreditSegment, string> = {
    manual_activation: 'Manual activation',
    chapa_activation: 'Chapa provider activations',
    chapa_bookings_upgrades: 'Chapa bookings, upgrades & featured',
    provider_payout: 'Provider payouts (completed jobs)',
    customer_topup: 'Customer wallet top-ups',
    other_credit: 'Other credits',
};

function walletRowDelta(row: WalletTransactionMetricRow): number {
    const magnitude = walletTransactionMagnitude(row.amount);
    return row.isCredit === true ? magnitude : -magnitude;
}

function shortenWalletNote(note: string, maxLength = 72): string {
    const trimmed = note.trim();
    if (!trimmed) return '(no note)';
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength - 1)}…`;
}

function pushBreakdownLine(
    bucket: Map<string, WalletMetricBreakdownLine>,
    label: string,
    amount: number
): void {
    const existing = bucket.get(label);
    if (existing) {
        existing.amount += amount;
        existing.count += 1;
        return;
    }
    bucket.set(label, { label, amount, count: 1 });
}

function breakdownLinesFromBucket(bucket: Map<string, WalletMetricBreakdownLine>): WalletMetricBreakdownLine[] {
    return [...bucket.values()].sort((left, right) => {
        const amountDelta = Math.abs(right.amount) - Math.abs(left.amount);
        if (amountDelta !== 0) return amountDelta;
        return left.label.localeCompare(right.label);
    });
}

function aggregateMagnitudeByNote(
    rows: WalletTransactionMetricRow[],
    filter: (row: WalletTransactionMetricRow) => boolean,
    options?: { adjusted?: boolean; creditsOnly?: boolean }
): WalletMetricBreakdownLine[] {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();
    const bucket = new Map<string, WalletMetricBreakdownLine>();

    for (const row of rows) {
        if (!filter(row)) continue;
        if (options?.creditsOnly && row.isCredit !== true) continue;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            continue;
        }
        pushBreakdownLine(bucket, shortenWalletNote(row.note ?? ''), walletTransactionMagnitude(row.amount));
    }

    return breakdownLinesFromBucket(bucket);
}

function aggregateNetByNote(
    rows: WalletTransactionMetricRow[],
    filter: (row: WalletTransactionMetricRow) => boolean
): WalletMetricBreakdownLine[] {
    const bucket = new Map<string, WalletMetricBreakdownLine>();

    for (const row of rows) {
        if (!filter(row)) continue;
        pushBreakdownLine(bucket, shortenWalletNote(row.note ?? ''), walletRowDelta(row));
    }

    return breakdownLinesFromBucket(bucket);
}

export function classifyWalletCreditSegment(row: WalletTransactionMetricRow): WalletCreditSegment | null {
    if (row.isCredit !== true) return null;
    if (isManualActivationCredit(row)) return 'manual_activation';
    if (isActivationCredit(row)) {
        return isChapaWalletTransaction(row) ? 'chapa_activation' : 'chapa_activation';
    }
    if (isCustomerTopUpCredit(row)) return 'customer_topup';
    if (isProviderPayoutCredit(row)) return 'provider_payout';
    if (isChapaWalletTransaction(row)) return 'chapa_bookings_upgrades';
    return 'other_credit';
}

function aggregateWalletCreditsBySegment(
    rows: WalletTransactionMetricRow[],
    options?: { adjusted?: boolean }
): WalletMetricBreakdownLine[] {
    const providerActivationUserIds = options?.adjusted
        ? buildUserIdsWithProviderActivation(rows)
        : new Set<string>();
    const bucket = new Map<string, WalletMetricBreakdownLine>();

    for (const row of rows) {
        if (row.isCredit !== true) continue;
        if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
            continue;
        }
        const segment = classifyWalletCreditSegment(row);
        if (!segment) continue;
        pushBreakdownLine(
            bucket,
            WALLET_CREDIT_SEGMENT_LABELS[segment],
            walletTransactionMagnitude(row.amount)
        );
    }

    return breakdownLinesFromBucket(bucket);
}

export function computeWalletDashboardBreakdown(
    rows: WalletTransactionMetricRow[]
): WalletDashboardBreakdown {
    const creditRows = rows.filter((row) => row.isCredit === true).length;
    const debitRows = rows.length - creditRows;

    return {
        walletRowCounts: {
            creditRows,
            debitRows,
            totalRows: rows.length,
        },
        walletCredits: aggregateWalletCreditsBySegment(rows, { adjusted: true }),
        walletDebits: aggregateMagnitudeByNote(rows, (row) => row.isCredit !== true),
        activationFee: aggregateMagnitudeByNote(rows, isActivationCredit, { adjusted: true, creditsOnly: true }),
        manualActivation: aggregateMagnitudeByNote(rows, isManualActivationCredit, { adjusted: true, creditsOnly: true }),
        customerTopUp: aggregateMagnitudeByNote(rows, isCustomerTopUpCredit, { adjusted: true, creditsOnly: true }),
        totalTopUp: aggregateMagnitudeByNote(rows, isTopUpCredit, { adjusted: true, creditsOnly: true }),
        chapaWalletNet: aggregateNetByNote(rows, isChapaWalletTransaction),
        nonChapaWalletNet: aggregateNetByNote(rows, (row) => !isChapaWalletTransaction(row)),
        directPaymentCredits: aggregateMagnitudeByNote(rows, isDirectPaymentCredit, { creditsOnly: true }),
    };
}
