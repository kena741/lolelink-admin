'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, RefreshCw, XCircle } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminSegmentedControl,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { AdminListPagination } from '@/components/admin/AdminListPagination';
import { AdminStatusBadge, AdminTableShell } from '@/components/admin/data-table';
import { getPaymentRecordStatusTone } from '@/lib/admin-status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchPayments } from '@/features/payments/paymentsSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatStatusLabel } from '@/lib/utils';
import {
    isDateInDashboardRange,
    type DashboardRange,
} from '@/lib/dashboard-range';

const STATUS_OPTIONS = [
    'pending_payment',
    'payment_approved_by_admin',
    'payment_rejected_by_admin',
    'payment_completed',
    'payment_cancelled',
] as const;

type PaymentStatusFilter = 'all' | (typeof STATUS_OPTIONS)[number];

const STATUS_FILTER_OPTIONS: Array<{ value: PaymentStatusFilter; label: string }> = [
    { value: 'all', label: 'All statuses' },
    ...STATUS_OPTIONS.map((status) => ({
        value: status as PaymentStatusFilter,
        label: formatStatusLabel(status),
    })),
];

const DATE_FILTER_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Week' },
    { value: '30d', label: 'Month' },
];

const PaymentPage = () => {
    const dispatch = useAppDispatch();
    const { payments, loading, error } = useAppSelector((state) => state.payments);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
    const [dateFilter, setDateFilter] = useState<DashboardRange>('all');

    useEffect(() => {
        dispatch(fetchPayments());
    }, [dispatch]);

    const filteredPayments = useMemo(() => {
        return payments.filter((payment) => {
            const status = payment.paymentStatus || 'pending_payment';
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            const dateRef = payment.createdAt || payment.bookingDate || payment.paidAt;
            return isDateInDashboardRange(dateRef, dateFilter);
        });
    }, [payments, statusFilter, dateFilter]);

    const stats = useMemo(() => {
        const pending = filteredPayments.filter((payment) => payment.paymentStatus === 'pending_payment').length;
        const successful = filteredPayments.filter((payment) => payment.paymentStatus === 'payment_completed').length;
        const failed = filteredPayments.filter((payment) => payment.paymentStatus === 'payment_rejected_by_admin').length;
        const totalAmount = filteredPayments.reduce((sum, payment) => sum + (Number(payment.totalAmount) || 0), 0);

        return { pending, successful, failed, totalAmount };
    }, [filteredPayments]);

    const totalPages = filteredPayments.length > 0 ? Math.ceil(filteredPayments.length / pageSize) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = filteredPayments.slice(startIdx, startIdx + pageSize);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, statusFilter, dateFilter]);

    function formatDate(value: string) {
        return new Date(value).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function formatAmount(value: number) {
        return `ETB ${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return (
        <AuthGuard>
            <AdminShell wide>
                        <AdminPageHeader
                            title="Payments"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Payments' },
                            ]}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => dispatch(fetchPayments())}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <AdminFilterSelect
                                    aria-label="Status"
                                    value={statusFilter}
                                    options={STATUS_FILTER_OPTIONS}
                                    onChange={setStatusFilter}
                                />
                                <AdminSegmentedControl
                                    aria-label="Date range"
                                    value={dateFilter}
                                    options={DATE_FILTER_OPTIONS}
                                    onChange={(value) => setDateFilter(value as DashboardRange)}
                                />
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <p>
                                    <span className="tabular-nums text-gray-900">{filteredPayments.length}</span>
                                    <span className="mx-1 text-gray-300">/</span>
                                    <span className="tabular-nums">{payments.length}</span>
                                </p>
                                {(statusFilter !== 'all' || dateFilter !== 'all') ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStatusFilter('all');
                                            setDateFilter('all');
                                        }}
                                        className="font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                                    >
                                        Clear
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <section className="mb-6 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                            <AdminStatCard title="Pending" value={loading ? '…' : String(stats.pending)} />
                            <AdminStatCard title="Successful" value={loading ? '…' : String(stats.successful)} />
                            <AdminStatCard title="Failed" value={loading ? '…' : String(stats.failed)} />
                            <AdminStatCard
                                title="Total Amount"
                                value={loading ? '…' : `ETB ${stats.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                            />
                        </section>

                        {loading ? <AdminLoadingRow label="Loading payments…" /> : null}
                        {error ? <AdminErrorAlert message={error} /> : null}

                        <AdminTableShell>
                            {!loading ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Booking ID</TableHead>
                                                <TableHead>Customer ID</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead>Provider Ref</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPayments.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                                                                <CreditCard className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-gray-900">No payments found</p>
                                                            <p className="text-sm text-gray-600">
                                                                {payments.length === 0
                                                                    ? 'Payments will show here once created'
                                                                    : 'Try a different status or date filter'}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                paginated.map((payment) => {
                                                    const currentStatus = payment.paymentStatus || 'pending_payment';

                                                    return (
                                                        <TableRow key={payment.id}>
                                                            <TableCell className="max-w-[180px] truncate font-medium text-gray-900">{payment.id}</TableCell>
                                                            <TableCell className="max-w-[180px] truncate text-gray-700">{payment.customerId}</TableCell>
                                                            <TableCell className="text-gray-700">{payment.paymentType || '—'}</TableCell>
                                                            <TableCell className="max-w-[180px] truncate text-gray-700">{payment.paymentId || '—'}</TableCell>
                                                            <TableCell className="font-semibold text-gray-900">
                                                                {formatAmount(payment.totalAmount)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <AdminStatusBadge
                                                                    tone={getPaymentRecordStatusTone(currentStatus)}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                                                                >
                                                                    {currentStatus === 'payment_completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'pending_payment' && <Clock className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'payment_rejected_by_admin' && <XCircle className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'payment_cancelled' && <RefreshCw className="h-3.5 w-3.5" />}
                                                                    {formatStatusLabel(currentStatus)}
                                                                </AdminStatusBadge>
                                                            </TableCell>
                                                            <TableCell className="text-gray-600">
                                                                {payment.bookingDate ? formatDate(payment.bookingDate) : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : null}
                        </AdminTableShell>

                        <AdminListPagination
                            page={safePage}
                            pageSize={pageSize}
                            totalItems={filteredPayments.length}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
            </AdminShell>
        </AuthGuard>
    );
};

export default PaymentPage;
