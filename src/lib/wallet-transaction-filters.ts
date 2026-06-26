import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';
import { matchesWalletSearch, type WalletSearchColumnId } from '@/lib/wallet-transaction-search';

export type WalletDirectionFilter = 'all' | 'credit' | 'debit';

export type WalletSortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export type WalletProfileFilter =
    | 'all'
    | 'missing_customer'
    | 'missing_provider'
    | 'missing_any'
    | 'legacy_user_id';

export interface WalletTransactionFilterState {
    direction: WalletDirectionFilter;
    types: string[];
    paymentTypes: string[];
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    sort: WalletSortOption;
    profileFilter: WalletProfileFilter;
}

export const DEFAULT_WALLET_TRANSACTION_FILTERS: WalletTransactionFilterState = {
    direction: 'all',
    types: [],
    paymentTypes: [],
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    sort: 'date_desc',
    profileFilter: 'all',
};

export interface WalletTransactionFilterOptions {
    types: string[];
    paymentTypes: string[];
}

function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function walletDatePreset(
    preset: 'today' | '7d' | '30d' | '90d'
): Pick<WalletTransactionFilterState, 'dateFrom' | 'dateTo'> {
    const today = new Date();
    const end = toDateInputValue(today);

    if (preset === 'today') {
        return { dateFrom: end, dateTo: end };
    }

    const startDate = new Date(today);
    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89;
    startDate.setDate(startDate.getDate() - days);
    return { dateFrom: toDateInputValue(startDate), dateTo: end };
}

function parseAmount(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function itemAmountMagnitude(amount: string): number {
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function parseItemDate(createdDate: string): Date | null {
    if (!createdDate.trim()) return null;
    const date = new Date(createdDate);
    return Number.isNaN(date.getTime()) ? null : date;
}

function matchesDateRange(createdDate: string, dateFrom: string, dateTo: string): boolean {
    const itemDate = parseItemDate(createdDate);
    if (!itemDate) return true;

    if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (itemDate < from) return false;
    }

    if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999`);
        if (itemDate > to) return false;
    }

    return true;
}

function matchesAmountRange(amount: string, amountMin: string, amountMax: string): boolean {
    const magnitude = itemAmountMagnitude(amount);
    const min = parseAmount(amountMin);
    const max = parseAmount(amountMax);

    if (min !== null && magnitude < min) return false;
    if (max !== null && magnitude > max) return false;
    return true;
}

function isProviderType(type: string): boolean {
    const normalized = type.trim().toLowerCase();
    return normalized === 'provider' || normalized === 'provider_payout';
}

function matchesProfileFilter(item: WalletTransaction, profileFilter: WalletProfileFilter): boolean {
    if (profileFilter === 'all') return true;

    const missingCustomer =
        item.type.trim().toLowerCase() === 'customer' && !item.customer_id.trim() && !item.customerProfileId.trim();
    const missingProvider =
        isProviderType(item.type) && !item.provider_id.trim() && !item.providerProfileId.trim();

    if (profileFilter === 'missing_customer') return missingCustomer;
    if (profileFilter === 'missing_provider') return missingProvider;
    if (profileFilter === 'missing_any') return missingCustomer || missingProvider;
    if (profileFilter === 'legacy_user_id') return item.userIdStoredAsProfile;
    return false;
}

export function collectWalletTransactionFilterOptions(
    items: WalletTransaction[]
): WalletTransactionFilterOptions {
    const types = [...new Set(items.map((item) => item.type.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
    );
    const paymentTypes = [...new Set(items.map((item) => item.paymentType.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
    );
    return { types, paymentTypes };
}

export function sortWalletTransactions(
    items: WalletTransaction[],
    sort: WalletSortOption
): WalletTransaction[] {
    const sorted = [...items];

    sorted.sort((left, right) => {
        if (sort === 'date_desc' || sort === 'date_asc') {
            const leftTime = parseItemDate(left.createdDate)?.getTime() ?? 0;
            const rightTime = parseItemDate(right.createdDate)?.getTime() ?? 0;
            return sort === 'date_desc' ? rightTime - leftTime : leftTime - rightTime;
        }

        const leftAmount = itemAmountMagnitude(left.amount);
        const rightAmount = itemAmountMagnitude(right.amount);
        return sort === 'amount_desc' ? rightAmount - leftAmount : leftAmount - rightAmount;
    });

    return sorted;
}

export function applyWalletTransactionFilters(
    items: WalletTransaction[],
    filters: WalletTransactionFilterState,
    searchTerm: string,
    searchColumnIds: WalletSearchColumnId[]
): WalletTransaction[] {
    const normalizedTypes = filters.types.map((type) => type.toLowerCase());
    const normalizedPaymentTypes = filters.paymentTypes.map((type) => type.toLowerCase());
    const term = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
        if (filters.direction === 'credit' && !item.isCredit) return false;
        if (filters.direction === 'debit' && item.isCredit) return false;

        if (normalizedTypes.length > 0 && !normalizedTypes.includes(item.type.trim().toLowerCase())) {
            return false;
        }

        if (
            normalizedPaymentTypes.length > 0 &&
            !normalizedPaymentTypes.includes(item.paymentType.trim().toLowerCase())
        ) {
            return false;
        }

        if (!matchesDateRange(item.createdDate, filters.dateFrom, filters.dateTo)) return false;
        if (!matchesAmountRange(item.amount, filters.amountMin, filters.amountMax)) return false;
        if (!matchesProfileFilter(item, filters.profileFilter)) return false;
        if (!matchesWalletSearch(item, term, searchColumnIds)) return false;

        return true;
    });

    return sortWalletTransactions(filtered, filters.sort);
}

export function paginateWalletTransactions<T>(
    items: T[],
    page: number,
    pageSize: number
): { pageItems: T[]; totalPages: number; safePage: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        pageItems: items.slice(start, start + pageSize),
        totalPages,
        safePage,
    };
}

export function countWalletPanelFilters(filters: WalletTransactionFilterState): number {
    let count = 0;
    if (filters.direction !== 'all') count += 1;
    if (filters.types.length > 0) count += 1;
    if (filters.paymentTypes.length > 0) count += 1;
    if (filters.dateFrom || filters.dateTo) count += 1;
    if (filters.amountMin || filters.amountMax) count += 1;
    if (filters.sort !== DEFAULT_WALLET_TRANSACTION_FILTERS.sort) count += 1;
    if (filters.profileFilter !== 'all') count += 1;
    return count;
}

export function countActiveWalletFilters(
    filters: WalletTransactionFilterState,
    searchTerm: string,
    searchColumnIds: WalletSearchColumnId[]
): number {
    let count = 0;
    if (filters.direction !== 'all') count += 1;
    if (filters.types.length > 0) count += 1;
    if (filters.paymentTypes.length > 0) count += 1;
    if (filters.dateFrom || filters.dateTo) count += 1;
    if (filters.amountMin || filters.amountMax) count += 1;
    if (filters.sort !== DEFAULT_WALLET_TRANSACTION_FILTERS.sort) count += 1;
    if (filters.profileFilter !== 'all') count += 1;
    if (searchTerm.trim()) count += 1;
    if (searchColumnIds.length > 0) count += 1;
    return count;
}

export function hasNonDefaultWalletFilters(
    filters: WalletTransactionFilterState,
    searchTerm: string,
    searchColumnIds: WalletSearchColumnId[]
): boolean {
    return countActiveWalletFilters(filters, searchTerm, searchColumnIds) > 0;
}
