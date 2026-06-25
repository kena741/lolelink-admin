'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';

function formatShortId(value: string): string {
    if (!value) return '—';
    return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function toAmount(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
    return `ETB ${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function DirectionBadge({ isCredit }: { isCredit: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                isCredit
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-rose-50 text-rose-700 ring-rose-600/20'
            }`}
        >
            {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {isCredit ? 'Credit' : 'Debit'}
        </span>
    );
}

function TypeBadge({ type }: { type: string }) {
    const normalized = type.toLowerCase();
    const style =
        normalized === 'customer'
            ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
            : normalized === 'provider'
              ? 'bg-violet-50 text-violet-700 ring-violet-600/20'
              : 'bg-gray-50 text-gray-700 ring-gray-500/20';

    return (
        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${style}`}>
            {type || '—'}
        </span>
    );
}

function PaymentTypeBadge({ paymentType }: { paymentType: string }) {
    const normalized = paymentType.toLowerCase();
    if (!normalized) return <span className="text-sm text-gray-400">—</span>;

    const style =
        normalized === 'chapa'
            ? 'bg-violet-50 text-violet-700 ring-violet-600/20'
            : normalized === 'wallet'
              ? 'bg-slate-50 text-slate-700 ring-slate-600/20'
              : 'bg-gray-50 text-gray-700 ring-gray-500/20';

    return (
        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${style}`}>
            {paymentType}
        </span>
    );
}

function PersonCell({ name, meta }: { name: string; meta?: string }) {
    return (
        <div className="min-w-0 max-w-[168px]">
            <div className="truncate text-sm font-medium text-gray-900" title={name}>
                {name}
            </div>
            {meta ? (
                <div className="mt-0.5 truncate text-xs text-gray-500" title={meta}>
                    {meta}
                </div>
            ) : null}
        </div>
    );
}

interface WalletTransactionsTableProps {
    items: WalletTransaction[];
    loading: boolean;
}

export function WalletTransactionsTable({ items, loading }: WalletTransactionsTableProps) {
    if (!loading && items.length === 0) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
                <p className="text-base font-medium text-gray-900">No wallet transactions found</p>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
                    <colgroup>
                        <col className="w-[168px]" />
                        <col className="w-[96px]" />
                        <col className="w-[120px]" />
                        <col className="w-[96px]" />
                        <col className="w-[96px]" />
                        <col className="w-[168px]" />
                        <col className="w-[148px]" />
                        <col />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {['Date', 'Direction', 'Amount', 'Type', 'Payment', 'User', 'Transaction', 'Note'].map((heading) => (
                                <th
                                    key={heading}
                                    className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500"
                                >
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map((item) => {
                            const amount = toAmount(item.amount);
                            return (
                                <tr key={item.id} className="bg-white transition-colors hover:bg-gray-50/80">
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-gray-600">
                                        {formatAdminDateTimeUtc(item.createdDate)}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <DirectionBadge isCredit={item.isCredit} />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
                                        <span
                                            className={`tabular-nums font-semibold ${
                                                item.isCredit ? 'text-emerald-700' : 'text-rose-600'
                                            }`}
                                        >
                                            {formatAmount(amount)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <TypeBadge type={item.type} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PaymentTypeBadge paymentType={item.paymentType} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PersonCell
                                            name={item.providerName || 'Unknown user'}
                                            meta={item.providerPhone || item.userId || undefined}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className="font-mono text-xs font-semibold text-gray-700"
                                            title={item.transactionId}
                                        >
                                            {formatShortId(item.transactionId)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span className="line-clamp-2 text-sm text-gray-600" title={item.note}>
                                            {item.note || '—'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
