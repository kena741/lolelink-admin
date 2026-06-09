'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Search, FileText, X } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface JobRequestBid {
    price?: string | null;
    createdAt?: string | null;
    providerId?: string | null;
}

interface JobRequestServiceModel {
    serviceName?: string | null;
}

interface JobRequestRow {
    id: string;
    createdAt?: string | null;
    accepted?: boolean | null;
    is_paid?: boolean | null;
    bidList?: JobRequestBid[] | null;
    price?: string | null;
    customerId?: string | null;
    customerDisplayName?: string | null;
    customerDisplayPhone?: string | null;
    description?: string | null;
    title?: string | null;
    status?: string | null;
    serviceModelList?: JobRequestServiceModel[] | null;
}

function formatDate(value?: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString();
}

const JobRequestsPage = () => {
    const [items, setItems] = useState<JobRequestRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    async function fetchJobRequests() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/job-requests', { method: 'GET' });
            const payload = (await response.json()) as { data?: JobRequestRow[]; error?: string };
            if (!response.ok)
                throw new Error(payload.error || 'Failed to load job requests');
            setItems(payload.data ?? []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load job requests';
            setItems([]);
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchJobRequests();
    }, []);

    async function updateJobRequestStatus(id: string, action: 'accept' | 'reject' | 'pending') {
        setUpdatingId(id);
        setError(null);
        try {
            const response = await fetch('/api/job-requests', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, action }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok)
                throw new Error(payload.error || 'Failed to update request');
            setItems((prev) => prev.map((item) => {
                if (item.id !== id) return item;
                if (action === 'accept')
                    return { ...item, accepted: true, status: 'accepted' };
                if (action === 'reject')
                    return { ...item, accepted: false, status: 'rejected' };
                return { ...item, accepted: false, status: 'pending' };
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update request';
            setError(message);
        } finally {
            setUpdatingId(null);
        }
    }

    const filteredItems = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return items.filter((item) => {
            const effectiveStatus = item.accepted ? 'accepted' : ((item.status || 'pending').toLowerCase());
            if (statusFilter !== 'all' && effectiveStatus !== statusFilter)
                return false;
            if (!normalized) return true;
            const serviceName = item.serviceModelList?.[0]?.serviceName || '';
            const customerName = (item.customerDisplayName || '').toLowerCase();
            const customerPhone = (item.customerDisplayPhone || '').toLowerCase();
            return (item.title || '').toLowerCase().includes(normalized)
                || (item.description || '').toLowerCase().includes(normalized)
                || (item.customerId || '').toLowerCase().includes(normalized)
                || customerName.includes(normalized)
                || customerPhone.includes(normalized)
                || serviceName.toLowerCase().includes(normalized);
        });
    }, [items, query, statusFilter]);

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Customer Job Requests"
                            backHref="/admin/customers"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Customers', href: '/admin/customers' },
                                { label: 'Job Requests' },
                            ]}
                            actions={
                                <button
                                    type="button"
                                    onClick={fetchJobRequests}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />
                        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full sm:max-w-[440px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search title, description, customer, phone, service..."
                                    className="w-full rounded-full border border-subtle bg-base py-2 pl-10 pr-10 text-sm text-primary shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-accent-info"
                                />
                                {query ? (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-secondary hover:bg-subtle hover:text-primary"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'pending', label: 'Pending' },
                                    { id: 'accepted', label: 'Accepted' },
                                    { id: 'rejected', label: 'Rejected' },
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setStatusFilter(option.id as 'all' | 'pending' | 'accepted' | 'rejected')}
                                        className={`h-[32px] rounded-full border px-3 text-[13px] font-semibold transition-all duration-150 ${
                                            statusFilter === option.id
                                                ? 'border-strong bg-subtle text-primary'
                                                : 'border-subtle bg-base text-secondary hover:bg-subtle hover:text-primary'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                                <span className="rounded-full bg-subtle px-3 py-1 text-[13px] font-semibold text-primary">
                                    {filteredItems.length} results
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                            {error ? (
                                <div className="m-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                    {error}
                                </div>
                            ) : loading ? (
                                <div className="p-8 text-center">
                                    <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-gray-600">Loading job requests...</p>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="px-4 py-12 text-center text-gray-500">
                                    No job requests found.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20">
                                            <TableHead className="font-semibold text-gray-700">Title</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Service</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Price</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Bids</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Payment</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map((item) => {
                                            const bidsCount = Array.isArray(item.bidList) ? item.bidList.length : 0;
                                            const displayStatus = item.accepted ? 'accepted' : (item.status || 'pending');
                                            return (
                                                <TableRow key={item.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20 align-top">
                                                    <TableCell className="max-w-[280px] text-gray-700">
                                                        <p className="font-semibold text-gray-900">{item.title || 'Untitled'}</p>
                                                        <p className="mt-1 text-xs">{item.description || 'No description'}</p>
                                                    </TableCell>
                                                    <TableCell className="text-gray-700">
                                                        <div className="font-medium text-gray-900">
                                                            {item.customerDisplayName?.trim() || '—'}
                                                        </div>
                                                        <div className="mt-0.5 text-sm text-gray-600">
                                                            {item.customerDisplayPhone?.trim() || '—'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-gray-700">{item.serviceModelList?.[0]?.serviceName || '—'}</TableCell>
                                                    <TableCell className="text-gray-700">{item.price || '—'}</TableCell>
                                                    <TableCell className="text-gray-700">{bidsCount}</TableCell>
                                                    <TableCell className="text-gray-700">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${item.is_paid === true ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {item.is_paid === true ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-gray-700">
                                                        <select
                                                            disabled={updatingId === item.id}
                                                            value={
                                                                displayStatus.toLowerCase() === 'accepted'
                                                                    ? 'accepted'
                                                                    : displayStatus.toLowerCase() === 'rejected'
                                                                        ? 'rejected'
                                                                        : 'pending'
                                                            }
                                                            onChange={(event) => {
                                                                const next = event.target.value;
                                                                if (next === 'accepted')
                                                                    updateJobRequestStatus(item.id, 'accept');
                                                                else if (next === 'rejected')
                                                                    updateJobRequestStatus(item.id, 'reject');
                                                                else
                                                                    updateJobRequestStatus(item.id, 'pending');
                                                            }}
                                                            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="accepted">Accepted</option>
                                                            <option value="rejected">Rejected</option>
                                                        </select>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-gray-700">{formatDate(item.createdAt)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default JobRequestsPage;
