'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, CreditCard, RefreshCw, XCircle } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
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
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <Link
                                            href="/admin/dashboard"
                                            className="rounded-lg bg-white/20 p-2 backdrop-blur-sm transition-colors hover:bg-white/30"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-white" />
                                        </Link>
                                        <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                                            <CreditCard className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl">
                                            Payments
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-white/90">
                                        <Link href="/admin/dashboard" className="transition-colors hover:text-white">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="font-semibold text-white">Payments</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dispatch(fetchPayments())}
                                    className="group inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/20 hover:ring-white/40"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Pending</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.pending}</p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Successful</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.successful}</p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Failed</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.failed}</p>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                                <p className="mb-1 text-sm font-medium text-gray-600">Total Amount</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {loading ? '...' : `ETB ${stats.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                                </p>
                            </div>
                        </section>

                        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl">
                            {error && (
                                <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
                                    {error}
                                </div>
                            )}

                            {loading ? (
                                <div className="p-8 text-center">
                                    <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-gray-600">Loading payments...</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b border-white/20 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                                                <TableHead className="font-semibold text-gray-700">Booking ID</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Customer ID</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Method</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Provider Ref</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                                                <TableHead className="text-right font-semibold text-gray-700">Action</TableHead>
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
                                                        <TableRow
                                                            key={payment.id}
                                                            className="border-b border-white/20 transition-all hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30"
                                                        >
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
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default PaymentPage;
