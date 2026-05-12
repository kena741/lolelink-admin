"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers } from '@/features/customer/customerSlice';
import { ChevronLeft, ChevronRight, Download, Search, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AuthGuard from '@/components/AuthGuard';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;

export default function CustomersPage() {
    const dispatch = useAppDispatch();
    const { customers, loading, error } = useAppSelector((s) => s.customer);
    const [query, setQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        dispatch(fetchAllCustomers());
    }, [dispatch]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    const filtered = useMemo(() => {
        const sorted = [...customers].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        });

        if (!query.trim()) return sorted;
        const q = query.toLowerCase();
        return sorted.filter((c) => {
            const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
            const email = (c.email ?? '').toLowerCase();
            const phone = ((c.mobile_number || c.phone) ?? '').toLowerCase();
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
    }, [customers, query]);

    function exportToXlsx() {
        const rows = filtered.map((c) => ({
            'Full Name': [c.first_name, c.last_name].filter(Boolean).join(' '),
            'Phone': c.mobile_number || c.phone || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

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
                            <button
                                onClick={exportToXlsx}
                                disabled={filtered.length === 0}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl px-4 py-3 text-sm font-semibold text-gray-700 shadow-lg transition-all hover:bg-white hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download className="h-4 w-4" />
                                Export XLSX
                            </button>
                        </div>

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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map((c, idx) => (
                                        <TableRow key={c.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20">
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
                                                {c.mobile_number || c.phone || '—'}
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
                                        </TableRow>
                                    ))}
                                    {filtered.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={10}>
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
                </main>
            </div>
        </AuthGuard>
    );
}
