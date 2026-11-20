'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers, convertToProvider, resetConvertState, archiveCustomer, restoreCustomer, deleteCustomer, setCustomerAdminNote } from '@/features/customer/customerSlice';
import { ChevronLeft, ChevronRight, ChevronDown, Download, Users, ArrowRightLeft, CheckCircle2, Loader2, Archive, ArchiveRestore, Trash2, MoreVertical, ExternalLink, Plus, KeyRound, Filter, RotateCcw, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { CreateAppUserModal } from '@/components/CreateAppUserModal';
import { BulkLeadCustomersModal } from '@/components/BulkLeadCustomersModal';
import { RegisterCustomerAuthModal } from '@/components/RegisterCustomerAuthModal';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
} from '@/components/admin/admin-layout';
import { AdminTableShell } from '@/components/admin/data-table';
import { AdminNoteField } from '@/components/AdminNoteField';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';
import { cn } from '@/lib/utils';

import {
    customerIsArchived,
    customerIsRegistered,
    getCustomerDisplayName,
} from '@/lib/customer-display';
import { formatDisplayPhone } from '@/lib/phone-display';

const PAGE_SIZE = 20;

type ArchiveVisibility = 'active_only' | 'all' | 'archived_only';
type AccountFilter = 'all' | 'registered' | 'lead';
type SourceFilter = 'all' | 'qr' | 'admin' | 'none';

interface SegmentOption<V extends string> {
    value: V;
    label: string;
}

interface SegmentGroupProps<V extends string> {
    label: string;
    value: V;
    options: SegmentOption<V>[];
    onChange: (next: V) => void;
}

function SegmentGroup<V extends string>({ label, value, options, onChange }: SegmentGroupProps<V>) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <div
                className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-lg border border-border bg-muted/50 p-0.5"
                role="radiogroup"
                aria-label={label}
            >
                {options.map((opt) => {
                    const selected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(opt.value)}
                            className={cn(
                                'inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors duration-150',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                selected
                                    ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function CustomersPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { canWriteCustomers } = useAdminPermissions();
    const { customers, loading, error, convertingId, convertError } = useAppSelector((s) => s.customer);
    const [query, setQuery] = useState('');
    const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>('active_only');
    const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [confirmCustomerId, setConfirmCustomerId] = useState<string | null>(null);
    const [confirmJobRequestCount, setConfirmJobRequestCount] = useState(0);
    const [confirmJobRequestLoading, setConfirmJobRequestLoading] = useState(false);
    const [convertedProviderId, setConvertedProviderId] = useState<string | null>(null);
    const [actionBusyId, setActionBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [pendingDeleteCustomerId, setPendingDeleteCustomerId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [leadsOpen, setLeadsOpen] = useState(false);
    const [registerCustomerId, setRegisterCustomerId] = useState<string | null>(null);

    useEffect(() => {
        if (!shouldRefetchAdminList('customers', { hasRows: customers.length > 0 })) return;
        void dispatch(fetchAllCustomers()).then((action) => {
            if (fetchAllCustomers.fulfilled.match(action)) markAdminListFetched('customers');
        });
    }, [dispatch, customers.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, archiveVisibility, accountFilter, sourceFilter]);

    const nonDefaultFilterCount = useMemo(() => {
        let n = 0;
        if (archiveVisibility !== 'active_only') n += 1;
        if (accountFilter !== 'all') n += 1;
        if (sourceFilter !== 'all') n += 1;
        return n;
    }, [archiveVisibility, accountFilter, sourceFilter]);

    function resetFilters() {
        setArchiveVisibility('active_only');
        setAccountFilter('all');
        setSourceFilter('all');
    }

    const openConvertConfirm = useCallback(async (customerId: string) => {
        setConfirmCustomerId(customerId);
        setConfirmJobRequestCount(0);
        setConfirmJobRequestLoading(true);
        setActionError(null);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/job-requests`);
            const payload = (await response.json()) as { data?: unknown[]; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to load job requests');
            setConfirmJobRequestCount(Array.isArray(payload.data) ? payload.data.length : 0);
        } catch (error: unknown) {
            setActionError(error instanceof Error ? error.message : 'Failed to load job requests');
            setConfirmCustomerId(null);
        } finally {
            setConfirmJobRequestLoading(false);
        }
    }, []);

    const handleConvert = useCallback(async (customerId: string) => {
        const jobRequestCount = confirmJobRequestCount;
        setConfirmCustomerId(null);
        setActionError(null);
        setActionBusyId(customerId);

        if (jobRequestCount > 0) {
            const deleteResponse = await fetch('/api/job-requests', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });
            const deletePayload = (await deleteResponse.json()) as { error?: string };
            if (!deleteResponse.ok) {
                setActionBusyId(null);
                setActionError(deletePayload.error || 'Failed to delete job requests');
                return;
            }
        }

        const result = await dispatch(convertToProvider(customerId));
        setActionBusyId(null);
        if (convertToProvider.fulfilled.match(result)) {
            setConvertedProviderId(result.payload.providerId);
            return;
        }
        setActionError((result.payload as string) || 'Conversion failed');
    }, [confirmJobRequestCount, dispatch]);

    const dismissConvertResult = useCallback(() => {
        setConvertedProviderId(null);
        dispatch(resetConvertState());
    }, [dispatch]);

    const handleArchiveCustomer = useCallback(
        async (customerId: string) => {
            setActionError(null);
            setActionBusyId(customerId);
            const result = await dispatch(archiveCustomer(customerId));
            setActionBusyId(null);
            if (archiveCustomer.rejected.match(result)) {
                setActionError(result.payload || 'Archive failed');
            }
        },
        [dispatch]
    );

    const handleRestoreCustomer = useCallback(
        async (customerId: string) => {
            setActionError(null);
            setActionBusyId(customerId);
            const result = await dispatch(restoreCustomer(customerId));
            setActionBusyId(null);
            if (restoreCustomer.rejected.match(result)) {
                setActionError(result.payload || 'Restore failed');
            }
        },
        [dispatch]
    );

    const handleDeleteCustomer = useCallback(async () => {
        if (!pendingDeleteCustomerId) return;
        setActionError(null);
        setActionBusyId(pendingDeleteCustomerId);
        const result = await dispatch(deleteCustomer(pendingDeleteCustomerId));
        setActionBusyId(null);
        setPendingDeleteCustomerId(null);
        if (deleteCustomer.rejected.match(result)) {
            setActionError(result.payload || 'Delete failed');
        }
    }, [dispatch, pendingDeleteCustomerId]);

    const attributeFiltered = useMemo(() => {
        return customers.filter((c) => {
            const archived = customerIsArchived(c);
            if (archiveVisibility === 'active_only' && archived) return false;
            if (archiveVisibility === 'archived_only' && !archived) return false;

            const registered = customerIsRegistered(c);
            if (accountFilter === 'registered' && !registered) return false;
            if (accountFilter === 'lead' && registered) return false;

            const source = (c.signup_source ?? '').trim().toLowerCase();
            if (sourceFilter === 'qr' && source !== 'qr') return false;
            if (sourceFilter === 'admin' && source !== 'admin') return false;
            if (sourceFilter === 'none' && source) return false;

            return true;
        });
    }, [customers, archiveVisibility, accountFilter, sourceFilter]);

    const filtered = useMemo(() => {
        const sorted = [...attributeFiltered].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        });

        if (!query.trim()) return sorted;
        const q = query.toLowerCase();
        return sorted.filter((c) => {
            const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
            const userId = (c.id ?? '').toLowerCase();
            const email = (c.email ?? '').toLowerCase();
            const phone = ((c.phoneNumber ?? c.mobile_number ?? c.phone) ?? '').toLowerCase();
            const source = (c.signup_source ?? '').toLowerCase();
            const note = (c.admin_note ?? '').toLowerCase();
            const address = (() => {
                const defaultAddress = c.default_address;
                if (typeof defaultAddress === 'string') {
                    try {
                        const parsed = JSON.parse(defaultAddress);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            const parts = [parsed.city, parsed.state, parsed.country, parsed.postal_code].filter(Boolean);
                            return parts.join(' ').toLowerCase();
                        }
                        return (defaultAddress || c.address || '').toString().toLowerCase();
                    } catch {
                        return (defaultAddress || c.address || '').toString().toLowerCase();
                    }
                }
                if (defaultAddress && typeof defaultAddress === 'object') {
                    const parts = [defaultAddress.city, defaultAddress.state, defaultAddress.country, defaultAddress.postal_code].filter(Boolean);
                    return parts.join(' ').toLowerCase();
                }
                return (c.address || '').toString().toLowerCase();
            })();
            return (
                name.includes(q) ||
                userId.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                address.includes(q) ||
                source.includes(q) ||
                note.includes(q)
            );
        });
    }, [attributeFiltered, query]);

    function exportToXlsx() {
        const rows = filtered.map((c) => ({
            'Full Name': [c.first_name, c.last_name].filter(Boolean).join(' '),
            'Phone': c.phoneNumber ?? c.mobile_number ?? c.phone ?? '',
            Account: customerIsRegistered(c) ? 'Registered' : 'Lead',
            'Signup source': c.signup_source ?? '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / PAGE_SIZE) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    return (
        <>
            <AdminShell>
                        <AdminPageHeader
                            title="Customers"
                            description="Directory of customers and their recent activity"
                            actions={
                                canWriteCustomers ? (
                                    <button
                                        type="button"
                                        onClick={() => setCreateOpen(true)}
                                        className={adminHeaderButtonClassName()}
                                        aria-label="Add customer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add customer
                                    </button>
                                ) : null
                            }
                        />
                        <div className="mb-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <AdminSearchInput
                                    className="w-full max-w-md flex-1"
                                    value={query}
                                    onChange={setQuery}
                                    placeholder="Search name, email, phone, note, address…"
                                />
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    {canWriteCustomers ? (
                                        <button
                                            type="button"
                                            onClick={() => setLeadsOpen(true)}
                                            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <Plus className="h-4 w-4 shrink-0" />
                                            Add leads
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setFiltersPanelOpen((open) => !open)}
                                        aria-expanded={filtersPanelOpen}
                                        aria-controls="customers-filters-panel"
                                        id="customers-filters-trigger"
                                        className={cn(
                                            'inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors duration-150',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                            filtersPanelOpen
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border bg-card text-foreground hover:bg-muted'
                                        )}
                                    >
                                        <Filter className="h-4 w-4 shrink-0" />
                                        <span>Filters</span>
                                        {nonDefaultFilterCount > 0 ? (
                                            <span
                                                className={cn(
                                                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                                                    filtersPanelOpen
                                                        ? 'bg-primary-foreground/20'
                                                        : 'bg-primary/10 text-primary'
                                                )}
                                            >
                                                {nonDefaultFilterCount}
                                            </span>
                                        ) : null}
                                        <ChevronDown
                                            className={cn(
                                                'h-4 w-4 shrink-0 transition-transform duration-200',
                                                filtersPanelOpen && 'rotate-180'
                                            )}
                                            aria-hidden
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exportToXlsx}
                                        disabled={filtered.length === 0}
                                        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Download className="h-4 w-4 shrink-0" />
                                        Export
                                    </button>
                                </div>
                            </div>

                            {filtersPanelOpen ? (
                                <div
                                    id="customers-filters-panel"
                                    role="region"
                                    aria-labelledby="customers-filters-trigger"
                                    className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:px-5"
                                >
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                                            {nonDefaultFilterCount > 0 ? (
                                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                                                    {nonDefaultFilterCount} active
                                                </span>
                                            ) : null}
                                            <span className="text-xs text-muted-foreground">
                                                {filtered.length}
                                                {query.trim()
                                                    ? ` match · ${attributeFiltered.length} before search`
                                                    : ' customers'}
                                            </span>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={resetFilters}
                                                disabled={nonDefaultFilterCount === 0}
                                                className={cn(
                                                    'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150',
                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                    nonDefaultFilterCount > 0
                                                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        : 'cursor-not-allowed text-muted-foreground/50'
                                                )}
                                            >
                                                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFiltersPanelOpen(false)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                aria-label="Close filters"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <SegmentGroup
                                            label="Archive"
                                            value={archiveVisibility}
                                            onChange={setArchiveVisibility}
                                            options={[
                                                { value: 'active_only', label: 'Active' },
                                                { value: 'all', label: 'All' },
                                                { value: 'archived_only', label: 'Archived' },
                                            ]}
                                        />
                                        <SegmentGroup
                                            label="Account"
                                            value={accountFilter}
                                            onChange={setAccountFilter}
                                            options={[
                                                { value: 'all', label: 'All' },
                                                { value: 'registered', label: 'Registered' },
                                                { value: 'lead', label: 'Lead' },
                                            ]}
                                        />
                                        <SegmentGroup
                                            label="Signup source"
                                            value={sourceFilter}
                                            onChange={setSourceFilter}
                                            options={[
                                                { value: 'all', label: 'All' },
                                                { value: 'qr', label: 'QR' },
                                                { value: 'admin', label: 'Admin' },
                                                { value: 'none', label: 'None' },
                                            ]}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {!filtersPanelOpen && (nonDefaultFilterCount > 0 || query.trim()) ? (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium tabular-nums text-foreground">
                                        {filtered.length} result{filtered.length === 1 ? '' : 's'}
                                    </span>
                                    {archiveVisibility !== 'active_only' ? (
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                            Archive: {archiveVisibility === 'all' ? 'All' : 'Archived'}
                                        </span>
                                    ) : null}
                                    {accountFilter !== 'all' ? (
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                            {accountFilter === 'registered' ? 'Registered' : 'Lead'}
                                        </span>
                                    ) : null}
                                    {sourceFilter !== 'all' ? (
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                            Source: {sourceFilter === 'none' ? 'None' : sourceFilter.toUpperCase()}
                                        </span>
                                    ) : null}
                                    {query.trim() ? (
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                            “{query.trim()}”
                                        </span>
                                    ) : null}
                                    {nonDefaultFilterCount > 0 ? (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Reset filters
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        {actionError ? <AdminErrorAlert message={actionError} /> : null}

                        {loading ? <AdminLoadingRow label="Loading customers..." /> : null}
                        {error ? <AdminErrorAlert message={error} /> : null}

                        <AdminTableShell>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-15">#</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Gender</TableHead>
                                        <TableHead>Wallet</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Last Request</TableHead>
                                        <TableHead className="min-w-40">Note</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map((c, idx) => {
                                        const archived = customerIsArchived(c);
                                        const registered = customerIsRegistered(c);
                                        const rowBusy = actionBusyId === c.id;
                                        return (
                                        <TableRow
                                            key={c.id}
                                            className={`${archived ? 'opacity-75' : ''} ${
                                                c.id ? 'cursor-pointer hover:bg-gray-50/80' : ''
                                            }`}
                                            onClick={() => {
                                                if (c.id) router.push(`/admin/customers/${c.id}`);
                                            }}
                                        >
                                            <TableCell className="text-sm font-medium text-gray-500">
                                                {startIdx + idx + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="text-gray-900 font-semibold">{getCustomerDisplayName(c)}</div>
                                                {c.address && typeof c.address === 'string' && (
                                                    <div className="text-xs text-gray-500">{c.address}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-700">{c.email || '—'}</TableCell>
                                            <TableCell className="text-gray-700">
                                                {formatDisplayPhone(c.phoneNumber ?? c.mobile_number ?? c.phone) || '—'}
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                <span className="capitalize">{c.gender || '—'}</span>
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                <span className="font-semibold text-indigo-600">
                                                    {c.wallet_amount !== undefined ? `ETB ${c.wallet_amount.toFixed(2)}` : '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                                    c.status === 'active' || c.status === 'Active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : c.status === 'inactive' || c.status === 'Inactive'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {c.status || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                {registered ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                                        Registered
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                        Lead
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                {c.signup_source ? (
                                                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-sky-800">
                                                        {c.signup_source}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                {(() => {
                                                    const defaultAddress = c.default_address;
                                                    if (typeof defaultAddress === 'string') {
                                                        try {
                                                            const parsed = JSON.parse(defaultAddress);
                                                            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
                                                                const parts: string[] = [
                                                                    parsed.city, parsed.state, parsed.country, parsed.postal_code
                                                                ].filter((p): p is string => typeof p === 'string' && p.length > 0);
                                                                return parts.length > 0 ? parts.join(', ') : '—';
                                                            } else {
                                                                return defaultAddress || (typeof c.address === 'string' ? c.address : '—');
                                                            }
                                                        } catch {
                                                            return defaultAddress || (typeof c.address === 'string' ? c.address : '—');
                                                        }
                                                    }
                                                    if (defaultAddress && typeof defaultAddress === 'object' && !Array.isArray(defaultAddress) && defaultAddress !== null) {
                                                        const addrObj = defaultAddress as { city?: string; state?: string; country?: string; postal_code?: string };
                                                        const parts: string[] = [
                                                            addrObj.city, addrObj.state, addrObj.country, addrObj.postal_code
                                                        ].filter((p): p is string => typeof p === 'string' && p.length > 0);
                                                        return parts.length > 0 ? parts.join(', ') : '—';
                                                    }
                                                    if (c.address && typeof c.address === 'string') return c.address;
                                                    return '—';
                                                })() as string}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-gray-600">
                                                    {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-gray-600">{c.last_request_at ? new Date(c.last_request_at).toLocaleString() : '—'}</span>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {(() => {
                                                    const customerId = c.id;
                                                    if (!customerId) return null;
                                                    return (
                                                    <AdminNoteField
                                                        display="text"
                                                        value={c.admin_note}
                                                        disabled={!canWriteCustomers}
                                                        onSave={async (note) => {
                                                            const response = await fetch(`/api/admin/customers/${customerId}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ admin_note: note || null }),
                                                            });
                                                            const payload = (await response.json()) as { error?: string };
                                                            if (!response.ok) throw new Error(payload.error || 'Failed to save note');
                                                            dispatch(
                                                                setCustomerAdminNote({
                                                                    id: customerId,
                                                                    admin_note: note || null,
                                                                })
                                                            );
                                                        }}
                                                    />
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {archived ? (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                            Archived
                                                        </span>
                                                    ) : null}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-9 w-9 text-gray-600 hover:text-gray-900"
                                                                aria-label="Row actions"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-52">
                                                            {c.id ? (
                                                                <DropdownMenuItem asChild>
                                                                    <Link
                                                                        href={`/admin/customers/${c.id}`}
                                                                        className="flex cursor-pointer items-center gap-2"
                                                                    >
                                                                        <Users className="h-4 w-4 shrink-0" />
                                                                        View customer
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {!registered && c.id && canWriteCustomers ? (
                                                                <DropdownMenuItem
                                                                    disabled={rowBusy}
                                                                    onSelect={() => {
                                                                        if (!c.id) return;
                                                                        setRegisterCustomerId(c.id);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <KeyRound className="h-4 w-4 shrink-0" />
                                                                        Register &amp; send SMS
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {c.provider_id ? (
                                                                <DropdownMenuItem asChild>
                                                                    <Link
                                                                        href={`/admin/providers/${c.provider_id}`}
                                                                        className="flex cursor-pointer items-center gap-2"
                                                                    >
                                                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                                        Open provider
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            ) : registered && c.id && canWriteCustomers ? (
                                                                <DropdownMenuItem
                                                                    disabled={convertingId === c.id || rowBusy}
                                                                    onSelect={() => {
                                                                        if (!c.id) return;
                                                                        void openConvertConfirm(c.id);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        {convertingId === c.id ? (
                                                                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                                                        ) : (
                                                                            <ArrowRightLeft className="h-4 w-4 shrink-0" />
                                                                        )}
                                                                        Convert to provider
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {canWriteCustomers && !archived && c.id ? (
                                                                <DropdownMenuItem
                                                                    disabled={rowBusy}
                                                                    onSelect={() => {
                                                                        if (!c.id) return;
                                                                        void handleArchiveCustomer(c.id);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <Archive className="h-4 w-4 shrink-0" />
                                                                        Archive
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {canWriteCustomers && archived && c.id ? (
                                                                <DropdownMenuItem
                                                                    disabled={rowBusy}
                                                                    onSelect={() => {
                                                                        if (!c.id) return;
                                                                        void handleRestoreCustomer(c.id);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <ArchiveRestore className="h-4 w-4 shrink-0" />
                                                                        Restore
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {canWriteCustomers && c.id ? (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        variant="destructive"
                                                                        disabled={rowBusy}
                                                                        onSelect={() => {
                                                                            if (!c.id) return;
                                                                            setPendingDeleteCustomerId(c.id);
                                                                        }}
                                                                    >
                                                                        <span className="flex items-center gap-2">
                                                                            <Trash2 className="h-4 w-4 shrink-0" />
                                                                            Delete
                                                                        </span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            ) : null}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        );
                                    })}
                                    {filtered.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={14}>
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <Users className="h-8 w-8 text-gray-400" />
                                                    </div>
                                                    <p className="text-lg font-semibold text-gray-900">No customers found</p>
                                                    <p className="text-sm text-gray-600">Customers will appear here once they register</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </AdminTableShell>

                        {filtered.length > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <p className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{startIdx + 1}</span>–<span className="font-semibold text-gray-900">{Math.min(startIdx + PAGE_SIZE, filtered.length)}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{filtered.length}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-20 text-center text-sm font-medium text-gray-700">
                                        Page {safePage} of {totalPages}
                                    </span>
                                    <button
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    {pendingDeleteCustomerId && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => !actionBusyId && setPendingDeleteCustomerId(null)}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete customer</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Permanently remove this customer from the database. This cannot be undone. Related rows may block deletion until they are removed or updated.
                                </p>
                                <div className="flex items-center gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setPendingDeleteCustomerId(null)}
                                        disabled={Boolean(actionBusyId)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteCustomer()}
                                        disabled={Boolean(actionBusyId)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        {actionBusyId === pendingDeleteCustomerId ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {confirmCustomerId && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => !confirmJobRequestLoading && setConfirmCustomerId(null)}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Convert to Provider</h3>
                                {confirmJobRequestLoading ? (
                                    <p className="mb-6 flex items-center gap-2 text-sm text-gray-600">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Checking job requests…
                                    </p>
                                ) : confirmJobRequestCount > 0 ? (
                                    <p className="text-sm text-gray-600 mb-6">
                                        This customer has{' '}
                                        <span className="font-semibold text-gray-900">{confirmJobRequestCount}</span> job
                                        request{confirmJobRequestCount === 1 ? '' : 's'}. Delete{' '}
                                        {confirmJobRequestCount === 1 ? 'it' : 'them'} before converting. A provider
                                        profile will then be created and the customer row removed.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-600 mb-1">
                                            This will create a provider account for{' '}
                                            <span className="font-semibold text-gray-900">
                                                {(() => {
                                                    const cust = customers.find((c) => c.id === confirmCustomerId);
                                                    return cust ? `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() || 'this customer' : 'this customer';
                                                })()}
                                            </span>.
                                        </p>
                                        <p className="text-sm text-gray-500 mb-6">
                                            A provider profile will be created with the same account id. The customer row will be removed from the customer table. They can sign in as a provider with their existing credentials. This cannot be undone.
                                        </p>
                                    </>
                                )}
                                <div className="flex items-center gap-3 justify-end">
                                    <button
                                        onClick={() => setConfirmCustomerId(null)}
                                        disabled={confirmJobRequestLoading || Boolean(actionBusyId)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleConvert(confirmCustomerId)}
                                        disabled={confirmJobRequestLoading || Boolean(actionBusyId)}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {confirmJobRequestCount > 0
                                            ? 'Delete job requests & convert'
                                            : 'Convert'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {convertedProviderId && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={dismissConvertResult}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Provider Created</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    The provider account is ready. The customer record has been removed from the customer list.
                                </p>
                                <div className="flex items-center gap-3 justify-center">
                                    <button
                                        onClick={dismissConvertResult}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Close
                                    </button>
                                    <Link
                                        href={`/admin/providers/${convertedProviderId}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                    >
                                        View Provider
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {convertError && !convertedProviderId && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => dispatch(resetConvertState())}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                    <ArrowRightLeft className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Conversion Failed</h3>
                                <p className="text-sm text-red-600 mb-6">{convertError}</p>
                                <button
                                    onClick={() => dispatch(resetConvertState())}
                                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    <CreateAppUserModal
                        open={createOpen}
                        kind="customer"
                        onClose={() => setCreateOpen(false)}
                        onCreated={() => {
                            void dispatch(fetchAllCustomers()).then((action) => {
                                if (fetchAllCustomers.fulfilled.match(action)) {
                                    markAdminListFetched('customers');
                                }
                            });
                        }}
                    />
                    <BulkLeadCustomersModal
                        open={leadsOpen}
                        onClose={() => setLeadsOpen(false)}
                        onCreated={() => {
                            void dispatch(fetchAllCustomers()).then((action) => {
                                if (fetchAllCustomers.fulfilled.match(action)) {
                                    markAdminListFetched('customers');
                                }
                            });
                        }}
                    />
                    {registerCustomerId ? (
                        <RegisterCustomerAuthModal
                            open
                            customerId={registerCustomerId}
                            customerName={
                                getCustomerDisplayName(
                                    customers.find((c) => c.id === registerCustomerId) ?? null
                                ) || 'this customer'
                            }
                            onClose={() => setRegisterCustomerId(null)}
                            onRegistered={() => {
                                void dispatch(fetchAllCustomers()).then((action) => {
                                    if (fetchAllCustomers.fulfilled.match(action)) {
                                        markAdminListFetched('customers');
                                    }
                                });
                            }}
                        />
                    ) : null}
            </AdminShell>
        </>
    );
}
