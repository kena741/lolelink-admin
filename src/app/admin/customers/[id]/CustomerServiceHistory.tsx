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
import { formatBookingAmount, formatBookingShortId } from '@/lib/booking-display';
import {
    formatBookingJobStatusLabel,
    formatBookingPaymentStatusLabel,
} from '@/lib/booking-status';
import type { ServiceHistoryStats } from '@/lib/provider-service-history';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';
import { AdminNoteField } from '@/components/AdminNoteField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProviders, fetchProviderServices } from '@/features/provider/providerSlice';
import {
    createHandyman,
    fetchHandymen,
    type Handyman,
} from '@/features/handyman/handymanSlice';
import { cn } from '@/lib/utils';

interface CustomerBookingRow {
    id: string;
    serviceName: string;
    status: string;
    paymentStatus: string;
    paymentCompleted: boolean;
    totalAmount?: string | number | null;
    subTotal?: string | number | null;
    price?: string | number | null;
    amount: string;
    createdAt: string;
    bookingDate: string;
    providerId: string;
    providerName: string;
    handymanId?: string | null;
    handymanName?: string | null;
    providerMySelf?: boolean;
    hiredBefore: boolean;
    priorCompletedCount: number;
    isPastHire?: boolean;
    note?: string;
    followUp?: string;
}

function handymanLabel(handyman: Handyman): string {
    return (
        [handyman.firstName, handyman.lastName].filter(Boolean).join(' ').trim() ||
        handyman.phoneNumber?.trim() ||
        'Handyman'
    );
}

function handymanOptions(
    handymen: Handyman[],
    forProviderId?: string,
    providerNameById: Record<string, string> = {}
): SearchSelectOption[] {
    const self: SearchSelectOption = {
        value: '',
        label: 'Myself',
        description: 'Provider does the job',
        searchText: 'myself provider self none',
    };
    const workers = handymen
        .filter((h): h is Handyman & { id: string } => Boolean(h.id))
        .slice()
        .sort((a, b) => {
            const aOn = forProviderId && a.providerId === forProviderId ? 1 : 0;
            const bOn = forProviderId && b.providerId === forProviderId ? 1 : 0;
            if (bOn !== aOn) return bOn - aOn;
            return handymanLabel(a).localeCompare(handymanLabel(b));
        })
        .map((h) => {
            const label = handymanLabel(h);
            const onTeam = Boolean(forProviderId && h.providerId === forProviderId);
            const providerName = h.providerId
                ? providerNameById[h.providerId] || 'Unknown provider'
                : 'Unassigned';
            const teamNote = onTeam ? `${providerName} · this job` : providerName;
            return {
                value: h.id,
                label,
                description: [h.phoneNumber, teamNote].filter(Boolean).join(' · ') || undefined,
                searchText: [label, h.phoneNumber, h.id, providerName, teamNote]
                    .filter(Boolean)
                    .join(' '),
                // ponytail: empty list = this provider's team; type to reach other providers
                showWhenEmpty: !forProviderId || onTeam,
            };
        });
    return [self, ...workers];
}

interface RepeatProviderRow {
    providerId: string;
    providerName: string;
    completedCount: number;
    bookingCount: number;
    totalSpent: number;
    firstBookingAt: string;
    lastBookingAt: string;
}

interface CustomerServiceHistoryProps {
    customerId: string;
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

export function CustomerServiceHistory({ customerId }: CustomerServiceHistoryProps) {
    const dispatch = useAppDispatch();
    const { canWriteBookings } = useAdminPermissions();
    const formId = useId();
    const { providers, services, servicesLoading, loading: providersLoading } = useAppSelector(
        (state) => state.provider
    );
    const { handymen, loading: handymenLoading } = useAppSelector((state) => state.handyman);

    const [items, setItems] = useState<CustomerBookingRow[]>([]);
    const [stats, setStats] = useState<ServiceHistoryStats | null>(null);
    const [repeatProviders, setRepeatProviders] = useState<RepeatProviderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [composerOpen, setComposerOpen] = useState(false);
    const [providerId, setProviderId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [handymanId, setHandymanId] = useState('');
    const [newWorkerName, setNewWorkerName] = useState('');
    const [newWorkerPhone, setNewWorkerPhone] = useState('');
    const [bookingDate, setBookingDate] = useState(todayInputValue);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/bookings`);
            const payload = (await response.json()) as {
                data?: CustomerBookingRow[];
                stats?: ServiceHistoryStats;
                repeatProviders?: RepeatProviderRow[];
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to load service history');
            setItems(payload.data ?? []);
            setStats(payload.stats ?? null);
            setRepeatProviders(payload.repeatProviders ?? []);
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load service history');
            setItems([]);
            setStats(null);
            setRepeatProviders([]);
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        void dispatch(fetchHandymen());
        void dispatch(fetchProviders());
    }, [dispatch]);

    useEffect(() => {
        if (!composerOpen || !providerId) return;
        void dispatch(fetchProviderServices({ providerId, includeArchived: false }));
        setServiceId('');
        setHandymanId('');
        setNewWorkerName('');
        setNewWorkerPhone('');
        setAmount('');
    }, [composerOpen, dispatch, providerId]);

    const providerOptions = useMemo<SearchSelectOption[]>(() => {
        return providers
            .filter((p) => Boolean(p.id) && !p.archived_at)
            .map((p) => {
                const name =
                    [p.firstName ?? p.first_name, p.lastName ?? p.last_name].filter(Boolean).join(' ').trim() ||
                    p.name ||
                    'Provider';
                return {
                    value: p.id,
                    label: name,
                    description: p.email || undefined,
                    searchText: [name, p.email, p.id].filter(Boolean).join(' '),
                };
            });
    }, [providers]);

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
                const priceLabel =
                    Number.isFinite(price) && price > 0
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

    const providerNameById = useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of providers) {
            if (!p.id) continue;
            map[p.id] =
                [p.firstName ?? p.first_name, p.lastName ?? p.last_name]
                    .filter(Boolean)
                    .join(' ')
                    .trim() ||
                p.name ||
                'Provider';
        }
        return map;
    }, [providers]);

    const composerHandymanOptions = useMemo(
        () => handymanOptions(handymen, providerId, providerNameById),
        [handymen, providerId, providerNameById]
    );

    const selectedProvider = providerOptions.find((o) => o.value === providerId);
    const selectedService = serviceOptions.find((o) => o.value === serviceId);
    const optionsLoading = providersLoading || servicesLoading || handymenLoading;
    const canSubmit =
        canWriteBookings &&
        !submitting &&
        Boolean(providerId) &&
        Boolean(serviceId) &&
        Boolean(bookingDate.trim());

    function openComposer() {
        setComposerOpen(true);
        setFormError(null);
        setSuccessMessage(null);
        setProviderId('');
        setServiceId('');
        setHandymanId('');
        setNewWorkerName('');
        setNewWorkerPhone('');
        setBookingDate(todayInputValue());
        setAmount('');
        setNote('');
    }

    function closeComposer() {
        if (submitting) return;
        setComposerOpen(false);
        setFormError(null);
    }

    async function resolveHandymanIdForSubmit(): Promise<string | null> {
        if (handymanId) return handymanId;
        const name = newWorkerName.trim();
        const phone = newWorkerPhone.trim();
        if (!name && !phone) return null;
        if (!name || !phone) {
            throw new Error('New worker needs both name and phone');
        }
        const created = await dispatch(
            createHandyman({
                firstName: name,
                phoneNumber: phone,
                providerId,
                active: true,
                isActive: true,
            })
        ).unwrap();
        await dispatch(fetchHandymen());
        return created.id;
    }

    async function assignHandyman(bookingId: string, nextHandymanId: string) {
        setAssigningBookingId(bookingId);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/bookings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: bookingId,
                    handyman_id: nextHandymanId || null,
                }),
            });
            const payload = (await response.json()) as {
                error?: string;
                data?: {
                    handymanId?: string | null;
                    handymanName?: string | null;
                    providerMySelf?: boolean;
                };
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to assign handyman');
            setItems((prev) =>
                prev.map((row) =>
                    row.id === bookingId
                        ? {
                              ...row,
                              handymanId: payload.data?.handymanId ?? null,
                              handymanName: payload.data?.handymanName ?? null,
                              providerMySelf: payload.data?.providerMySelf ?? !nextHandymanId,
                          }
                        : row
                )
            );
            if (nextHandymanId) void dispatch(fetchHandymen());
        } finally {
            setAssigningBookingId(null);
        }
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        setFormError(null);
        try {
            const resolvedHandymanId = await resolveHandymanIdForSubmit();
            const response = await fetch(`/api/admin/customers/${customerId}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider_id: providerId,
                    service_id: serviceId,
                    bookingDate,
                    amount: amount.trim() || undefined,
                    note: note.trim() || undefined,
                    handyman_id: resolvedHandymanId,
                }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to log past hire');

            setSuccessMessage(
                `Logged past hire · ${selectedProvider?.label || 'Provider'} · ${selectedService?.label || 'service'}`
            );
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
                        Same hire records and follow-ups as provider history — edits stay in sync.
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
                        <p className="mt-0.5 text-emerald-800/80">Also visible on the provider history tab.</p>
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
                                    Records completed work outside a live booking. Shows on this customer and the
                                    provider.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <SearchSelect
                                id={`${formId}-provider`}
                                label="Provider"
                                value={providerId}
                                onChange={setProviderId}
                                options={providerOptions}
                                placeholder="Search provider"
                                searchPlaceholder="Name or email…"
                                emptyMessage="No providers found"
                                loading={optionsLoading && !providerId}
                                loadingMessage="Loading providers…"
                            />
                            <div>
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
                                    placeholder={providerId ? 'Select provider service' : 'Pick a provider first'}
                                    searchPlaceholder="Search services…"
                                    emptyMessage="No active services for this provider"
                                    loading={Boolean(providerId) && servicesLoading}
                                    loadingMessage="Loading services…"
                                    disabled={!providerId}
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
                                <SearchSelect
                                    id={`${formId}-handyman`}
                                    label="Handyman (optional)"
                                    value={handymanId}
                                    onChange={(value) => {
                                        setHandymanId(value);
                                        if (value) {
                                            setNewWorkerName('');
                                            setNewWorkerPhone('');
                                        }
                                    }}
                                    options={composerHandymanOptions}
                                    placeholder={
                                        providerId ? 'Myself (default) or pick worker' : 'Pick a provider first'
                                    }
                                    searchPlaceholder="Search workers or providers…"
                                    emptyMessage="No workers found"
                                    loading={Boolean(providerId) && handymenLoading}
                                    loadingMessage="Loading workers…"
                                    disabled={!providerId}
                                />
                            </div>
                            {!handymanId && providerId ? (
                                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor={`${formId}-new-worker-name`}>
                                            Or add new worker name
                                        </Label>
                                        <Input
                                            id={`${formId}-new-worker-name`}
                                            value={newWorkerName}
                                            onChange={(event) => setNewWorkerName(event.target.value)}
                                            placeholder="First name"
                                            className="mt-1.5 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor={`${formId}-new-worker-phone`}>
                                            New worker phone
                                        </Label>
                                        <Input
                                            id={`${formId}-new-worker-phone`}
                                            value={newWorkerPhone}
                                            onChange={(event) => setNewWorkerPhone(event.target.value)}
                                            placeholder="09…"
                                            className="mt-1.5 bg-white"
                                        />
                                    </div>
                                </div>
                            ) : null}
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
                                {selectedProvider && selectedService
                                    ? ` · ${selectedProvider.label} → ${selectedService.label}`
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
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
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
                    { label: 'Providers', value: stats?.uniqueCustomers },
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed spend</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
                        {stats ? formatCurrency(stats.completedRevenue) : loading ? '…' : formatCurrency(0)}
                    </p>
                </div>
            </div>

            {repeatProviders.length > 0 ? (
                <div className="mb-4 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
                    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
                        <h3 className="text-sm font-semibold text-amber-950">Repeat providers</h3>
                        <p className="mt-0.5 text-xs text-amber-800">
                            Providers with 2+ completed jobs for this customer.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Provider
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Completed
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Bookings
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Spent
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {repeatProviders.map((provider) => (
                                    <tr key={provider.providerId} className="hover:bg-gray-50/80">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            <Link
                                                href={`/admin/providers/${provider.providerId}`}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                {provider.providerName || 'Provider'}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm tabular-nums text-gray-700">
                                            {provider.completedCount}
                                        </td>
                                        <td className="px-4 py-3 text-sm tabular-nums text-gray-700">
                                            {provider.bookingCount}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                                            {formatCurrency(provider.totalSpent)}
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
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                </div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <History className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">No service history yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
                        Bookings and past hires for this customer appear here and on the linked provider.
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
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Provider
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Handyman
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Service
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Amount
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Booking
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Payment
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        History
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                        Follow-up
                                    </th>
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
                                            {item.providerId ? (
                                                <Link
                                                    href={`/admin/providers/${item.providerId}`}
                                                    className="font-medium text-indigo-600 hover:text-indigo-800"
                                                >
                                                    {item.providerName || 'Provider'}
                                                </Link>
                                            ) : (
                                                item.providerName || '—'
                                            )}
                                        </td>
                                        <td className="min-w-[180px] px-4 py-3">
                                            {canWriteBookings && item.providerId ? (
                                                <SearchSelect
                                                    id={`${formId}-assign-${item.id}`}
                                                    label="Worker"
                                                    value={item.handymanId || ''}
                                                    onChange={(value) => {
                                                        void assignHandyman(item.id, value).catch(
                                                            (assignError: unknown) => {
                                                                setError(
                                                                    assignError instanceof Error
                                                                        ? assignError.message
                                                                        : 'Failed to assign handyman'
                                                                );
                                                            }
                                                        );
                                                    }}
                                                    options={handymanOptions(
                                                        handymen,
                                                        item.providerId,
                                                        providerNameById
                                                    )}
                                                    placeholder="Myself"
                                                    searchPlaceholder="Search workers or providers…"
                                                    emptyMessage="No workers"
                                                    loading={
                                                        handymenLoading ||
                                                        assigningBookingId === item.id
                                                    }
                                                    disabled={assigningBookingId === item.id}
                                                />
                                            ) : item.handymanId ? (
                                                <Link
                                                    href="/admin/handyman"
                                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                                >
                                                    {item.handymanName || 'Handyman'}
                                                </Link>
                                            ) : (
                                                <span className="text-sm text-gray-500">Myself</span>
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
                                                    item.paymentCompleted,
                                                    {
                                                        paymentCompleted: item.paymentCompleted,
                                                        payment_status: item.paymentStatus,
                                                        totalAmount: item.totalAmount ?? item.amount,
                                                        subTotal: item.subTotal,
                                                        price: item.price,
                                                        status: item.status,
                                                    }
                                                )}
                                            >
                                                {formatBookingPaymentStatusLabel(
                                                    item.paymentStatus,
                                                    item.paymentCompleted,
                                                    {
                                                        paymentCompleted: item.paymentCompleted,
                                                        payment_status: item.paymentStatus,
                                                        totalAmount: item.totalAmount ?? item.amount,
                                                        subTotal: item.subTotal,
                                                        price: item.price,
                                                        status: item.status,
                                                    }
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
                                        <td className="px-4 py-3">
                                            <AdminNoteField
                                                display="text"
                                                value={item.followUp || ''}
                                                disabled={!canWriteBookings}
                                                onSave={async (followUp) => {
                                                    const response = await fetch(
                                                        `/api/admin/customers/${customerId}/bookings`,
                                                        {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                booking_id: item.id,
                                                                admin_note: followUp || null,
                                                            }),
                                                        }
                                                    );
                                                    const payload = (await response.json()) as {
                                                        error?: string;
                                                        data?: { followUp?: string };
                                                    };
                                                    if (!response.ok) {
                                                        throw new Error(
                                                            payload.error || 'Failed to save follow-up'
                                                        );
                                                    }
                                                    setItems((prev) =>
                                                        prev.map((row) =>
                                                            row.id === item.id
                                                                ? {
                                                                      ...row,
                                                                      followUp:
                                                                          payload.data?.followUp ?? followUp,
                                                                  }
                                                                : row
                                                        )
                                                    );
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
