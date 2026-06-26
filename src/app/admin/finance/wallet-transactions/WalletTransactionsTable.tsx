'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy } from 'lucide-react';
import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';
import { walletProfileAndAuthShareId } from '@/lib/wallet-transaction-auth-resolve';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { AdminDataTableEmpty, AdminTableShell } from '@/components/admin/data-table';

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
    return isCredit ? 'text-emerald-600' : 'text-red-600';
}

function DirectionBadge({ isCredit }: { isCredit: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                isCredit
                    ? 'bg-emerald-50 text-emerald-600 ring-emerald-600/25'
                    : 'bg-red-50 text-red-600 ring-red-600/25'
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
            : normalized === 'provider' || normalized === 'provider_payout'
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

function CopyableMono({
    value,
    label,
}: {
    value: string;
    label?: string;
}) {
    const [copied, setCopied] = useState(false);

    if (!value.trim()) return null;

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
            className="group mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-gray-400 hover:text-gray-600"
        >
            {label ? <span className="font-sans">{label}</span> : null}
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
    sharedAuthUserId,
}: {
    name: string;
    email?: string;
    phone?: string;
    profileId?: string;
    profileHref?: string;
    sharedAuthUserId?: string;
}) {
    if (!name && !email && !phone && !profileId) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const title = [name, email, phone, profileId].filter(Boolean).join(' · ');

    return (
        <div className="min-w-0 max-w-[188px]" title={title}>
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
                        {sharedAuthUserId ? 'profile / auth' : 'profile'} {formatShortId(profileId)}
                    </Link>
                ) : (
                    <CopyableMono
                        value={profileId}
                        label={sharedAuthUserId ? 'profile / auth' : 'profile'}
                    />
                )
            ) : null}
        </div>
    );
}

function AuthUserCell({
    name,
    email,
    phone,
    authUserId,
    profileId,
    userIdStoredAsProfile,
}: {
    name: string;
    email?: string;
    phone?: string;
    authUserId: string;
    profileId?: string;
    userIdStoredAsProfile?: boolean;
}) {
    if (!authUserId.trim() && !name && !email && !phone) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    const sharesProfileId = walletProfileAndAuthShareId(profileId ?? '', authUserId);
    const title = [name, email, phone, authUserId].filter(Boolean).join(' · ');

    return (
        <div className="min-w-0 max-w-[188px]" title={title}>
            <div className="truncate text-sm font-medium text-gray-900">{name || 'Unknown auth user'}</div>
            {email ? <div className="mt-0.5 truncate text-xs text-gray-600">{email}</div> : null}
            {phone ? <div className="mt-0.5 truncate text-xs text-gray-500">{phone}</div> : null}
            {userIdStoredAsProfile ? (
                <div className="mt-0.5 text-[11px] font-medium text-amber-700">
                    Ledger userId is profile id — auth id differs
                </div>
            ) : null}
            {authUserId && !sharesProfileId ? <CopyableMono value={authUserId} label="auth" /> : null}
            {sharesProfileId ? (
                <div className="mt-0.5 text-[11px] text-gray-500">Shared profile UUID</div>
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
            <AdminTableShell>
                <AdminDataTableEmpty
                    title="No wallet transactions found"
                    description="Try adjusting your search or filters."
                />
            </AdminTableShell>
        );
    }

    return (
        <AdminTableShell>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1440px] table-fixed border-collapse text-left">
                    <colgroup>
                        <col className="w-[168px]" />
                        <col className="w-[96px]" />
                        <col className="w-[120px]" />
                        <col className="w-[108px]" />
                        <col className="w-[96px]" />
                        <col className="w-[188px]" />
                        <col className="w-[188px]" />
                        <col className="w-[120px]" />
                        <col className="w-[120px]" />
                        <col />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {[
                                'Date',
                                'Direction',
                                'Amount',
                                'Type',
                                'Payment',
                                'Customer',
                                'Provider',
                                'Auth user',
                                'Transaction',
                                'Note',
                            ].map((heading) => (
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
                            const customerProfileId = item.customerProfileId || item.customer_id || '';
                            const providerProfileId = item.providerProfileId || item.provider_id || '';
                            const authUserId = item.authUserId || item.userId;
                            const sharedCustomerAuthId = walletProfileAndAuthShareId(
                                customerProfileId,
                                authUserId
                            )
                                ? authUserId
                                : undefined;

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
                                            className={`tabular-nums text-sm font-bold ${directionTone(item.isCredit)}`}
                                        >
                                            {formatSignedAmount(amount, item.isCredit)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <TypeBadge type={item.type} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PaymentTypeBadge paymentType={item.paymentType} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <ProfileCell
                                            name={item.customerName}
                                            email={item.customerEmail || undefined}
                                            phone={item.customerPhone || undefined}
                                            profileId={customerProfileId || undefined}
                                            sharedAuthUserId={sharedCustomerAuthId}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <ProfileCell
                                            name={item.providerName}
                                            email={item.providerEmail || undefined}
                                            phone={item.providerPhone || undefined}
                                            profileId={providerProfileId || undefined}
                                            profileHref={
                                                providerProfileId
                                                    ? `/admin/providers/${providerProfileId}`
                                                    : undefined
                                            }
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <AuthUserCell
                                            name={item.authUserName}
                                            email={item.authUserEmail || undefined}
                                            phone={item.authUserPhone || undefined}
                                            authUserId={authUserId}
                                            profileId={customerProfileId || providerProfileId || undefined}
                                            userIdStoredAsProfile={item.userIdStoredAsProfile}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <CopyableMono value={item.transactionId} label="tx" />
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
        </AdminTableShell>
    );
}
