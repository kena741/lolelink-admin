export interface WalletTransactionMetricRow {
    amount?: string | number | null;
    isCredit?: boolean | null;
    note?: string | null;
    transactionId?: string | null;
    type?: string | null;
    userId?: string | null;
    createdDate?: string | null;
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
        return sum + parseWalletAmount(row.amount);
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
        return sum + parseWalletAmount(row.amount);
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
        return sum + parseWalletAmount(row.amount);
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
        return sum + parseWalletAmount(row.amount);
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
        const amount = parseWalletAmount(row.amount);
        if (row.isCredit === true) {
            if (options?.adjusted && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) {
                return sum;
            }
            return sum + amount;
        }
        return sum - amount;
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
