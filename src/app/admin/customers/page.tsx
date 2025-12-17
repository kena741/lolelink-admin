"use client";
import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers } from '@/features/customer/customerSlice';
import { Search, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AuthGuard from '@/components/AuthGuard';

export default function CustomersPage() {
    const dispatch = useAppDispatch();
    const { customers, loading, error } = useAppSelector((s) => s.customer);
    const [query, setQuery] = useState('');

    useEffect(() => {
        dispatch(fetchAllCustomers());
    }, [dispatch]);

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Customers
                                        </h1>
                                    </div>
                                    <p className="text-white/90 text-base font-medium">
                                        Directory of customers and their recent activity
                                    </p>
                                </div>
                                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                                    <div className="text-sm text-white/80">Total Customers</div>
                                    <div className="text-2xl font-bold text-white">{customers.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Toolbar */}
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
                                    {customers
                                        .filter((c) => {
                                            const q = query.toLowerCase();
                                            if (!q) return true;
                                            const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
                                            const email = (c.email ?? '').toLowerCase();
                                            const phone = ((c.mobile_number || c.phone) ?? '').toLowerCase();
                                            const address = (() => {
                                                // Handle default_address - could be object or JSON string
                                                const defaultAddress = c.default_address;
                                                
                                                // If it's a string, try to parse it
                                                if (typeof defaultAddress === 'string') {
                                                    try {
                                                        const parsed = JSON.parse(defaultAddress);
                                                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                                            const parts = [
                                                                parsed.city,
                                                                parsed.state,
                                                                parsed.country,
                                                                parsed.postal_code
                                                            ].filter(Boolean);
                                                            return parts.join(' ').toLowerCase();
                                                        }
                                                        return (defaultAddress || c.address || '').toString().toLowerCase();
                                                    } catch {
                                                        // If parsing fails, treat as regular address string
                                                        return (defaultAddress || c.address || '').toString().toLowerCase();
                                                    }
                                                }
                                                
                                                // If it's an object, format it
                                                if (defaultAddress && typeof defaultAddress === 'object') {
                                                    const parts = [
                                                        defaultAddress.city,
                                                        defaultAddress.state,
                                                        defaultAddress.country,
                                                        defaultAddress.postal_code
                                                    ].filter(Boolean);
                                                    return parts.join(' ').toLowerCase();
                                                }
                                                
                                                // Fallback to regular address (ensure it's a string)
                                                return (c.address || '').toString().toLowerCase();
                                            })();
                                            return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
                                        })
                                        .map((c) => (
                                            <TableRow key={c.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-2 ring-white/50 shadow-md grid place-items-center text-xs font-bold">
                                                            {(() => {
                                                                const first = (c.first_name ?? '').toString();
                                                                const last = (c.last_name ?? '').toString();
                                                                const parts = `${first} ${last}`.trim().split(/\s+/).filter(Boolean);
                                                                const initials = parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
                                                                return initials || 'CU';
                                                            })()}
                                                        </div>
                                                        <div>
                                                            <div className="text-gray-900 font-semibold">{c.first_name} {c.last_name}</div>
                                                            {c.address && typeof c.address === 'string' && (
                                                                <div className="text-xs text-gray-500">{c.address}</div>
                                                            )}
                                                        </div>
                                                    </div>
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
                                                        // Handle default_address - could be object or JSON string
                                                        const defaultAddress = c.default_address;
                                                        
                                                        // If it's a string, try to parse it
                                                        if (typeof defaultAddress === 'string') {
                                                            try {
                                                                const parsed = JSON.parse(defaultAddress);
                                                                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
                                                                    // Format the parsed object
                                                                    const parts: string[] = [
                                                                        parsed.city,
                                                                        parsed.state,
                                                                        parsed.country,
                                                                        parsed.postal_code
                                                                    ].filter((p): p is string => typeof p === 'string' && p.length > 0);
                                                                    return parts.length > 0 ? parts.join(', ') : '—';
                                                                } else {
                                                                    // If parsing fails or returns non-object, treat as regular address string
                                                                    return defaultAddress || (typeof c.address === 'string' ? c.address : '—');
                                                                }
                                                            } catch {
                                                                // If parsing fails, treat as regular address string
                                                                return defaultAddress || (typeof c.address === 'string' ? c.address : '—');
                                                            }
                                                        }
                                                        
                                                        // If it's an object, format it
                                                        if (defaultAddress && typeof defaultAddress === 'object' && !Array.isArray(defaultAddress) && defaultAddress !== null) {
                                                            const addrObj = defaultAddress as { city?: string; state?: string; country?: string; postal_code?: string };
                                                            const parts: string[] = [
                                                                addrObj.city,
                                                                addrObj.state,
                                                                addrObj.country,
                                                                addrObj.postal_code
                                                            ].filter((p): p is string => typeof p === 'string' && p.length > 0);
                                                            return parts.length > 0 ? parts.join(', ') : '—';
                                                        }
                                                        
                                                        // Fallback to regular address (ensure it's a string)
                                                        if (c.address && typeof c.address === 'string') {
                                                            return c.address;
                                                        }
                                                        
                                                        return '—';
                                                    })() as string}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-gray-600">
                                                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-gray-600">{c.last_request_at ? new Date(c.last_request_at).toLocaleString() : '—'}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    {customers.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={9}>
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
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
