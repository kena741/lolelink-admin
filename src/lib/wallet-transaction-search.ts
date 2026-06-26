import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';

export type WalletSearchColumnId =
    | 'customer'
    | 'provider'
    | 'auth_user'
    | 'transaction'
    | 'note'
    | 'type'
    | 'payment'
    | 'amount'
    | 'direction';

export interface WalletSearchColumn {
    id: WalletSearchColumnId;
    label: string;
    placeholder: string;
}

export const WALLET_SEARCH_COLUMNS: WalletSearchColumn[] = [
    { id: 'customer', label: 'Customer', placeholder: 'name, email, phone, profile id' },
    { id: 'provider', label: 'Provider', placeholder: 'name, email, phone, profile id' },
    { id: 'auth_user', label: 'Auth user', placeholder: 'name, email, phone, user id' },
    { id: 'transaction', label: 'Transaction', placeholder: 'transaction id' },
    { id: 'note', label: 'Note', placeholder: 'note text' },
    { id: 'type', label: 'Type', placeholder: 'customer, provider, provider_payout' },
    { id: 'payment', label: 'Payment', placeholder: 'chapa, wallet, manual' },
    { id: 'amount', label: 'Amount', placeholder: 'amount value' },
    { id: 'direction', label: 'Direction', placeholder: 'credit or debit' },
];

const COLUMN_PREFIX_ALIASES: Record<string, WalletSearchColumnId> = {
    customer: 'customer',
    provider: 'provider',
    auth: 'auth_user',
    auth_user: 'auth_user',
    authuser: 'auth_user',
    transaction: 'transaction',
    tx: 'transaction',
    note: 'note',
    type: 'type',
    payment: 'payment',
    amount: 'amount',
    direction: 'direction',
};

const COLUMN_SEARCH_ALIASES: Record<WalletSearchColumnId, string[]> = {
    customer: ['customer', 'cust'],
    provider: ['provider', 'prov'],
    auth_user: ['auth user', 'auth_user', 'authuser', 'auth'],
    transaction: ['transaction', 'trans', 'tx'],
    note: ['note'],
    type: ['type'],
    payment: ['payment', 'pay'],
    amount: ['amount', 'amt'],
    direction: ['direction', 'dir', 'credit', 'debit'],
};

function nonEmptyStrings(...values: (string | null | undefined)[]): string[] {
    return values
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());
}

export function walletSearchColumnValues(
    item: WalletTransaction,
    columnId: WalletSearchColumnId
): string[] {
    switch (columnId) {
        case 'customer':
            return nonEmptyStrings(
                item.customerName,
                item.customerEmail,
                item.customerPhone,
                item.customer_id,
                item.customerProfileId
            );
        case 'provider':
            return nonEmptyStrings(
                item.providerName,
                item.providerEmail,
                item.providerPhone,
                item.provider_id,
                item.providerProfileId
            );
        case 'auth_user':
            return nonEmptyStrings(
                item.authUserName,
                item.authUserEmail,
                item.authUserPhone,
                item.userId
            );
        case 'transaction':
            return nonEmptyStrings(item.transactionId, item.id);
        case 'note':
            return nonEmptyStrings(item.note);
        case 'type':
            return nonEmptyStrings(item.type);
        case 'payment':
            return nonEmptyStrings(item.paymentType);
        case 'amount':
            return nonEmptyStrings(item.amount);
        case 'direction':
            return [item.isCredit ? 'credit' : 'debit'];
        default:
            return [];
    }
}

export function filterWalletSearchColumnSuggestions(
    draft: string,
    activeColumnIds: WalletSearchColumnId[]
): WalletSearchColumn[] {
    const query = draft.trim().toLowerCase();
    if (!query) return [];

    return WALLET_SEARCH_COLUMNS.filter((column) => {
        if (activeColumnIds.includes(column.id)) return false;

        const aliases = [
            column.label.toLowerCase(),
            column.id.replace(/_/g, ' '),
            ...(COLUMN_SEARCH_ALIASES[column.id] ?? []),
        ];

        return aliases.some((alias) => alias.startsWith(query));
    });
}

export function resolveWalletSearchColumnFromDraft(
    draft: string,
    activeColumnIds: WalletSearchColumnId[]
): WalletSearchColumn | null {
    const query = draft.trim().toLowerCase();
    if (!query) return null;

    const suggestions = filterWalletSearchColumnSuggestions(draft, activeColumnIds);
    const exact = suggestions.find((column) => {
        const aliases = [
            column.label.toLowerCase(),
            column.id,
            column.id.replace(/_/g, ' '),
            ...(COLUMN_SEARCH_ALIASES[column.id] ?? []),
        ];
        return aliases.some((alias) => alias === query);
    });

    return exact ?? suggestions[0] ?? null;
}

export interface ParsedWalletSearchQuery {
    term: string;
    columnId: WalletSearchColumnId | null;
}

export function parseWalletSearchQuery(raw: string): ParsedWalletSearchQuery {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { term: '', columnId: null };
    }

    const prefixMatch = trimmed.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (prefixMatch) {
        const alias = prefixMatch[1].toLowerCase();
        const columnId = COLUMN_PREFIX_ALIASES[alias];
        if (columnId) {
            return {
                columnId,
                term: prefixMatch[2].trim().toLowerCase(),
            };
        }
    }

    return {
        columnId: null,
        term: trimmed.toLowerCase(),
    };
}

export function matchesWalletSearch(
    item: WalletTransaction,
    term: string,
    activeColumnIds: WalletSearchColumnId[]
): boolean {
    if (!term) return true;

    const scopedColumns =
        activeColumnIds.length > 0
            ? activeColumnIds
            : WALLET_SEARCH_COLUMNS.map((column) => column.id);

    return scopedColumns.some((columnId) =>
        walletSearchColumnValues(item, columnId).some((value) => value.toLowerCase().includes(term))
    );
}

export function walletSearchColumnById(columnId: WalletSearchColumnId): WalletSearchColumn {
    const column = WALLET_SEARCH_COLUMNS.find((entry) => entry.id === columnId);
    if (!column) {
        return WALLET_SEARCH_COLUMNS[0];
    }
    return column;
}
