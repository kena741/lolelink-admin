'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    Archive,
    ArchiveRestore,
    ArrowRightLeft,
    Briefcase,
    CheckCircle2,
    ClipboardList,
    Coins,
    ExternalLink,
    Loader2,
    Pencil,
    Trash2,
    UserRound,
    Wallet,
    Megaphone,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { AdminStatusBadge } from '@/components/admin/data-table';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { formatBookingAmount } from '@/lib/booking-display';
import {
    customerIsArchived,
    formatCustomerAddress,
    getCustomerDisplayName,
    getCustomerPhone,
} from '@/lib/customer-display';
import { useAppDispatch } from '@/store/hooks';
import {
    archiveCustomer,
    convertToProvider,
    deleteCustomer,
    restoreCustomer,
} from '@/features/customer/customerSlice';
import { CustomerWalletHistory } from './CustomerWalletHistory';
import { AdminNoteField } from '@/components/AdminNoteField';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { AdminNotifyComposer } from '@/components/admin/AdminNotifyComposer';
import {
    createAdminNotifyDraft,
    sendAdminCustomerNotify,
    type AdminNotifyDraft,
} from '@/lib/admin-notify';

interface CustomerNotifyStatus {
    fcmRegistered: boolean;
    smsReady: boolean;
    smsRecipient?: string;
    reason?: string | null;
    debug?: { customerId?: string; phoneRow?: Record<string, unknown> | null };
}

interface CustomerDetail {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    user_name?: string | null;
    email?: string | null;
    gender?: string | null;
    status?: string | null;
    active?: boolean | null;
    wallet_amount?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    archived_at?: string | null;
    user_id?: string | null;
    login_type?: string | null;
    profile_pic?: string | null;
    promo_code?: string | null;
    provider_id?: string | null;
    default_address?: unknown;
    customer_addresses?: unknown;
    address?: string | null;
    admin_note?: string | null;
}

interface CustomerStats {
    bookingCount: number;
    totalSpent: number;
    jobRequestCount: number;
    lastBookingAt: string | null;
}

interface CustomerBookingRow {
    id: string;
    serviceName: string;
    status: string;
    paymentStatus: string;
    paymentCompleted: boolean;
    amount: string;
    createdAt: string;
    providerId: string;
    providerName: string;
}

interface CustomerJobRequestRow {
    id: string;
    createdAt: string;
    title: string;
    description: string;
    status: string;
    accepted: boolean;
    isPaid: boolean;
    price: string;
    serviceName: string;
    bidCount: number;
}

type CustomerTab = 'bookings' | 'wallet' | 'job_requests' | 'profile' | 'notifications';

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatJsonValue(value: unknown): string {
    if (value == null) return '—';
    if (typeof value === 'string') {
        try {
            return JSON.stringify(JSON.parse(value), null, 2);
        } catch {
            return value;
        }
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '—';
    }
}

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { canWriteCustomers } = useAdminPermissions();
    const customerId = (params?.id as string) || '';

    const [customer, setCustomer] = useState<CustomerDetail | null>(null);
    const [stats, setStats] = useState<CustomerStats | null>(null);
    const [bookings, setBookings] = useState<CustomerBookingRow[]>([]);
    const [jobRequests, setJobRequests] = useState<CustomerJobRequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<CustomerTab>('bookings');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [confirmConvert, setConfirmConvert] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [convertedProviderId, setConvertedProviderId] = useState<string | null>(null);
    const [editingJobRequest, setEditingJobRequest] = useState<CustomerJobRequestRow | null>(null);
    const [editJobForm, setEditJobForm] = useState({ title: '', description: '', price: '' });
    const [deletingJobRequest, setDeletingJobRequest] = useState<CustomerJobRequestRow | null>(null);
    const [notifyDraft, setNotifyDraft] = useState<AdminNotifyDraft>(
        createAdminNotifyDraft(
            {
                title: 'Update from Zemen Service',
                body: 'Hello, we have an update for your account.',
            },
            'both'
        )
    );
    const [notifyRoute, setNotifyRoute] = useState('/home');
    const [notifySending, setNotifySending] = useState(false);
    const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
    const [notifyStatus, setNotifyStatus] = useState<CustomerNotifyStatus | null>(null);
    const [notifyStatusLoading, setNotifyStatusLoading] = useState(false);

    const loadCustomer = useCallback(async () => {
        if (!customerId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}`);
            const payload = (await response.json()) as {
                customer?: CustomerDetail;
                stats?: CustomerStats;
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load customer');
            }
            setCustomer(payload.customer ?? null);
            setStats(payload.stats ?? null);
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load customer');
            setCustomer(null);
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    const loadBookings = useCallback(async () => {
        if (!customerId) return;
        setTabLoading(true);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/bookings`);
            const payload = (await response.json()) as { data?: CustomerBookingRow[]; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to load bookings');
            setBookings(payload.data ?? []);
        } catch {
            setBookings([]);
        } finally {
            setTabLoading(false);
        }
    }, [customerId]);

    const loadJobRequests = useCallback(async () => {
        if (!customerId) return;
        setTabLoading(true);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/job-requests`);
            const payload = (await response.json()) as { data?: CustomerJobRequestRow[]; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to load job requests');
            setJobRequests(payload.data ?? []);
        } catch {
            setJobRequests([]);
        } finally {
            setTabLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        void loadCustomer();
    }, [loadCustomer]);

    useEffect(() => {
        if (!customerId) return;
        if (activeTab === 'bookings') void loadBookings();
        if (activeTab === 'job_requests') void loadJobRequests();
    }, [activeTab, customerId, loadBookings, loadJobRequests]);

    const displayName = getCustomerDisplayName(customer);
    const phone = getCustomerPhone(customer as Record<string, unknown> | null);
    const address = formatCustomerAddress(customer);
    const archived = customerIsArchived(customer);
    const walletBalance = Number(customer?.wallet_amount ?? 0);
    const customerHasPushToken = notifyStatus?.fcmRegistered ?? false;
    const notifyNeedsPush = notifyDraft.channel === 'push' || notifyDraft.channel === 'both';
    const notifyNeedsSms = notifyDraft.channel === 'sms' || notifyDraft.channel === 'both';
    const customerHasSmsRecipient = notifyStatus?.smsReady ?? false;
    const cannotDeliverSelectedChannel =
        (notifyDraft.channel === 'push' && !customerHasPushToken)
        || (notifyDraft.channel === 'sms' && !customerHasSmsRecipient)
        || (notifyDraft.channel === 'both' && (!customerHasPushToken || !customerHasSmsRecipient));

    useEffect(() => {
        if (!customerId) return;
        const name = displayName === '—' ? 'there' : displayName;
        setNotifyDraft(
            createAdminNotifyDraft(
                {
                    title: 'Update from Zemen Service',
                    body: `Hello ${name}, we have an update for your account.`,
                },
                'both'
            )
        );
        setNotifyRoute('/home');
        setNotifyMessage(null);
    }, [customerId, displayName]);

    useEffect(() => {
        if (!customerId || activeTab !== 'notifications') return;
        let cancelled = false;
        setNotifyStatusLoading(true);
        void (async () => {
            try {
                const response = await fetch(`/api/admin/push/customers/${customerId}`);
                const data = (await response.json()) as CustomerNotifyStatus;
                if (!cancelled && response.ok) setNotifyStatus(data);
            } catch {
                if (!cancelled) setNotifyStatus(null);
            } finally {
                if (!cancelled) setNotifyStatusLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customerId, activeTab]);

    async function handleArchiveToggle() {
        if (!customerId || !customer) return;
        setActionBusy(true);
        setActionError(null);
        const thunk = archived ? restoreCustomer(customerId) : archiveCustomer(customerId);
        const result = await dispatch(thunk);
        setActionBusy(false);
        const rejectedMatcher = archived ? restoreCustomer.rejected : archiveCustomer.rejected;
        if (rejectedMatcher.match(result)) {
            setActionError(result.payload as string);
            return;
        }
        await loadCustomer();
    }

    async function handleConvert() {
        if (!customerId) return;
        setConfirmConvert(false);
        setActionBusy(true);
        setActionError(null);

        const jobRequestCount = stats?.jobRequestCount ?? jobRequests.length;
        if (jobRequestCount > 0) {
            const deleteResponse = await fetch('/api/job-requests', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });
            const deletePayload = (await deleteResponse.json()) as { error?: string };
            if (!deleteResponse.ok) {
                setActionBusy(false);
                setActionError(deletePayload.error || 'Failed to delete job requests');
                return;
            }
            setJobRequests([]);
            setStats((prev) => (prev ? { ...prev, jobRequestCount: 0 } : prev));
        }

        const result = await dispatch(convertToProvider(customerId));
        setActionBusy(false);
        if (convertToProvider.fulfilled.match(result)) {
            setConvertedProviderId(result.payload.providerId);
            return;
        }
        setActionError((result.payload as string) || 'Conversion failed');
    }

    async function saveJobRequestEdit() {
        if (!editingJobRequest) return;
        setActionBusy(true);
        setActionError(null);
        try {
            const response = await fetch('/api/job-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingJobRequest.id,
                    title: editJobForm.title,
                    description: editJobForm.description,
                    price: editJobForm.price,
                }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to update job request');
            setJobRequests((prev) =>
                prev.map((row) =>
                    row.id === editingJobRequest.id
                        ? {
                              ...row,
                              title: editJobForm.title,
                              description: editJobForm.description,
                              price: editJobForm.price,
                          }
                        : row
                )
            );
            setEditingJobRequest(null);
        } catch (error: unknown) {
            setActionError(error instanceof Error ? error.message : 'Failed to update job request');
        } finally {
            setActionBusy(false);
        }
    }

    async function confirmDeleteJobRequest() {
        if (!deletingJobRequest) return;
        setActionBusy(true);
        setActionError(null);
        try {
            const response = await fetch('/api/job-requests', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deletingJobRequest.id }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to delete job request');
            setJobRequests((prev) => prev.filter((row) => row.id !== deletingJobRequest.id));
            setStats((prev) =>
                prev
                    ? { ...prev, jobRequestCount: Math.max(0, prev.jobRequestCount - 1) }
                    : prev
            );
            setDeletingJobRequest(null);
        } catch (error: unknown) {
            setActionError(error instanceof Error ? error.message : 'Failed to delete job request');
        } finally {
            setActionBusy(false);
        }
    }

    async function handleDelete() {
        if (!customerId) return;
        setActionBusy(true);
        setActionError(null);
        const result = await dispatch(deleteCustomer(customerId));
        setActionBusy(false);
        setConfirmDelete(false);
        if (deleteCustomer.rejected.match(result)) {
            setActionError(result.payload as string);
            return;
        }
        router.push('/admin/customers');
    }

    async function handleSendNotification() {
        if (!customerId) return;
        if (cannotDeliverSelectedChannel) {
            setNotifyMessage('Warning: selected channel is not ready (missing phone and/or push token).');
            return;
        }
        setNotifySending(true);
        setNotifyMessage(null);
        const result = await sendAdminCustomerNotify({
            customerId,
            draft: notifyDraft,
            route: notifyRoute.trim() || '/',
        });
        setNotifySending(false);
        setNotifyMessage(result.ok ? 'Notification sent.' : result.error ?? 'Failed to send notification');
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {loading ? (
                        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">Loading customer…</div>
                    ) : null}
                    {error ? (
                        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 text-red-600">{error}</div>
                    ) : null}
                    {!loading && customer ? (
                        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                            <AdminPageHeader
                                title={displayName}
                                description={`${customer.email || '—'} · ${phone || '—'} · ${address}`}
                                backHref="/admin/customers"
                                actions={
                                    canWriteCustomers ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {customer.provider_id ? (
                                                <Link
                                                    href={`/admin/providers/${customer.provider_id}`}
                                                    className={adminHeaderButtonClassName()}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open provider
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmConvert(true)}
                                                    disabled={actionBusy}
                                                    className={adminHeaderButtonClassName()}
                                                >
                                                    <ArrowRightLeft className="h-4 w-4" />
                                                    Convert to provider
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => void handleArchiveToggle()}
                                                disabled={actionBusy}
                                                className={adminHeaderButtonClassName()}
                                            >
                                                {archived ? (
                                                    <ArchiveRestore className="h-4 w-4" />
                                                ) : (
                                                    <Archive className="h-4 w-4" />
                                                )}
                                                {archived ? 'Restore' : 'Archive'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDelete(true)}
                                                disabled={actionBusy}
                                                className={adminHeaderButtonClassName()}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </button>
                                        </div>
                                    ) : null
                                }
                            />

                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                {archived ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                        Archived
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        Active
                                    </span>
                                )}
                                {customer.provider_id ? (
                                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                                        Linked provider
                                    </span>
                                ) : null}
                                <AdminNoteField
                                    value={customer.admin_note}
                                    disabled={!canWriteCustomers}
                                    onSave={async (note) => {
                                        const response = await fetch(`/api/admin/customers/${customerId}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ admin_note: note || null }),
                                        });
                                        const payload = (await response.json()) as { error?: string };
                                        if (!response.ok) throw new Error(payload.error || 'Failed to save note');
                                        setCustomer((prev) => (prev ? { ...prev, admin_note: note || null } : prev));
                                    }}
                                />
                            </div>

                            {actionError ? (
                                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                    {actionError}
                                </div>
                            ) : null}

                            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-lg bg-white p-6 shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-sky-100 p-3">
                                            <Wallet className="h-6 w-6 text-sky-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Wallet balance</p>
                                            <p className="text-2xl font-bold tabular-nums text-gray-900">
                                                {formatCurrency(Number.isFinite(walletBalance) ? walletBalance : 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-white p-6 shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-indigo-100 p-3">
                                            <Briefcase className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Total bookings</p>
                                            <p className="text-2xl font-bold text-gray-900">{stats?.bookingCount ?? 0}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-white p-6 shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-emerald-100 p-3">
                                            <Coins className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Total spent</p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatCurrency(stats?.totalSpent ?? 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-white p-6 shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-amber-100 p-3">
                                            <ClipboardList className="h-6 w-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Job requests</p>
                                            <p className="text-2xl font-bold text-gray-900">{stats?.jobRequestCount ?? 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 shadow">
                                {([
                                    ['bookings', 'Bookings', Briefcase],
                                    ['wallet', 'Wallet', Wallet],
                                    ['job_requests', 'Job requests', ClipboardList],
                                    ['profile', 'Profile', UserRound],
                                    ['notifications', 'Notifications', Megaphone],
                                ] as const).map(([tab, label, Icon]) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                            activeTab === tab
                                                ? 'bg-indigo-500 text-white shadow-md'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'bookings' ? (
                                <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                                    {tabLoading ? (
                                        <div className="flex items-center gap-3 px-4 py-8 text-gray-600">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading bookings…
                                        </div>
                                    ) : bookings.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-500">No bookings for this customer.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-left">
                                                <thead className="border-b border-gray-200 bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Service</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Provider</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Amount</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Booking</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {bookings.map((booking) => (
                                                        <tr key={booking.id} className="hover:bg-gray-50/80">
                                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                                                                {formatAdminDateTimeUtc(booking.createdAt)}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                                {booking.serviceName || '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-700">
                                                                {booking.providerId ? (
                                                                    <Link
                                                                        href={`/admin/providers/${booking.providerId}`}
                                                                        className="text-indigo-600 hover:text-indigo-800"
                                                                    >
                                                                        {booking.providerName || 'Provider'}
                                                                    </Link>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                                                {formatBookingAmount(booking.amount)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <AdminStatusBadge tone="neutral">{booking.status || '—'}</AdminStatusBadge>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <AdminStatusBadge tone={booking.paymentCompleted ? 'success' : 'warning'}>
                                                                    {booking.paymentStatus || (booking.paymentCompleted ? 'paid' : 'pending')}
                                                                </AdminStatusBadge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            ) : null}

                            {activeTab === 'wallet' ? (
                                <CustomerWalletHistory
                                    customerId={customerId}
                                    fallbackWalletAmount={Number.isFinite(walletBalance) ? walletBalance : 0}
                                />
                            ) : null}

                            {activeTab === 'job_requests' ? (
                                <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                                    {tabLoading ? (
                                        <div className="flex items-center gap-3 px-4 py-8 text-gray-600">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading job requests…
                                        </div>
                                    ) : jobRequests.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-500">No job requests for this customer.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-left">
                                                <thead className="border-b border-gray-200 bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Title</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Service</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Bids</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Price</th>
                                                        {canWriteCustomers ? (
                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">Actions</th>
                                                        ) : null}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {jobRequests.map((request) => (
                                                        <tr key={request.id} className="hover:bg-gray-50/80">
                                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                                                                {formatAdminDateTimeUtc(request.createdAt)}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                                {request.title || request.description || '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-700">{request.serviceName || '—'}</td>
                                                            <td className="px-4 py-3">
                                                                <AdminStatusBadge tone={request.accepted ? 'success' : 'neutral'}>
                                                                    {request.status || (request.accepted ? 'accepted' : 'pending')}
                                                                </AdminStatusBadge>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-700">{request.bidCount}</td>
                                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                                                {request.price ? formatBookingAmount(request.price) : '—'}
                                                            </td>
                                                            {canWriteCustomers ? (
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="inline-flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={actionBusy}
                                                                            onClick={() => {
                                                                                setEditingJobRequest(request);
                                                                                setEditJobForm({
                                                                                    title: request.title || '',
                                                                                    description: request.description || '',
                                                                                    price: request.price || '',
                                                                                });
                                                                            }}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                                            aria-label="Edit job request"
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={actionBusy}
                                                                            onClick={() => setDeletingJobRequest(request)}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                                            aria-label="Delete job request"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            ) : null}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            ) : null}

                            {activeTab === 'profile' ? (
                                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                                    <h2 className="mb-4 text-xl font-semibold text-gray-900">Profile</h2>
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                                            <p className="mt-1 text-sm text-gray-900">{customer.email || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
                                            <p className="mt-1 text-sm text-gray-900">{phone || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gender</p>
                                            <p className="mt-1 text-sm capitalize text-gray-900">{customer.gender || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                                            <p className="mt-1 text-sm text-gray-900">{customer.status || (customer.active ? 'active' : '—')}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auth user ID</p>
                                            <p className="mt-1 font-mono text-xs text-gray-900">{customer.user_id || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Login type</p>
                                            <p className="mt-1 text-sm text-gray-900">{customer.login_type || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Promo code</p>
                                            <p className="mt-1 text-sm text-gray-900">{customer.promo_code || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last booking</p>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {stats?.lastBookingAt ? formatAdminDateTimeUtc(stats.lastBookingAt) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created</p>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {customer.created_at ? formatAdminDateTimeUtc(customer.created_at) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Updated</p>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {customer.updated_at ? formatAdminDateTimeUtc(customer.updated_at) : '—'}
                                            </p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Default address</p>
                                            <p className="mt-1 text-sm text-gray-900">{address}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Saved addresses</p>
                                            <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800">
                                                {formatJsonValue(customer.customer_addresses)}
                                            </pre>
                                        </div>
                                    </div>
                                </section>
                            ) : null}

                            {activeTab === 'notifications' ? (
                                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                                    <h2 className="mb-4 text-xl font-semibold text-gray-900">Send notification</h2>
                                    {notifyStatusLoading ? (
                                        <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                                            Checking push/SMS readiness…
                                        </div>
                                    ) : null}
                                    {(notifyNeedsPush && !customerHasPushToken) || (notifyNeedsSms && !customerHasSmsRecipient) ? (
                                        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                            {!customerHasPushToken && notifyNeedsPush
                                                ? `Push unavailable: no FCM token registered.${notifyStatus?.reason ? ` (${notifyStatus.reason})` : ''}`
                                                : null}
                                            {!customerHasPushToken && notifyNeedsPush && !customerHasSmsRecipient && notifyNeedsSms ? ' ' : null}
                                            {!customerHasSmsRecipient && notifyNeedsSms
                                                ? `SMS unavailable: no resolvable phone. DB row: ${JSON.stringify(notifyStatus?.debug?.phoneRow ?? 'N/A')}`
                                                : null}
                                        </div>
                                    ) : null}
                                    <AdminNotifyComposer
                                        value={notifyDraft}
                                        onChange={setNotifyDraft}
                                        disabled={notifySending || !canWriteCustomers}
                                        showRoute
                                        route={notifyRoute}
                                        onRouteChange={setNotifyRoute}
                                    />
                                    <div className="mt-4 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => void handleSendNotification()}
                                            disabled={
                                                notifySending
                                                || !canWriteCustomers
                                                || !notifyDraft.title.trim()
                                                || !notifyDraft.body.trim()
                                                || cannotDeliverSelectedChannel
                                            }
                                            className="inline-flex h-10 items-center rounded-md bg-accent-primary px-4 text-sm font-medium text-text-inverse transition-all duration-150 hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {notifySending ? 'Sending…' : 'Send notification'}
                                        </button>
                                        {notifyMessage ? (
                                            <p className="text-sm text-gray-600">{notifyMessage}</p>
                                        ) : null}
                                    </div>
                                </section>
                            ) : null}
                        </div>
                    ) : null}
                </main>
            </div>

            {confirmConvert ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => !actionBusy && setConfirmConvert(false)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Convert to provider</h3>
                        {(stats?.jobRequestCount ?? 0) > 0 ? (
                            <p className="mb-6 text-sm text-gray-600">
                                {displayName} has{' '}
                                <span className="font-semibold text-gray-900">{stats?.jobRequestCount}</span> job
                                request{(stats?.jobRequestCount ?? 0) === 1 ? '' : 's'}. Delete{' '}
                                {(stats?.jobRequestCount ?? 0) === 1 ? 'it' : 'them'} before converting. The customer
                                row will then be removed from the customer list.
                            </p>
                        ) : (
                            <p className="mb-6 text-sm text-gray-600">
                                Create a provider account for {displayName}. The customer row will be removed from the customer list.
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmConvert(false)}
                                disabled={actionBusy}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConvert()}
                                disabled={actionBusy}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {(stats?.jobRequestCount ?? 0) > 0
                                    ? 'Delete job requests & convert'
                                    : 'Convert'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {editingJobRequest ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => !actionBusy && setEditingJobRequest(null)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-4 text-lg font-bold text-gray-900">Edit job request</h3>
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Title
                                <input
                                    value={editJobForm.title}
                                    onChange={(event) => setEditJobForm((prev) => ({ ...prev, title: event.target.value }))}
                                    className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                                />
                            </label>
                            <label className="block text-sm font-medium text-gray-700">
                                Description
                                <textarea
                                    value={editJobForm.description}
                                    onChange={(event) => setEditJobForm((prev) => ({ ...prev, description: event.target.value }))}
                                    rows={4}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                />
                            </label>
                            <label className="block text-sm font-medium text-gray-700">
                                Price
                                <input
                                    value={editJobForm.price}
                                    onChange={(event) => setEditJobForm((prev) => ({ ...prev, price: event.target.value }))}
                                    className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                                />
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => setEditingJobRequest(null)}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void saveJobRequestEdit()}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {deletingJobRequest ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => !actionBusy && setDeletingJobRequest(null)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Delete job request</h3>
                        <p className="mb-6 text-sm text-gray-600">
                            Permanently delete “{deletingJobRequest.title || 'Untitled'}”? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => setDeletingJobRequest(null)}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void confirmDeleteJobRequest()}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {confirmDelete ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => !actionBusy && setConfirmDelete(false)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Delete customer</h3>
                        <p className="mb-6 text-sm text-gray-600">
                            Permanently remove {displayName}. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                disabled={actionBusy}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDelete()}
                                disabled={actionBusy}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                                {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {convertedProviderId ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => setConvertedProviderId(null)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Provider created</h3>
                        <p className="mb-6 text-sm text-gray-600">The provider account is ready.</p>
                        <div className="flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setConvertedProviderId(null)}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                                Close
                            </button>
                            <Link
                                href={`/admin/providers/${convertedProviderId}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                                View provider
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            ) : null}
        </AuthGuard>
    );
}
