'use client';

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
    CheckCircle2,
    ExternalLink,
    History,
    Loader2,
    Plus,
    RefreshCw,
    X,
} from 'lucide-react';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { AdminStatusBadge } from '@/components/admin/data-table';
import {
    getBookingJobStatusTone,
    getBookingPaymentStatusTone,
} from '@/lib/admin-status-badge';
import {
    formatBookingAmount,
    formatBookingShortId,
} from '@/lib/booking-display';
import {
    formatBookingJobStatusLabel,
    formatBookingPaymentStatusLabel,
} from '@/lib/booking-status';
import type {
    ServiceHistoryRepeatCustomer,
    ServiceHistoryStats,
} from '@/lib/provider-service-history';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDisplayPhone } from '@/lib/phone-display';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers, type Customer } from '@/features/customer/customerSlice';
import { fetchProviderServices } from '@/features/provider/providerSlice';
import { cn } from '@/lib/utils';

interface ProviderBookingRow {
    id: string;
    serviceName: string;
    status: string;
    paymentStatus: string;
    paymentCompleted: boolean;
    amount: string;
    createdAt: string;
    bookingDate: string;
    customerId: string;
    customerName: string;
    hiredBefore: boolean;
    priorCompletedCount: number;
    isPastHire?: boolean;
    note?: string;
}

interface RepeatCustomerRow extends ServiceHistoryRepeatCustomer {
    customerName: string;
}

interface ProviderServiceHistoryProps {
    providerId: string;
}

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayInputValue(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function customerDisplayName(customer: Customer): string {
    const first = (customer.first_name ?? '').trim();
    const last = (customer.last_name ?? '').trim();
    return [first, last].filter(Boolean).join(' ').trim() || customer.email?.trim() || 'Customer';
}

function customerPhone(customer: Customer): string {
    return formatDisplayPhone(customer.phoneNumber ?? customer.mobile_number ?? customer.phone ?? '');
}

export function ProviderServiceHistory({ providerId }: ProviderServiceHistoryProps) {
    const dispatch = useAppDispatch();
    const { canWriteBookings } = useAdminPermissions();
    const formId = useId();
    const { customers, loading: customersLoading } = useAppSelector((state) => state.customer);
    const { services, servicesLoading } = useAppSelector((state) => state.provider);

    const [items, setItems] = useState<ProviderBookingRow[]>([]);
    const [stats, setStats] = useState<ServiceHistoryStats | null>(null);
    const [repeatCustomers, setRepeatCustomers] = useState<RepeatCustomerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [composerOpen, setComposerOpen] = useState(false);
    const [customerId, setCustomerId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [bookingDate, setBookingDate] = useState(todayInputValue);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/providers/${providerId}/bookings`);
            const payload = (await response.json()) as {
                data?: ProviderBookingRow[];
                stats?: ServiceHistoryStats;
                repeatCustomers?: RepeatCustomerRow[];
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load service history');
            }
            setItems(payload.data ?? []);
            setStats(payload.stats ?? null);
            setRepeatCustomers(payload.repeatCustomers ?? []);
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load service history');
            setItems([]);
            setStats(null);
            setRepeatCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        if (!composerOpen) return;
        void dispatch(fetchAllCustomers());
        void dispatch(fetchProviderServices({ providerId, includeArchived: false }));
    }, [composerOpen, dispatch, providerId]);

    const customerOptions = useMemo<SearchSelectOption[]>(() => {
        return customers
            .filter((customer): customer is Customer & { id: string } => Boolean(customer.id) && !customer.archived_at)
            .map((customer) => {
                const name = customerDisplayName(customer);
                const phone = customerPhone(customer);
                return {
                    value: customer.id,
                    label: name,
                    description: [phone, customer.email].filter(Boolean).join(' · ') || undefined,
                    searchText: [name, phone, customer.email, customer.id].filter(Boolean).join(' '),
                };
            });
    }, [customers]);

    const servicePriceById = useMemo(() => {
        const priceMap: Record<string, string> = {};
        for (const service of services) {
            if (service.provider_id && service.provider_id !== providerId) continue;
            const price = Number(service.price ?? 0);
            if (Number.isFinite(price) && price > 0) priceMap[service.id] = String(price);
        }
        return priceMap;
    }, [services, providerId]);

    const serviceOptions = useMemo<SearchSelectOption[]>(() => {
        return services
            .filter((service) => {
                if (!service.id) return false;
                if (service.provider_id && service.provider_id !== providerId) return false;
                if (service.isArchived === true) return false;
                if (service.status === false) return false;
                return true;
            })
            .map((service) => {
                const label = (service.serviceName ?? service.name ?? 'Service').trim() || 'Service';
                const price = Number(service.price ?? 0);
                const priceLabel = Number.isFinite(price) && price > 0
                    ? `ETB ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                    : '';
                return {
                    value: service.id,
                    label,
                    description: priceLabel || undefined,
                    searchText: `${label} ${priceLabel} ${service.id}`,
                };
            });
    }, [services, providerId]);

    const optionsLoading = customersLoading || servicesLoading;

    useEffect(() => {
        if (!serviceId) return;
        if (amount.trim()) return;
        const catalog = servicePriceById[serviceId];
        if (catalog) setAmount(catalog);
    }, [serviceId, servicePriceById, amount]);

    const selectedCustomer = useMemo(
        () => customerOptions.find((option) => option.value === customerId),
        [customerOptions, customerId]
    );
    const selectedService = useMemo(
        () => serviceOptions.find((option) => option.value === serviceId),
        [serviceOptions, serviceId]
    );

    const canSubmit =
        canWriteBookings
        && Boolean(customerId)
        && Boolean(serviceId)
        && Boolean(bookingDate)
        && !submitting;

    function resetComposer() {
        setCustomerId('');
        setServiceId('');
        setBookingDate(todayInputValue());
        setAmount('');
        setNote('');
        setFormError(null);
    }

    function openComposer() {
        setSuccessMessage(null);
        setFormError(null);
        setComposerOpen(true);
    }

    function closeComposer() {
        setComposerOpen(false);
        resetComposer();
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setFormError(null);
        setSuccessMessage(null);
        try {
            const response = await fetch(`/api/admin/providers/${providerId}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customerId,
                    service_id: serviceId,
                    bookingDate,
                    amount: amount.trim() || undefined,
                    note: note.trim() || undefined,
                }),
            });
            const payload = (await response.json()) as { error?: string; data?: { id: string } };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to log past hire');
            }

            const who = selectedCustomer?.label || 'Customer';
            const what = selectedService?.label || 'service';
            setSuccessMessage(`Logged past hire · ${who} · ${what}`);
            closeComposer();
            await loadHistory();
        } catch (submitError: unknown) {
            setFormError(submitError instanceof Error ? submitError.message : 'Failed to log past hire');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-gray-900">
                        Service history
                    </h2>
                    <p className="mt-1 max-w-prose text-pretty text-sm text-gray-600">
                        Completed jobs, repeat customers, and past hires logged for this provider.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        href="/admin/bookings"
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-gray-50"
                    >
                        All bookings
                        <ExternalLink className="h-4 w-4" />
                    </Link>
                    {canWriteBookings ? (
                        <Button
                            type="button"
                            onClick={() => (composerOpen ? closeComposer() : openComposer())}
                            className="h-9 gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                            aria-expanded={composerOpen}
                            aria-controls={`${formId}-composer`}
                        >
                            {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {composerOpen ? 'Close' : 'Add past hire'}
                        </Button>
                    ) : null}
                </div>
            </div>

            {successMessage ? (
                <div
                    role="status"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                        <p className="font-medium">{successMessage}</p>
                        <p className="mt-0.5 text-emerald-800/80">History and hired-before stats updated.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccessMessage(null)}
                        className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : null}

            <div
                id={`${formId}-composer`}
                className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                    composerOpen ? 'mb-5 grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="overflow-hidden">
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm sm:p-5"
                    >
                        <div className="mb-4 flex flex-wrap items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                                <History className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base font-semibold text-gray-900">Log a past hire</h3>
                                <p className="mt-0.5 max-w-prose text-sm text-gray-600">
                                    Records completed work that happened outside a live booking. No wallet credit, SMS, or push notifications.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                                <SearchSelect
                                    id={`${formId}-customer`}
                                    label="Customer"
                                    value={customerId}
                                    onChange={setCustomerId}
                                    options={customerOptions}
                                    placeholder="Search customer"
                                    searchPlaceholder="Name, phone, or email…"
                                    emptyMessage="No customers found"
                                    loading={optionsLoading}
                                    loadingMessage="Loading customers…"
                                />
                            </div>
                            <div className="sm:col-span-1">
                                <SearchSelect
                                    id={`${formId}-service`}
                                    label="Service"
                                    value={serviceId}
                                    onChange={(value) => {
                                        setServiceId(value);
                                        const catalog = servicePriceById[value];
                                        if (catalog) setAmount(catalog);
                                    }}
                                    options={serviceOptions}
                                    placeholder="Select provider service"
                                    searchPlaceholder="Search services…"
                                    emptyMessage="No active services for this provider"
                                    loading={optionsLoading}
                                    loadingMessage="Loading services…"
                                />
                            </div>
                            <div>
                                <Label htmlFor={`${formId}-date`}>Work date</Label>
                                <Input
                                    id={`${formId}-date`}
                                    type="date"
                                    value={bookingDate}
                                    max={todayInputValue()}
                                    onChange={(event) => setBookingDate(event.target.value)}
                                    required
                                    className="mt-1.5 bg-white"
                                />
                            </div>
                            <div>
                                <Label htmlFor={`${formId}-amount`}>Amount (ETB)</Label>
                                <Input
                                    id={`${formId}-amount`}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    placeholder="Uses service price if empty"
                                    className="mt-1.5 bg-white"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Label htmlFor={`${formId}-note`}>Note (optional)</Label>
                                <textarea
                                    id={`${formId}-note`}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    rows={2}
                                    maxLength={500}
                                    placeholder="e.g. Hired offline before app signup"
                                    className="mt-1.5 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-4">
                            <p className="text-xs text-gray-600">
                                Saves as <span className="font-semibold text-gray-800">completed</span>
                                {' · '}
                                counts toward <span className="font-semibold text-amber-800">hired before</span>
                                {selectedCustomer && selectedService
                                    ? ` · ${selectedCustomer.label} → ${selectedService.label}`
                                    : null}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeComposer}
                                    disabled={submitting}
                                    className="h-9 bg-white"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="h-9 gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    {submitting ? 'Saving…' : 'Save past hire'}
                                </Button>
                            </div>
                        </div>

                        {formError ? (
                            <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
                                {formError}
                            </p>
                        ) : null}
                    </form>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                    { label: 'Bookings', value: stats?.bookingCount },
                    { label: 'Completed', value: stats?.completedCount },
                    { label: 'Active', value: stats?.activeCount },
                    { label: 'Customers', value: stats?.uniqueCustomers },
                ].map((card) => (
                    <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
                            {card.value ?? (loading ? '…' : 0)}
                        </p>
                    </div>
                ))}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Hired before</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-amber-950">
                        {stats?.hiredBeforeCustomers ?? (loading ? '…' : 0)}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                        {stats?.hiredBeforeBookings ?? 0} repeat bookings
                    </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed revenue</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
                        {stats ? formatCurrency(stats.completedRevenue) : loading ? '…' : formatCurrency(0)}
                    </p>
                </div>
            </div>

            {stats?.firstBookingAt || stats?.lastBookingAt ? (
                <p className="mb-4 text-sm text-gray-600">
                    First booking {stats.firstBookingAt ? formatAdminDateTimeUtc(stats.firstBookingAt) : '—'}
                    {' · '}
                    Last booking {stats.lastBookingAt ? formatAdminDateTimeUtc(stats.lastBookingAt) : '—'}
                    {stats.rejectedCount > 0 ? ` · ${stats.rejectedCount} rejected` : null}
                </p>
            ) : null}

            {repeatCustomers.length > 0 ? (
                <div className="mb-4 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
                    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
                        <h3 className="text-sm font-semibold text-amber-950">Repeat customers (hired before)</h3>
                        <p className="mt-0.5 text-xs text-amber-800">
                            Customers with 2+ completed jobs with this provider.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Customer</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Completed</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Bookings</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">Spent</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">First → last</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {repeatCustomers.map((customer) => (
                                    <tr key={customer.customerId} className="hover:bg-gray-50/80">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            <Link
                                                href={`/admin/customers/${customer.customerId}`}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                {customer.customerName || 'Customer'}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm tabular-nums text-gray-700">{customer.completedCount}</td>
                                        <td className="px-4 py-3 text-sm tabular-nums text-gray-700">{customer.bookingCount}</td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                                            {formatCurrency(customer.totalSpent)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                                            {formatAdminDateTimeUtc(customer.firstBookingAt)}
                                            {' → '}
                                            {formatAdminDateTimeUtc(customer.lastBookingAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-8 text-gray-600 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading service history…
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <History className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">No service history yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
                        When this provider completes bookings—or you log offline past hires—they’ll show up here.
                    </p>
                    {canWriteBookings ? (
                        <Button
                            type="button"
                            onClick={openComposer}
                            className="mt-5 h-9 gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                        >
                            <Plus className="h-4 w-4" />
                            Add past hire
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {!loading && !error && items.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="w-full border-collapse text-left">
                        <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Customer</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Service</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">Amount</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Booking</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">History</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item) => (
                                <tr key={item.id} className="align-top hover:bg-gray-50/80">
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                                        {formatAdminDateTimeUtc(item.createdAt)}
                                        <p className="mt-1 font-mono text-[11px] text-gray-400">
                                            #{formatBookingShortId(item.id)}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        {item.customerId ? (
                                            <Link
                                                href={`/admin/customers/${item.customerId}`}
                                                className="font-medium text-indigo-600 hover:text-indigo-800"
                                            >
                                                {item.customerName || 'Customer'}
                                            </Link>
                                        ) : (
                                            item.customerName || '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {item.serviceName || '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                                        {formatBookingAmount(item.amount)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <AdminStatusBadge tone={getBookingJobStatusTone(item.status)}>
                                            {formatBookingJobStatusLabel(item.status)}
                                        </AdminStatusBadge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <AdminStatusBadge
                                            tone={getBookingPaymentStatusTone(
                                                item.paymentStatus,
                                                item.paymentCompleted
                                            )}
                                        >
                                            {formatBookingPaymentStatusLabel(
                                                item.paymentStatus,
                                                item.paymentCompleted
                                            )}
                                        </AdminStatusBadge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col items-start gap-1.5">
                                            {item.isPastHire ? (
                                                <AdminStatusBadge tone="info">Past hire</AdminStatusBadge>
                                            ) : null}
                                            {item.hiredBefore ? (
                                                <AdminStatusBadge tone="warning">
                                                    Hired before
                                                    {item.priorCompletedCount > 0
                                                        ? ` · ${item.priorCompletedCount} prior`
                                                        : ''}
                                                </AdminStatusBadge>
                                            ) : (
                                                <span className="text-xs text-gray-400">First hire</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
