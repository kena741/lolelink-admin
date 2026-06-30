export const WALLET_TRANSACTION_COLUMN_STORAGE_KEY = 'wallet-transactions-column-visibility-v2';

export const WALLET_TRANSACTION_COLUMNS = [
    { id: 'date', label: 'Date', defaultVisible: true },
    { id: 'amount', label: 'Amount', defaultVisible: true },
    { id: 'event', label: 'Event', defaultVisible: true },
    { id: 'type', label: 'Type', defaultVisible: true },
    { id: 'payment', label: 'Payment', defaultVisible: true },
    { id: 'issues', label: 'Issues', defaultVisible: true },
    { id: 'customer', label: 'Customer', defaultVisible: true },
    { id: 'provider', label: 'Provider', defaultVisible: true },
    { id: 'user', label: 'User', defaultVisible: false },
    { id: 'service', label: 'Service', defaultVisible: false },
    { id: 'bookingTotal', label: 'Booking total', defaultVisible: false },
    { id: 'transactionId', label: 'Transaction ID', defaultVisible: true },
    { id: 'note', label: 'Note', defaultVisible: true },
] as const;

export type WalletTransactionColumnId = (typeof WALLET_TRANSACTION_COLUMNS)[number]['id'];

export type WalletTransactionColumnVisibility = Record<WalletTransactionColumnId, boolean>;

export function getDefaultWalletColumnVisibility(): WalletTransactionColumnVisibility {
    return WALLET_TRANSACTION_COLUMNS.reduce((acc, column) => {
        acc[column.id] = column.defaultVisible;
        return acc;
    }, {} as WalletTransactionColumnVisibility);
}

function isWalletColumnId(value: string): value is WalletTransactionColumnId {
    return WALLET_TRANSACTION_COLUMNS.some((column) => column.id === value);
}

export function loadWalletColumnVisibility(): WalletTransactionColumnVisibility {
    const defaults = getDefaultWalletColumnVisibility();
    if (typeof window === 'undefined') return defaults;

    try {
        const raw = window.localStorage.getItem(WALLET_TRANSACTION_COLUMN_STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const merged = { ...defaults };
        for (const column of WALLET_TRANSACTION_COLUMNS) {
            const value = parsed[column.id];
            if (typeof value === 'boolean') {
                merged[column.id] = value;
            }
        }
        return merged;
    } catch {
        return defaults;
    }
}

export function saveWalletColumnVisibility(visibility: WalletTransactionColumnVisibility): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WALLET_TRANSACTION_COLUMN_STORAGE_KEY, JSON.stringify(visibility));
}

export function countHiddenWalletColumns(visibility: WalletTransactionColumnVisibility): number {
    return WALLET_TRANSACTION_COLUMNS.filter((column) => !visibility[column.id]).length;
}

export function visibleWalletTransactionColumns(
    visibility: WalletTransactionColumnVisibility
): Array<(typeof WALLET_TRANSACTION_COLUMNS)[number]> {
    return WALLET_TRANSACTION_COLUMNS.filter((column) => visibility[column.id]);
}

export function parseWalletColumnVisibilityPatch(
    patch: Record<string, unknown>
): Partial<WalletTransactionColumnVisibility> {
    const next: Partial<WalletTransactionColumnVisibility> = {};
    for (const [key, value] of Object.entries(patch)) {
        if (isWalletColumnId(key) && typeof value === 'boolean') {
            next[key] = value;
        }
    }
    return next;
}
