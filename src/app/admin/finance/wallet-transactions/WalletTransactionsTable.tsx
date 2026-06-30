'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';
import { walletProfileAndAuthShareId } from '@/lib/wallet-transaction-auth-resolve';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { formatBookingShortId } from '@/lib/booking-display';
import {
    formatBookingAmountLabel,
    getWalletPaymentDisplayTone,
    getWalletTransactionEventTone,
} from '@/lib/wallet-transaction-display';
import {
    getWalletTransactionTypeTone,
} from '@/lib/admin-status-badge';
import {
    visibleWalletTransactionColumns,
    type WalletTransactionColumnId,
    type WalletTransactionColumnVisibility,
} from '@/lib/wallet-transaction-columns';
import { AdminDataTableEmpty, AdminStatusBadge, AdminTableShell } from '@/components/admin/data-table';
import { WalletTransactionIssuesCell } from './WalletTransactionIssuesCell';

function formatShortId(value: string): string {
    if (!value) return '—';
    if (value.length <= 13) return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function toAmount(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatSignedAmount(value: number, isCredit: boolean): string {
    const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const prefix = isCredit ? '+' : '−';
    return `${prefix}ETB ${formatted}`;
}

function directionTone(isCredit: boolean): string {
    return isCredit ? 'text-emerald-600' : 'text-destructive';
}

function TypeBadge({ type }: { type: string }) {
    return (
        <AdminStatusBadge tone={getWalletTransactionTypeTone(type)} className="capitalize rounded-md">
            {type || '—'}
        </AdminStatusBadge>
    );
}

function PaymentTypeBadge({ item }: { item: WalletTransaction }) {
    const label = item.paymentDisplayLabel || item.paymentType;
    if (!label.trim()) return <span className="text-sm text-gray-400">—</span>;

    return (
        <AdminStatusBadge
            tone={getWalletPaymentDisplayTone({
                paymentType: item.paymentType,
                note: item.note,
                isCredit: item.isCredit,
                type: item.type,
            })}
            className="capitalize rounded-md"
        >
            {label}
        </AdminStatusBadge>
    );
}

function EventBadge({ item }: { item: WalletTransaction }) {
    return (
        <AdminStatusBadge tone={getWalletTransactionEventTone(item.walletEvent)} className="rounded-md">
            {item.walletEventLabel}
        </AdminStatusBadge>
    );
}

function CopyableMono({
    value,
    label,
}: {
    value: string;
    label?: string;
}) {
    const [copied, setCopied] = useState(false);

    if (!value.trim()) return <span className="text-sm text-gray-400">—</span>;

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${label ?? 'id'}: ${value}`}
            className="group inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-gray-500 hover:text-gray-700"
        >
            {label ? <span className="font-sans text-xs text-gray-600">{label}</span> : null}
            <span className="truncate">{formatShortId(value)}</span>
            {copied ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-600" />
            ) : (
                <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
        </button>
    );
}

function ProfileCell({
    name,
    email,
    phone,
    profileId,
    profileHref,
}: {
    name: string;
    email?: string;
    phone?: string;
    profileId?: string;
    profileHref?: string;
}) {
    if (!name && !email && !phone && !profileId) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const title = [name, email, phone, profileId].filter(Boolean).join(' · ');

    return (
        <div className="min-w-0" title={title}>
            <div className="truncate text-sm font-medium text-gray-900">{name || 'Unknown'}</div>
            {email ? <div className="mt-0.5 truncate text-xs text-gray-600">{email}</div> : null}
            {phone ? <div className="mt-0.5 truncate text-xs text-gray-500">{phone}</div> : null}
            {profileId ? (
                profileHref ? (
                    <Link
                        href={profileHref}
                        className="mt-0.5 block truncate font-mono text-[11px] text-indigo-600 hover:underline"
                        title={profileId}
                    >
                        {formatShortId(profileId)}
                    </Link>
                ) : (
                    <CopyableMono value={profileId} />
                )
            ) : null}
        </div>
    );
}

function UserCell({
    name,
    email,
    phone,
    userId,
    profileId,
    userIdStoredAsProfile,
}: {
    name: string;
    email?: string;
    phone?: string;
    userId: string;
    profileId?: string;
    userIdStoredAsProfile?: boolean;
}) {
    if (!userId.trim() && !name && !email && !phone) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const sharesProfileId = walletProfileAndAuthShareId(profileId ?? '', userId);
    const title = [name, email, phone, userId].filter(Boolean).join(' · ');

    return (
        <div className="min-w-0" title={title}>
            <div className="truncate text-sm font-medium text-gray-900">{name || 'Unknown user'}</div>
            {email ? <div className="mt-0.5 truncate text-xs text-gray-600">{email}</div> : null}
            {phone ? <div className="mt-0.5 truncate text-xs text-gray-500">{phone}</div> : null}
            {userIdStoredAsProfile ? (
                <div className="mt-0.5 text-[11px] font-medium text-amber-700">userId matches profile id</div>
            ) : null}
            {userId && !sharesProfileId ? <CopyableMono value={userId} label="userId" /> : null}
            {sharesProfileId ? <div className="mt-0.5 text-[11px] text-gray-500">Same as profile id</div> : null}
        </div>
    );
}

function BookingTotalCell({ item }: { item: WalletTransaction }) {
    if (item.bookingTotalAmount === null) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const commission =
        item.bookingAdminCommission !== null && item.bookingAdminCommission > 0
            ? formatBookingAmountLabel(item.bookingAdminCommission)
            : null;

    return (
        <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">
                {formatBookingAmountLabel(item.bookingTotalAmount)}
            </div>
            {commission ? (
                <div className="mt-0.5 text-xs text-gray-500">Commission {commission}</div>
            ) : null}
        </div>
    );
}

interface WalletTransactionsTableProps {
    items: WalletTransaction[];
    loading: boolean;
    columnVisibility: WalletTransactionColumnVisibility;
}

export function WalletTransactionsTable({
    items,
    loading,
    columnVisibility,
}: WalletTransactionsTableProps) {
    const columns = visibleWalletTransactionColumns(columnVisibility);

    if (!loading && items.length === 0) {
        return (
            <AdminTableShell className="w-full">
                <AdminDataTableEmpty
                    title="No wallet transactions found"
                    description="Try adjusting your search or filters."
                />
            </AdminTableShell>
        );
    }

    function renderCell(columnId: WalletTransactionColumnId, item: WalletTransaction): ReactNode {
        const amount = toAmount(item.amount);
        const customerProfileId = item.customerProfileId || item.customer_id || '';
        const providerProfileId = item.providerProfileId || item.provider_id || '';
        const userId = item.authUserId || item.userId;
        const customerName = item.customerName || item.bookingCustomerName;
        const customerEmail = item.customerEmail;

        switch (columnId) {
            case 'date':
                return (
                    <td key={columnId} className="whitespace-nowrap px-4 py-3 align-top text-xs text-gray-600">
                        {formatAdminDateTimeUtc(item.createdDate)}
                    </td>
                );
            case 'amount':
                return (
                    <td key={columnId} className="whitespace-nowrap px-4 py-3 align-top text-sm">
                        <span
                            className={`tabular-nums text-sm font-bold ${directionTone(item.isCredit)}`}
                            title={item.isCredit ? 'Credit' : 'Debit'}
                        >
                            {formatSignedAmount(amount, item.isCredit)}
                        </span>
                    </td>
                );
            case 'event':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <EventBadge item={item} />
                    </td>
                );
            case 'type':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <TypeBadge type={item.type} />
                    </td>
                );
            case 'payment':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <PaymentTypeBadge item={item} />
                    </td>
                );
            case 'issues':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <WalletTransactionIssuesCell issues={item.issues ?? []} />
                    </td>
                );
            case 'customer':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <ProfileCell
                            name={customerName}
                            email={customerEmail || undefined}
                            phone={item.customerPhone || undefined}
                            profileId={customerProfileId || undefined}
                        />
                    </td>
                );
            case 'provider':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <ProfileCell
                            name={item.providerName}
                            email={item.providerEmail || undefined}
                            phone={item.providerPhone || undefined}
                            profileId={providerProfileId || undefined}
                            profileHref={
                                providerProfileId ? `/admin/providers/${providerProfileId}` : undefined
                            }
                        />
                    </td>
                );
            case 'user':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <UserCell
                            name={item.authUserName}
                            email={item.authUserEmail || undefined}
                            phone={item.authUserPhone || undefined}
                            userId={userId}
                            profileId={customerProfileId || providerProfileId || undefined}
                            userIdStoredAsProfile={item.userIdStoredAsProfile}
                        />
                    </td>
                );
            case 'service':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <span className="line-clamp-2 text-sm text-gray-700" title={item.bookingServiceName}>
                            {item.bookingServiceName || '—'}
                        </span>
                    </td>
                );
            case 'bookingTotal':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <BookingTotalCell item={item} />
                    </td>
                );
            case 'transactionId':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        {item.transactionId ? (
                            <div className="space-y-1">
                                <CopyableMono value={item.transactionId} />
                                {item.transactionId.length >= 8 ? (
                                    <div className="font-mono text-[11px] text-gray-500">
                                        #{formatBookingShortId(item.transactionId)}
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <span className="text-sm text-gray-400">—</span>
                        )}
                    </td>
                );
            case 'note':
                return (
                    <td key={columnId} className="px-4 py-3 align-top">
                        <span className="line-clamp-2 text-sm text-gray-600" title={item.note}>
                            {item.note || '—'}
                        </span>
                    </td>
                );
            default:
                return <td key={columnId} className="px-4 py-3" />;
        }
    }

    return (
        <AdminTableShell className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        {columns.map((column) => (
                            <th
                                key={column.id}
                                className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500"
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                        <tr key={item.id} className="bg-white transition-colors hover:bg-gray-50/80">
                            {columns.map((column) => renderCell(column.id, item))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </AdminTableShell>
    );
}
