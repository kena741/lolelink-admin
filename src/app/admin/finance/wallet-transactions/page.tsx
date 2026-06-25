'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchWalletTransactions } from '@/features/walletTransaction/walletTransactionSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    buildUserIdsWithProviderActivation,
    parseWalletAmount,
    shouldExcludeFromAdjustedCredit,
    sumDebits,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '@/lib/wallet-transaction-metrics';

function formatDate(value: string) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function toAmount(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number) {
    return `ETB ${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

const WalletTransactionsPage = () => {
    const dispatch = useAppDispatch();
    const { items, loading, error } = useAppSelector((state) => state.walletTransaction);
    const [query, setQuery] = useState('');
    const [directionFilter, setDirectionFilter] = useState<'all' | 'credit' | 'debit'>('all');

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

            if (!matchesDirection) return false;
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
    }, [items, query, directionFilter]);

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
                        <section className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
                            <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Transactions</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Credits</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.creditCount}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Debits</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.debitCount}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Total Credit</p>
                                <p className="text-xl font-bold text-emerald-700">
                                    {loading ? '...' : formatAmount(stats.totalCredit)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Total Debit</p>
                                <p className="text-xl font-bold text-red-700">{loading ? '...' : formatAmount(stats.totalDebit)}</p>
                            </div>
                        </section>

                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search name, phone, transactionId, type, note..."
                                className="w-full sm:w-[460px] rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            <select
                                value={directionFilter}
                                onChange={(event) => setDirectionFilter(event.target.value as 'all' | 'credit' | 'debit')}
                                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                <option value="all">All</option>
                                <option value="credit">Credits</option>
                                <option value="debit">Debits</option>
                            </select>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl">
                            {error && (
                                <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
                                    {error}
                                </div>
                            )}

                            {loading ? (
                                <div className="p-8 text-center">
                                    <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-gray-600">Loading wallet transactions...</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b border-white/20 bg-muted/50">
                                                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Direction</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Type</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Payment Type</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Transaction ID</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                                        No wallet transactions found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredItems.map((item) => {
                                                    const amount = toAmount(item.amount);
                                                    return (
                                                        <TableRow
                                                            key={item.id}
                                                            className="border-b border-white/20 transition-all hover:bg-muted/40"
                                                        >
                                                            <TableCell className="text-gray-700">{formatDate(item.createdDate)}</TableCell>
                                                            <TableCell>
                                                                <span
                                                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                        item.isCredit
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                            : 'border-red-200 bg-red-50 text-red-700'
                                                                    }`}
                                                                >
                                                                    {item.isCredit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                                                                    {item.isCredit ? 'Credit' : 'Debit'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className={`font-semibold ${item.isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {formatAmount(amount)}
                                                            </TableCell>
                                                            <TableCell className="text-gray-700">{item.type || '—'}</TableCell>
                                                            <TableCell className="text-gray-700">{item.paymentType || '—'}</TableCell>
                                                            <TableCell className="max-w-[180px] truncate font-medium text-gray-900">
                                                                {item.providerName || '—'}
                                                            </TableCell>
                                                            <TableCell className="max-w-[160px] truncate text-gray-700">
                                                                {item.providerPhone || '—'}
                                                            </TableCell>
                                                            <TableCell className="max-w-[220px] truncate text-gray-700">{item.transactionId || '—'}</TableCell>
                                                            <TableCell className="max-w-[260px] truncate text-gray-700">{item.note || '—'}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default WalletTransactionsPage;
