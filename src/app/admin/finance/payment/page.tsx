'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, RefreshCw, XCircle } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { AdminTableShell } from '@/components/admin/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchPayments, updatePayment } from '@/features/payments/paymentsSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatStatusLabel } from '@/lib/utils';

const STATUS_OPTIONS = [
    'pending_payment',
    'payment_approved_by_admin',
    'payment_rejected_by_admin',
    'payment_completed',
    'payment_cancelled',
] as const;

type PaymentStatusOption = (typeof STATUS_OPTIONS)[number];

const PaymentPage = () => {
    const dispatch = useAppDispatch();
    const { payments, loading, error } = useAppSelector((state) => state.payments);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchPayments());
    }, [dispatch]);

    const stats = useMemo(() => {
        const pending = payments.filter((payment) => payment.paymentStatus === 'pending_payment').length;
        const successful = payments.filter((payment) => payment.paymentStatus === 'payment_completed').length;
        const failed = payments.filter((payment) => payment.paymentStatus === 'payment_rejected_by_admin').length;
        const totalAmount = payments.reduce((sum, payment) => sum + (Number(payment.totalAmount) || 0), 0);

        return { pending, successful, failed, totalAmount };
    }, [payments]);

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

    const handleStatusChange = async (id: string, nextStatus: PaymentStatusOption, paymentId: string) => {
        setProcessingId(id);
        try {
            await dispatch(
                updatePayment({
                    id,
                    paymentStatus: nextStatus,
                    paidAt: nextStatus === 'payment_completed' ? new Date().toISOString() : '',
                    paymentId: paymentId || crypto.randomUUID(),
                })
            ).unwrap();
        } catch (updateError) {
            console.error('Failed to update payment status:', updateError);
        } finally {
            setProcessingId(null);
        }
    };

    const statusClassMap: Record<string, string> = {
        pending_payment: 'bg-amber-500/10 text-amber-700 border-amber-300/50',
        payment_approved_by_admin: 'bg-indigo-500/10 text-indigo-700 border-indigo-300/50',
        payment_rejected_by_admin: 'bg-red-500/10 text-red-700 border-red-300/50',
        payment_completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/50',
        payment_cancelled: 'bg-slate-500/10 text-slate-700 border-slate-300/50',
    };

    return (
        <AuthGuard>
            <AdminShell>
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
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                                                                <CreditCard className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-gray-900">No payments found</p>
                                                            <p className="text-sm text-gray-600">Payments will show here once created</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                payments.map((payment) => {
                                                    const isProcessing = processingId === payment.id;
                                                    const currentStatus = payment.paymentStatus || 'pending_payment';
                                                    const badgeClass = statusClassMap[currentStatus] || statusClassMap.pending_payment;

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
                                                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClass}`}>
                                                                    {currentStatus === 'payment_completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'pending_payment' && <Clock className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'payment_rejected_by_admin' && <XCircle className="h-3.5 w-3.5" />}
                                                                    {currentStatus === 'payment_cancelled' && <RefreshCw className="h-3.5 w-3.5" />}
                                                                    {formatStatusLabel(currentStatus)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-gray-600">
                                                                {payment.bookingDate ? formatDate(payment.bookingDate) : '—'}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <select
                                                                    value={currentStatus}
                                                                    onChange={(event) => handleStatusChange(payment.id, event.target.value as PaymentStatusOption, payment.paymentId)}
                                                                    disabled={isProcessing}
                                                                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    {STATUS_OPTIONS.map((status) => (
                                                                        <option key={status} value={status}>
                                                                            {formatStatusLabel(status)}
                                                                        </option>
                                                                    ))}
                                                                </select>
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
            </AdminShell>
        </AuthGuard>
    );
};

export default PaymentPage;
