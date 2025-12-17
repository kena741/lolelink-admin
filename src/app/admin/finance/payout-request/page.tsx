'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    DollarSign, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    ArrowLeft,
    RefreshCw,
    TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { fetchPayoutRequests, approvePayoutRequest, rejectPayoutRequest } from '@/features/payout/payoutSlice';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PayoutRequestPage = () => {
    const dispatch = useAppDispatch();
    const { requests, loading, error } = useAppSelector((state) => state.payout);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchPayoutRequests());
    }, [dispatch]);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await dispatch(approvePayoutRequest({ id })).unwrap();
            dispatch(fetchPayoutRequests());
        } catch (err) {
            console.error('Failed to approve payout:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            await dispatch(rejectPayoutRequest({ id })).unwrap();
            dispatch(fetchPayoutRequests());
        } catch (err) {
            console.error('Failed to reject payout:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    };

    const formatCurrency = (amount: string | number) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
        return `ETB ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getAmountAsNumber = (amount: string | number): number => {
        return typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    };

    const pendingRequests = requests.filter(r => r.paymentStatus === 'pending');
    const totalPendingAmount = pendingRequests.reduce((sum, r) => sum + getAmountAsNumber(r.amount), 0);
    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.paymentStatus === 'approved' || r.paymentStatus === 'completed').length;

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
                                        <Link 
                                            href="/admin/dashboard"
                                            className="p-2 bg-white/20 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-white" />
                                        </Link>
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <DollarSign className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Payout Request
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Payout Request</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dispatch(fetchPayoutRequests())}
                                    className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Statistics Cards */}
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                                            <Clock className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Pending Requests</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : pendingRequests.length}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                                            <DollarSign className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Pending Amount</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : formatCurrency(totalPendingAmount)}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                                            <CheckCircle2 className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Approved</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : approvedRequests}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-fuchsia-500 to-rose-600 rounded-xl shadow-lg">
                                            <TrendingUp className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Total Requests</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : totalRequests}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Payout Requests Table */}
                        <div className="rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                            {loading && (
                                <div className="p-8 text-center">
                                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                    <p className="text-gray-600">Loading payout requests...</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-4 m-6 rounded-xl bg-red-50 border border-red-200 text-red-600">
                                    {error}
                                </div>
                            )}

                            {!loading && !error && (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20">
                                                <TableHead className="font-semibold text-gray-700">Provider Name</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Note</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Payment Status</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Create Date</TableHead>
                                                <TableHead className="font-semibold text-gray-700 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {requests.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                                                <DollarSign className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-gray-900">No payout requests found</p>
                                                            <p className="text-sm text-gray-600">All requests have been processed</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                requests.map((request) => {
                                                    const isProcessing = processingId === request.id;
                                                    const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
                                                        pending: { color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
                                                        approved: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                                                        completed: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                                                        rejected: { color: 'text-red-600', bg: 'bg-red-500/10', icon: XCircle },
                                                    };
                                                    const statusInfo = statusConfig[request.paymentStatus] || statusConfig.pending;
                                                    const StatusIcon = statusInfo.icon;

                                                    return (
                                                        <TableRow 
                                                            key={request.id} 
                                                            className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20"
                                                        >
                                                            <TableCell className="font-medium text-gray-900">
                                                                {request.providerId ? (
                                                                    <Link 
                                                                        href={`/admin/providers/${request.providerId}`}
                                                                        className="text-indigo-700 hover:text-indigo-900 hover:underline font-semibold transition-colors"
                                                                    >
                                                                        {request.provider_name || 'Unknown Provider'}
                                                                    </Link>
                                                                ) : (
                                                                    <span>{request.provider_name || 'Unknown Provider'}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-gray-700">
                                                                {request.note || '—'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.color} border border-current/20`}>
                                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                                    {request.paymentStatus.charAt(0).toUpperCase() + request.paymentStatus.slice(1)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="font-semibold text-gray-900">
                                                                {formatCurrency(request.amount)}
                                                            </TableCell>
                                                            <TableCell className="text-gray-600">
                                                                {formatDate(request.createdDate)}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {request.paymentStatus === 'pending' ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleApprove(request.id)}
                                                                            disabled={isProcessing}
                                                                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                        >
                                                                            {isProcessing ? 'Processing...' : 'Allow'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleReject(request.id)}
                                                                            disabled={isProcessing}
                                                                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                        >
                                                                            Reject
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm text-gray-500 italic">Processed</span>
                                                                )}
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

export default PayoutRequestPage;

