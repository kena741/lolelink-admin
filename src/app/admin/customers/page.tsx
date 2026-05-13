"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers, convertToProvider, resetConvertState, archiveCustomer, restoreCustomer, deleteCustomer } from '@/features/customer/customerSlice';
import { ChevronLeft, ChevronRight, Download, Search, Users, ArrowRightLeft, CheckCircle2, Loader2, Archive, ArchiveRestore, Trash2, MoreVertical, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;

function customerIsArchived(c: { archived_at?: string | null; archivedAt?: string | null }): boolean {
    const v = c.archived_at ?? c.archivedAt;
    return typeof v === 'string' && v.length > 0;
}

export default function CustomersPage() {
    const dispatch = useAppDispatch();
    const { customers, loading, error, convertingId, convertError } = useAppSelector((s) => s.customer);
    const [query, setQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [confirmCustomerId, setConfirmCustomerId] = useState<string | null>(null);
    const [convertedProviderId, setConvertedProviderId] = useState<string | null>(null);
    const [actionBusyId, setActionBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [pendingDeleteCustomerId, setPendingDeleteCustomerId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchAllCustomers());
    }, [dispatch]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, showArchived]);

    const handleConvert = useCallback(async (customerId: string) => {
        setConfirmCustomerId(null);
        const result = await dispatch(convertToProvider(customerId));
        if (convertToProvider.fulfilled.match(result)) {
            setConvertedProviderId(result.payload.providerId);
        }
    }, [dispatch]);

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

    const filtered = useMemo(() => {
        const visible = customers.filter((c) => showArchived || !customerIsArchived(c));
        const sorted = [...visible].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        });

        if (!query.trim()) return sorted;
        const q = query.toLowerCase();
        return sorted.filter((c) => {
            const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
            const email = (c.email ?? '').toLowerCase();
            const phone = ((c.phoneNumber ?? c.mobile_number ?? c.phone) ?? '').toLowerCase();
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
            return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
        });
    }, [customers, query, showArchived]);

    function exportToXlsx() {
        const rows = filtered.map((c) => ({
            'Full Name': [c.first_name, c.last_name].filter(Boolean).join(' '),
            'Phone': c.phoneNumber ?? c.mobile_number ?? c.phone ?? '',
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
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Users className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground drop-shadow-lg">
                                            Customers
                                        </h1>
                                    </div>
                                    <p className="text-primary-foreground/90 text-base font-medium">
                                        Directory of customers and their recent activity
                                    </p>
                                </div>
                                <div className="rounded-xl border border-primary-foreground/15 bg-card/15 px-4 py-2 backdrop-blur-md">
                                    <div className="text-sm text-primary-foreground/80">Total Customers</div>
                                    <div className="text-2xl font-bold text-primary-foreground">{customers.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:w-96">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search name, email, phone, address..."
                                        className="w-full rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50 shadow-lg transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowArchived((v) => !v)}
                                    className={`inline-flex h-[40px] items-center rounded-md border px-3 text-sm font-semibold transition-colors ${
                                        showArchived
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                                            : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-white'
                                    }`}
                                >
                                    {showArchived ? 'Showing archived' : 'Show archived'}
                                </button>
                                <button
                                    onClick={exportToXlsx}
                                    disabled={filtered.length === 0}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl px-4 py-3 text-sm font-semibold text-gray-700 shadow-lg transition-all hover:bg-white hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Download className="h-4 w-4" />
                                    Export XLSX
                                </button>
                            </div>
                        </div>

                        {actionError && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {actionError}
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                Loading customers...
                            </div>
                        )}
                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20">
                                        <TableHead className="font-semibold text-gray-700 w-[60px]">#</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Email</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Gender</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Wallet</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Address</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Created</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Last Request</TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map((c, idx) => {
                                        const archived = customerIsArchived(c);
                                        const rowBusy = actionBusyId === c.id;
                                        return (
                                        <TableRow key={c.id} className={`hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20 ${archived ? 'opacity-75' : ''}`}>
                                            <TableCell className="text-sm font-medium text-gray-500">
                                                {startIdx + idx + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="text-gray-900 font-semibold">{c.first_name} {c.last_name}</div>
                                                {c.address && typeof c.address === 'string' && (
                                                    <div className="text-xs text-gray-500">{c.address}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-700">{c.email || '—'}</TableCell>
                                            <TableCell className="text-gray-700">
                                                {c.phoneNumber ?? c.mobile_number ?? c.phone ?? '—'}
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
                                            <TableCell className="text-right">
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
                                                            ) : c.id ? (
                                                                <DropdownMenuItem
                                                                    disabled={convertingId === c.id || rowBusy}
                                                                    onSelect={() => {
                                                                        if (!c.id) return;
                                                                        setConfirmCustomerId(c.id);
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
                                                            {!archived && c.id ? (
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
                                                            {archived && c.id ? (
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
                                                            {c.id ? (
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
                                            <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={11}>
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
                        </div>

                        {filtered.length > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl px-6 py-3 shadow-lg">
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
                                    <span className="min-w-[80px] text-center text-sm font-medium text-gray-700">
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
                    </div>
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
                            onClick={() => setConfirmCustomerId(null)}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Convert to Provider</h3>
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
                                <div className="flex items-center gap-3 justify-end">
                                    <button
                                        onClick={() => setConfirmCustomerId(null)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleConvert(confirmCustomerId)}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                    >
                                        Convert
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
                </main>
            </div>
        </AuthGuard>
    );
}
