'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, RefreshCw, X } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { fetchWalletTransactions } from '@/features/walletTransaction/walletTransactionSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    buildUserIdsWithProviderActivation,
    shouldExcludeFromAdjustedCredit,
    sumDebits,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '@/lib/wallet-transaction-metrics';
import { WalletTransactionsTable } from '@/app/admin/finance/wallet-transactions/WalletTransactionsTable';
import { WalletTransactionSearch } from '@/app/admin/finance/wallet-transactions/WalletTransactionSearch';
import { WalletTransactionFilters } from '@/app/admin/finance/wallet-transactions/WalletTransactionFilters';
import { WalletTransactionPagination } from '@/app/admin/finance/wallet-transactions/WalletTransactionPagination';
import {
    applyWalletTransactionFilters,
    collectWalletTransactionFilterOptions,
    countActiveWalletFilters,
    countWalletPanelFilters,
    DEFAULT_WALLET_TRANSACTION_FILTERS,
    paginateWalletTransactions,
    type WalletTransactionFilterState,
} from '@/lib/wallet-transaction-filters';
import { downloadWalletTransactionsCsv } from '@/lib/wallet-transaction-export';
import type { WalletSearchColumnId } from '@/lib/wallet-transaction-search';

function formatAmount(value: number) {
    return `ETB ${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function StatCard({
    title,
    value,
    titleClassName,
    valueClassName,
}: {
    title: string;
    value: string;
    titleClassName?: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm min-w-0 sm:p-5">
            <p className={`mb-1 text-sm font-semibold ${titleClassName ?? 'text-gray-500'}`}>{title}</p>
            <p className={`text-2xl font-bold tabular-nums truncate ${valueClassName ?? 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

const WalletTransactionsPage = () => {
    const dispatch = useAppDispatch();
    const { items, loading, error } = useAppSelector((state) => state.walletTransaction);
    const [query, setQuery] = useState('');
    const [searchColumnIds, setSearchColumnIds] = useState<WalletSearchColumnId[]>([]);
    const [filters, setFilters] = useState<WalletTransactionFilterState>(DEFAULT_WALLET_TRANSACTION_FILTERS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchWalletTransactions());
    }, [dispatch]);

    const filterOptions = useMemo(() => collectWalletTransactionFilterOptions(items), [items]);

    const filteredItems = useMemo(
        () => applyWalletTransactionFilters(items, filters, query, searchColumnIds),
        [items, filters, query, searchColumnIds]
    );

    const pagination = useMemo(
        () => paginateWalletTransactions(filteredItems, page, pageSize),
        [filteredItems, page, pageSize]
    );

    useEffect(() => {
        setPage(1);
    }, [filters, query, searchColumnIds, pageSize]);

    useEffect(() => {
        if (page !== pagination.safePage) {
            setPage(pagination.safePage);
        }
    }, [page, pagination.safePage]);

    const activeFilterCount = countActiveWalletFilters(filters, query, searchColumnIds);
    const panelFilterCount = countWalletPanelFilters(filters);

    const stats = useMemo(() => {
        const toMetricRow = (item: (typeof items)[number]): WalletTransactionMetricRow => ({
            amount: item.amount,
            isCredit: item.isCredit,
            note: item.note,
            transactionId: item.transactionId,
            type: item.type,
            userId: item.userId,
            createdDate: item.createdDate,
        });

        const allRows = items.map(toMetricRow);
        const filteredRows = filteredItems.map(toMetricRow);
        const providerActivationUserIds = buildUserIdsWithProviderActivation(allRows);

        const credits = filteredRows.filter((row) => row.isCredit === true);
        const debits = filteredRows.filter((row) => row.isCredit !== true);

        const totalCredit = credits.reduce((sum, row) => {
            if (shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)) return sum;
            return sum + walletTransactionMagnitude(row.amount);
        }, 0);
        const totalDebit = sumDebits(filteredRows);

        return {
            total: filteredItems.length,
            creditCount: credits.length,
            debitCount: debits.length,
            totalCredit,
            totalDebit,
        };
    }, [filteredItems, items]);

    function clearAllFilters() {
        setQuery('');
        setSearchColumnIds([]);
        setFilters(DEFAULT_WALLET_TRANSACTION_FILTERS);
        setPage(1);
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen overflow-x-hidden">
                <Sidebar />
                <main className="ml-64 min-h-screen w-[calc(100vw-16rem)] min-w-0 max-w-full overflow-x-hidden">
                    <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                        <AdminPageHeader
                            title="Wallet Transactions"
                            description="Ledger credits and debits across customers and providers"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Wallet Transactions' },
                            ]}
                            actions={
                                <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        disabled={loading || filteredItems.length === 0}
                                        onClick={() => downloadWalletTransactionsCsv(filteredItems)}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline">Export CSV</span>
                                        <span className="sm:hidden">Export</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchWalletTransactions())}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>
                            }
                        />

                        <section className="mb-6 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
                            <StatCard title="Transactions" value={loading ? '…' : String(stats.total)} />
                            <StatCard
                                title="Credits"
                                value={loading ? '…' : String(stats.creditCount)}
                                titleClassName="text-emerald-600"
                                valueClassName="text-emerald-600"
                            />
                            <StatCard
                                title="Debits"
                                value={loading ? '…' : String(stats.debitCount)}
                                titleClassName="text-red-600"
                                valueClassName="text-red-600"
                            />
                            <StatCard
                                title="Total credit"
                                value={loading ? '…' : formatAmount(stats.totalCredit)}
                                titleClassName="text-emerald-600"
                                valueClassName="text-xl text-emerald-600"
                            />
                            <StatCard
                                title="Total debit"
                                value={loading ? '…' : formatAmount(stats.totalDebit)}
                                titleClassName="text-red-600"
                                valueClassName="text-xl text-red-600"
                            />
                        </section>

                        <div className="mb-6 min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <WalletTransactionSearch
                                query={query}
                                activeColumnIds={searchColumnIds}
                                onQueryChange={setQuery}
                                onActiveColumnIdsChange={setSearchColumnIds}
                            />

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFiltersOpen((open) => !open)}
                                        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                                            filtersOpen
                                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Filter className="h-4 w-4" />
                                        Filters
                                        {panelFilterCount > 0 ? (
                                            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                                {panelFilterCount}
                                            </span>
                                        ) : null}
                                    </button>
                                    {activeFilterCount > 0 ? (
                                        <button
                                            type="button"
                                            onClick={clearAllFilters}
                                            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        >
                                            <X className="h-4 w-4" />
                                            Clear all
                                        </button>
                                    ) : null}
                                </div>
                                <p className="text-sm text-gray-500">
                                    Showing{' '}
                                    <span className="font-semibold text-gray-900">{filteredItems.length}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{items.length}</span>
                                </p>
                            </div>

                            {filtersOpen ? (
                                <WalletTransactionFilters
                                    filters={filters}
                                    options={filterOptions}
                                    onChange={setFilters}
                                />
                            ) : null}
                        </div>

                        {loading && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                Loading wallet transactions…
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="min-w-0">
                            <WalletTransactionsTable items={pagination.pageItems} loading={loading} />
                        </div>

                        <div className="mt-4 min-w-0">
                            <WalletTransactionPagination
                                page={pagination.safePage}
                                pageSize={pageSize}
                                totalItems={filteredItems.length}
                                totalPages={pagination.totalPages}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default WalletTransactionsPage;
