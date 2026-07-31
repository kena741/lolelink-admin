'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminFilterPanel,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
} from '@/components/admin/admin-layout';
import { AdminListPagination } from '@/components/admin/AdminListPagination';
import { AdminDataTableEmpty, AdminTableShell } from '@/components/admin/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatBookingAmount } from '@/lib/booking-display';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

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

interface EditFormState {
    title: string;
    description: string;
    price: string;
}

function formatDate(value?: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString();
}

const JobRequestsPage = () => {
    const { canWriteCustomers } = useAdminPermissions();
    const [items, setItems] = useState<JobRequestRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [editingItem, setEditingItem] = useState<JobRequestRow | null>(null);
    const [editForm, setEditForm] = useState<EditFormState>({ title: '', description: '', price: '' });
    const [deleteItem, setDeleteItem] = useState<JobRequestRow | null>(null);
    const [actionBusy, setActionBusy] = useState(false);

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

    function openEdit(item: JobRequestRow) {
        setEditingItem(item);
        setEditForm({
            title: item.title || '',
            description: item.description || '',
            price: item.price || '',
        });
    }

    async function saveEdit() {
        if (!editingItem) return;
        setActionBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/job-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingItem.id,
                    title: editForm.title,
                    description: editForm.description,
                    price: editForm.price,
                }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to update job request');
            setItems((prev) =>
                prev.map((item) =>
                    item.id === editingItem.id
                        ? {
                              ...item,
                              title: editForm.title,
                              description: editForm.description,
                              price: editForm.price,
                          }
                        : item
                )
            );
            setEditingItem(null);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'Failed to update job request');
        } finally {
            setActionBusy(false);
        }
    }

    async function confirmDelete() {
        if (!deleteItem) return;
        setActionBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/job-requests', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deleteItem.id }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to delete job request');
            setItems((prev) => prev.filter((item) => item.id !== deleteItem.id));
            setDeleteItem(null);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'Failed to delete job request');
        } finally {
            setActionBusy(false);
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

    useEffect(() => {
        setCurrentPage(1);
    }, [query, statusFilter, pageSize]);

    const totalPages = filteredItems.length > 0 ? Math.ceil(filteredItems.length / pageSize) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = filteredItems.slice(startIdx, startIdx + pageSize);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

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
                                            {canWriteCustomers ? (
                                                <TableHead className="text-right">Actions</TableHead>
                                            ) : null}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginated.map((item) => {
                                            const bidsCount = Array.isArray(item.bidList) ? item.bidList.length : 0;
                                            const displayStatus = item.accepted ? 'accepted' : (item.status || 'pending');
                                            const busy = updatingId === item.id || actionBusy;
                                            return (
                                                <TableRow key={item.id} className="align-top">
                                                    <TableCell className="max-w-70">
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
                                                    <TableCell>{formatBookingAmount(item.price)}</TableCell>
                                                    <TableCell>{bidsCount}</TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${item.is_paid === true ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {item.is_paid === true ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {canWriteCustomers ? (
                                                            <select
                                                                disabled={busy}
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
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">
                                                                {displayStatus}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                                                    {canWriteCustomers ? (
                                                        <TableCell className="text-right">
                                                            <div className="inline-flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => openEdit(item)}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                                                                    aria-label="Edit job request"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => setDeleteItem(item)}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                                                    aria-label="Delete job request"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </TableCell>
                                                    ) : null}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            ) : null}
                        </AdminTableShell>

                        <AdminListPagination
                            page={safePage}
                            pageSize={pageSize}
                            totalItems={filteredItems.length}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />

                        {editingItem && canWriteCustomers ? (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                                onClick={() => !actionBusy && setEditingItem(null)}
                            >
                                <div
                                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <h3 className="mb-4 text-lg font-bold text-gray-900">Edit job request</h3>
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Title
                                            <input
                                                value={editForm.title}
                                                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                                                className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Description
                                            <textarea
                                                value={editForm.description}
                                                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                                                rows={4}
                                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Price
                                            <input
                                                value={editForm.price}
                                                onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                                                className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </label>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={() => setEditingItem(null)}
                                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={() => void saveEdit()}
                                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {deleteItem && canWriteCustomers ? (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                                onClick={() => !actionBusy && setDeleteItem(null)}
                            >
                                <div
                                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <h3 className="mb-2 text-lg font-bold text-gray-900">Delete job request</h3>
                                    <p className="mb-6 text-sm text-gray-600">
                                        Permanently delete “{deleteItem.title || 'Untitled'}”? This cannot be undone.
                                    </p>
                                    <div className="flex justify-end gap-3">
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={() => setDeleteItem(null)}
                                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={() => void confirmDelete()}
                                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
            </AdminShell>
        </AuthGuard>
    );
};

export default JobRequestsPage;
