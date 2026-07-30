'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { AdminStatusBadge } from '@/components/admin/data-table';
import { getWalletTransactionEventTone } from '@/lib/wallet-transaction-display';
import type { WalletTransactionEventId } from '@/lib/wallet-transaction-display';
import { formatBookingShortId } from '@/lib/booking-display';

interface ProviderWalletTransactionItem {
    id: string;
    createdDate: string;
    amount: string;
    isCredit: boolean;
    note: string;
    transactionId: string;
    paymentType: string;
    walletEvent: WalletTransactionEventId;
    walletEventLabel: string;
    bookingServiceName: string;
    bookingCustomerName: string;
    bookingStatus: string;
}

interface ProviderWalletStats {
    count: number;
    ledgerNet: number;
    storedWalletAmount: number;
    ledgerMatchesStored: boolean;
}

interface ProviderWalletHistoryProps {
    providerId: string;
    fallbackWalletAmount?: number;
}

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedAmount(value: number, isCredit: boolean): string {
    const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${isCredit ? '+' : '−'}${formatted}`;
}

export function ProviderWalletHistory({ providerId, fallbackWalletAmount = 0 }: ProviderWalletHistoryProps) {
    const [items, setItems] = useState<ProviderWalletTransactionItem[]>([]);
    const [stats, setStats] = useState<ProviderWalletStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/providers/${providerId}/wallet-transactions`);
            const payload = (await response.json()) as {
                data?: ProviderWalletTransactionItem[];
                stats?: ProviderWalletStats;
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load wallet history');
            }
            setItems(payload.data ?? []);
            setStats(payload.stats ?? null);
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load wallet history');
            setItems([]);
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const storedWallet = stats?.storedWalletAmount ?? fallbackWalletAmount;
    const ledgerNet = stats?.ledgerNet ?? 0;

    return (
        <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Wallet history</h2>
                    <p className="mt-1 text-sm text-gray-600">Ledger credits and debits for this provider.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void loadHistory()}
                        disabled={loading}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <Link
                        href="/admin/finance/wallet-transactions"
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-gray-50"
                    >
                        All wallet transactions
                        <ExternalLink className="h-4 w-4" />
                    </Link>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stored wallet</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(storedWallet)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ledger net</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(ledgerNet)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transactions</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{stats?.count ?? (loading ? '…' : 0)}</p>
                    {stats && !stats.ledgerMatchesStored ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">Stored balance differs from ledger</p>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-8 text-gray-600 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading wallet history…
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-gray-500 shadow-sm">
                    No wallet transactions for this provider.
                </div>
            ) : null}

            {!loading && !error && items.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="w-full border-collapse text-left">
                        <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Event</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">Amount (ETB)</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Note</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Booking</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item) => {
                                const amount = Number.parseFloat(item.amount);
                                const parsedAmount = Number.isFinite(amount) ? amount : 0;

                                return (
                                    <tr key={item.id} className="align-top hover:bg-gray-50/80">
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                                            {formatAdminDateTimeUtc(item.createdDate)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <AdminStatusBadge
                                                tone={getWalletTransactionEventTone(item.walletEvent)}
                                                className="rounded-md"
                                            >
                                                {item.walletEventLabel}
                                            </AdminStatusBadge>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <span
                                                className={`text-sm font-bold tabular-nums ${
                                                    item.isCredit ? 'text-emerald-600' : 'text-rose-600'
                                                }`}
                                            >
                                                {formatSignedAmount(parsedAmount, item.isCredit)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="line-clamp-2 text-sm text-gray-700">{item.note || '—'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {item.bookingServiceName ? (
                                                <div className="space-y-1">
                                                    <p className="font-medium text-gray-900">{item.bookingServiceName}</p>
                                                    {item.bookingCustomerName ? (
                                                        <p className="text-xs text-gray-500">{item.bookingCustomerName}</p>
                                                    ) : null}
                                                    {item.transactionId ? (
                                                        <p className="font-mono text-[11px] text-gray-500">
                                                            #{formatBookingShortId(item.transactionId)}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : item.transactionId ? (
                                                <span className="font-mono text-[11px] text-gray-500">
                                                    #{formatBookingShortId(item.transactionId)}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
