'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className={`mb-1 text-sm font-semibold ${titleClassName ?? 'text-gray-500'}`}>{title}</p>
            <p className={`text-2xl font-bold tabular-nums ${valueClassName ?? 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

const WalletTransactionsPage = () => {
    const dispatch = useAppDispatch();
    const { items, loading, error } = useAppSelector((state) => state.walletTransaction);
    const [query, setQuery] = useState('');
    const [directionFilter, setDirectionFilter] = useState<'all' | 'credit' | 'debit'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'provider'>('all');

    useEffect(() => {
        dispatch(fetchWalletTransactions());
    }, [dispatch]);

    const filteredItems = useMemo(() => {
        const lowerQuery = query.trim().toLowerCase();
        return items.filter((item) => {
            const matchesDirection =
                directionFilter === 'all' ||
                (directionFilter === 'credit' && item.isCredit) ||
                (directionFilter === 'debit' && !item.isCredit);

            const matchesType =
                typeFilter === 'all' || item.type.toLowerCase() === typeFilter;

            if (!matchesDirection || !matchesType) return false;
            if (!lowerQuery) return true;

            return (
                item.transactionId.toLowerCase().includes(lowerQuery) ||
                item.userId.toLowerCase().includes(lowerQuery) ||
                item.providerName.toLowerCase().includes(lowerQuery) ||
                item.providerPhone.toLowerCase().includes(lowerQuery) ||
                item.type.toLowerCase().includes(lowerQuery) ||
                item.paymentType.toLowerCase().includes(lowerQuery) ||
                item.note.toLowerCase().includes(lowerQuery)
            );
        });
    }, [items, query, directionFilter, typeFilter]);

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

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Wallet Transactions"
                            description="Ledger credits and debits across customers and providers"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Wallet Transactions' },
                            ]}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => dispatch(fetchWalletTransactions())}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />

                        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

                        <div className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="w-full lg:max-w-md">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Search user ID, name, phone, transaction ID, note…"
                                            className="h-10 w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-semibold text-gray-900">{filteredItems.length}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{items.length}</span> transactions
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={directionFilter}
                                    onChange={(event) => setDirectionFilter(event.target.value as 'all' | 'credit' | 'debit')}
                                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="all">All directions</option>
                                    <option value="credit">Credits only</option>
                                    <option value="debit">Debits only</option>
                                </select>
                                <select
                                    value={typeFilter}
                                    onChange={(event) => setTypeFilter(event.target.value as 'all' | 'customer' | 'provider')}
                                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="all">All user types</option>
                                    <option value="customer">Customer</option>
                                    <option value="provider">Provider</option>
                                </select>
                            </div>
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

                        <WalletTransactionsTable items={filteredItems} loading={loading} />
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default WalletTransactionsPage;
