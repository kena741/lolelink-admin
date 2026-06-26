'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminFilterPanel,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
} from '@/components/admin/admin-layout';
import { AdminDataTableEmpty, AdminTableShell } from '@/components/admin/data-table';
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
            <AdminShell>
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

                        <AdminFilterPanel>
                            <AdminSearchInput
                                value={query}
                                onChange={setQuery}
                                placeholder="Search title, description, customer, phone, service..."
                            />
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
                                        className={`h-8 rounded-md border px-3 text-sm font-semibold transition-colors ${
                                            statusFilter === option.id
                                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                                <span className="rounded-md bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                                    {filteredItems.length} results
                                </span>
                            </div>
                        </AdminFilterPanel>

                        {loading ? <AdminLoadingRow label="Loading job requests…" /> : null}
                        {error ? <AdminErrorAlert message={error} /> : null}

                        <AdminTableShell>
                            {!loading && filteredItems.length === 0 ? (
                                <AdminDataTableEmpty
                                    title="No job requests found"
                                    description="Try adjusting your search or filters"
                                />
                            ) : !loading ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Bids</TableHead>
                                            <TableHead>Payment</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map((item) => {
                                            const bidsCount = Array.isArray(item.bidList) ? item.bidList.length : 0;
                                            const displayStatus = item.accepted ? 'accepted' : (item.status || 'pending');
                                            return (
                                                <TableRow key={item.id} className="align-top">
                                                    <TableCell className="max-w-[280px]">
                                                        <p className="font-semibold text-gray-900">{item.title || 'Untitled'}</p>
                                                        <p className="mt-1 text-xs text-gray-600">{item.description || 'No description'}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-gray-900">
                                                            {item.customerDisplayName?.trim() || '—'}
                                                        </div>
                                                        <div className="mt-0.5 text-sm text-gray-600">
                                                            {item.customerDisplayPhone?.trim() || '—'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{item.serviceModelList?.[0]?.serviceName || '—'}</TableCell>
                                                    <TableCell>{item.price || '—'}</TableCell>
                                                    <TableCell>{bidsCount}</TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${item.is_paid === true ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {item.is_paid === true ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
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
                                                    <TableCell className="whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            ) : null}
                        </AdminTableShell>
            </AdminShell>
        </AuthGuard>
    );
};

export default JobRequestsPage;
