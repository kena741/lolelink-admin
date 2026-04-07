'use client';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSearchParams } from 'next/navigation';
import { fetchPayoutRequests, approvePayoutRequest, rejectPayoutRequest, sendPayoutViaChapa, PayoutRequest } from '@/features/payout/payoutSlice';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function PayoutRequestPageContent() {
    const dispatch = useAppDispatch();
    const searchParams = useSearchParams();
    const { requests, loading, error } = useAppSelector((state) => state.payout);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmingRequest, setConfirmingRequest] = useState<PayoutRequest | null>(null);
    const [modalValidationError, setModalValidationError] = useState<string | null>(null);
    const [debugRequestId, setDebugRequestId] = useState<string | null>(null);
    const [transferResult, setTransferResult] = useState<{
        message: string;
        txRef: string;
        transferId: string;
        sourceAccount: string;
        destinationProviderName: string;
        destinationBankName: string;
        destinationAccountNumber: string;
        amount: string;
    } | null>(null);
    const autoVerifyInFlightRef = useRef<Set<string>>(new Set());
    const autoVerifyLastAttemptMsRef = useRef<Record<string, number>>({});

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

    const handleSendWithChapa = async (request: PayoutRequest) => {
        setModalValidationError(null);
        setConfirmingRequest(request);
    };

    const handleConfirmSendWithChapa = async () => {
        if (!confirmingRequest) return;
        const request = confirmingRequest;
        const resolvedBankCode = (request.bankDetails?.bankCode || request.bankDetails?.swiftCode || '').trim();
        const missingFields = [
            !request.bankDetails?.holderName?.trim() ? 'Account Holder' : '',
            !request.bankDetails?.accountNumber?.trim() ? 'Account Number' : '',
            !request.bankDetails?.bankName?.trim() ? 'Bank Name' : '',
            !resolvedBankCode ? 'Bank Code (or SWIFT)' : '',
        ].filter(Boolean);
        if (missingFields.length > 0) {
            setModalValidationError(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        setConfirmingRequest(null);
        setModalValidationError(null);
        const id = request.id;
        setProcessingId(id);
        try {
            const result = await dispatch(sendPayoutViaChapa({ id })).unwrap();
            setTransferResult(result);
            dispatch(fetchPayoutRequests());
        } catch (err) {
            console.error('Failed to send payout via Chapa:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleVerifyChapaTransfer = async (withdrawalId: string) => {
        setProcessingId(withdrawalId);
        try {
            const response = await fetch('/api/payout/chapa-verify-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId }),
            });
            const payload = (await response.json()) as { error?: unknown; updatedPaymentStatus?: string };
            if (!response.ok) {
                window.alert(typeof payload.error === 'string' ? payload.error : 'Failed to verify transfer');
                return;
            }
            dispatch(fetchPayoutRequests());
        } catch (e) {
            console.error('Failed to verify transfer:', e);
        } finally {
            setProcessingId(null);
        }
    };

    const autoVerifyCandidateIds = useMemo(() => {
        return requests
            .filter((request) => {
                const status = (request.paymentStatus || '').toLowerCase();
                if (status !== 'approved') return false;
                const note = (request.adminNote || '').toLowerCase();
                return note.includes('reference=');
            })
            .map((request) => request.id);
    }, [requests]);

    useEffect(() => {
        const intervalMs = 15000;
        const perIdCooldownMs = 45000;
        const maxPerTick = 3;

        async function runAutoVerify(): Promise<void> {
            const now = Date.now();
            const candidates = autoVerifyCandidateIds
                .filter((id) => !autoVerifyInFlightRef.current.has(id))
                .filter((id) => {
                    const last = autoVerifyLastAttemptMsRef.current[id] || 0;
                    return now - last >= perIdCooldownMs;
                })
                .slice(0, maxPerTick);

            await Promise.all(
                candidates.map(async (id) => {
                    autoVerifyInFlightRef.current.add(id);
                    autoVerifyLastAttemptMsRef.current[id] = Date.now();
                    try {
                        const response = await fetch('/api/payout/chapa-verify-transfer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ withdrawalId: id }),
                        });
                        if (response.ok) dispatch(fetchPayoutRequests());
                    } catch (e) {
                        console.error('Auto-verify failed:', e);
                    } finally {
                        autoVerifyInFlightRef.current.delete(id);
                    }
                })
            );
        }

        void runAutoVerify();
        const timerId = window.setInterval(() => void runAutoVerify(), intervalMs);
        return () => window.clearInterval(timerId);
    }, [autoVerifyCandidateIds, dispatch]);

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

    const maskAccountNumber = (accountNumber?: string) => {
        if (!accountNumber) return 'Unknown Account';
        const normalized = accountNumber.trim();
        if (normalized.length <= 4) return normalized;
        return `${'*'.repeat(Math.max(normalized.length - 4, 2))}${normalized.slice(-4)}`;
    };

    const pendingRequests = requests.filter(r => r.paymentStatus === 'pending');
    const segment = (searchParams.get('segment') || '').trim().toLowerCase();
    const isToday = (value?: string) => {
        if (!value) return false;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return false;
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
    };
    const filteredRequests = requests.filter((request) => {
        const status = (request.paymentStatus || '').toLowerCase();
        const note = (request.adminNote || '').toLowerCase();
        if (segment === 'waiting_confirmation')
            return status === 'approved' && note.includes('reference=');
        if (segment === 'failed_rejected')
            return status === 'rejected';
        if (segment === 'missing_payment_method')
            return ['pending', 'approved'].includes(status) && !request.bankDetails;
        if (segment === 'completed_today')
            return status === 'completed' && isToday(request.paymentDate);
        return true;
    });
    const totalPendingAmount = filteredRequests
        .filter(r => r.paymentStatus === 'pending')
        .reduce((sum, r) => sum + getAmountAsNumber(r.amount), 0);
    const totalRequests = filteredRequests.length;
    const approvedRequests = filteredRequests.filter(r => r.paymentStatus === 'approved' || r.paymentStatus === 'completed').length;
    const debugRequest = debugRequestId ? requests.find((request) => request.id === debugRequestId) || null : null;
    const segmentLabel = segment === 'waiting_confirmation'
        ? 'Waiting Confirmation'
        : segment === 'failed_rejected'
            ? 'Failed / Rejected'
            : segment === 'missing_payment_method'
                ? 'Missing Payment Method'
                : segment === 'completed_today'
                    ? 'Completed Today'
                    : '';
    const exportAuditHref = segment
        ? `/api/payout/export-audit?segment=${encodeURIComponent(segment)}`
        : '/api/payout/export-audit';

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
                                <Link
                                    href={exportAuditHref}
                                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                >
                                    Export Audit CSV
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {segmentLabel && (
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                                <p className="text-sm font-semibold text-indigo-700">Active segment: {segmentLabel}</p>
                                <Link href="/admin/finance/payout-request" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                                    Clear filter
                                </Link>
                            </div>
                        )}
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

                        {debugRequest && (
                            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800">Bank Details Debug</p>
                                        <p className="text-xs text-amber-700">
                                            Request ID: {debugRequest.id} | Provider ID: {debugRequest.providerId}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setDebugRequestId(null)}
                                        className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                                    >
                                        Hide Debug
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">Holder Name</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.holderName || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">Bank Name</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.bankName || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">Account Number</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.accountNumber || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">Bank Code</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.bankCode || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">SWIFT</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.swiftCode || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="text-amber-700 font-medium">Branch</p>
                                        <p className="text-amber-900">
                                            {debugRequest.bankDetails?.branchCity || 'null'}
                                            {debugRequest.bankDetails?.branchCountry ? `, ${debugRequest.bankDetails.branchCountry}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <pre className="mt-4 overflow-x-auto rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-900">
                                    {JSON.stringify(debugRequest.bankDetails, null, 2)}
                                </pre>
                            </div>
                        )}

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
                                    {typeof error === 'string' ? error : 'Something went wrong'}
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
                                                <TableHead className="font-semibold text-gray-700">Bank Details</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Create Date</TableHead>
                                                <TableHead className="font-semibold text-gray-700 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRequests.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="px-4 py-12 text-center text-gray-500">
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
                                                filteredRequests.map((request) => {
                                                    const isProcessing = processingId === request.id;
                                                    const normalizedPaymentStatus = request.paymentStatus.toLowerCase();
                                                    const hasChapaTransferStarted = Boolean(
                                                        (request.adminNote || '').toLowerCase().includes('chapa transfer sent.') ||
                                                        (request.adminNote || '').toLowerCase().includes('chapa transfer reference:') ||
                                                        (request.adminNote || '').toLowerCase().includes('reference=')
                                                    );
                                                    const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
                                                        pending: { color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
                                                        approved: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                                                        completed: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                                                        rejected: { color: 'text-red-600', bg: 'bg-red-500/10', icon: XCircle },
                                                    };
                                                    const statusInfo = statusConfig[normalizedPaymentStatus] || statusConfig.pending;
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
                                                                    {normalizedPaymentStatus.charAt(0).toUpperCase() + normalizedPaymentStatus.slice(1)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-gray-700">
                                                                {request.bankDetails ? (
                                                                    <div className="space-y-0.5 text-xs">
                                                                        <p className="font-semibold text-gray-900">{request.bankDetails.bankName || 'Bank not set'}</p>
                                                                        <p>Acct: {request.bankDetails.accountNumber || '—'}</p>
                                                                        <p>Holder: {request.bankDetails.holderName || '—'}</p>
                                                                        <p>
                                                                            {request.bankDetails.branchCity || '—'}
                                                                            {request.bankDetails.branchCountry ? `, ${request.bankDetails.branchCountry}` : ''}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-gray-500">No bank details</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-semibold text-gray-900">
                                                                {formatCurrency(request.amount)}
                                                            </TableCell>
                                                            <TableCell className="text-gray-600">
                                                                {formatDate(request.createdDate)}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {normalizedPaymentStatus === 'pending' ? (
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
                                                                ) : normalizedPaymentStatus === 'approved' && !hasChapaTransferStarted ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => setDebugRequestId(request.id)}
                                                                            className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
                                                                        >
                                                                            Debug Bank
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSendWithChapa(request)}
                                                                            disabled={isProcessing}
                                                                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                        >
                                                                            {isProcessing ? 'Processing...' : 'Send with Chapa'}
                                                                        </button>
                                                                    </div>
                                                                ) : normalizedPaymentStatus === 'approved' && hasChapaTransferStarted ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleVerifyChapaTransfer(request.id)}
                                                                            disabled={isProcessing}
                                                                            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {isProcessing ? 'Verifying...' : 'Verify status'}
                                                                        </button>
                                                                        <span className="text-sm text-gray-500 italic">Waiting confirmation</span>
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
                        {confirmingRequest && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
                                    <h3 className="text-xl font-bold text-gray-900">Confirm Chapa Transfer</h3>
                                    <p className="mt-2 text-sm text-gray-600">
                                        Review payout details before sending money to the provider bank account.
                                    </p>
                                    <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">From</span>
                                            <span className="font-semibold text-gray-900">Platform Chapa Account</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">To Provider</span>
                                            <span className="font-semibold text-gray-900">
                                                {confirmingRequest.provider_name || 'Unknown Provider'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Beneficiary Name</span>
                                            <span className="font-semibold text-gray-900">
                                                {confirmingRequest.bankDetails?.holderName || 'Unknown Holder'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Bank</span>
                                            <span className="font-semibold text-gray-900">
                                                {confirmingRequest.bankDetails?.bankName || 'Unknown Bank'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Account</span>
                                            <span className="font-semibold text-gray-900">
                                                {maskAccountNumber(confirmingRequest.bankDetails?.accountNumber)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Account Holder</span>
                                            <span className="font-semibold text-gray-900">
                                                {confirmingRequest.bankDetails?.holderName || 'Unknown Holder'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Bank Code / SWIFT</span>
                                            <span className="font-semibold text-gray-900">
                                                {confirmingRequest.bankDetails?.bankCode || confirmingRequest.bankDetails?.swiftCode || 'Missing'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Amount</span>
                                            <span className="font-semibold text-gray-900">
                                                {formatCurrency(confirmingRequest.amount)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Requested Date</span>
                                            <span className="font-semibold text-gray-900">
                                                {formatDate(confirmingRequest.createdDate)}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-medium text-gray-600">Request Note</p>
                                            <p className="mt-1 text-gray-900">{confirmingRequest.note || '—'}</p>
                                        </div>
                                    </div>
                                    {modalValidationError && (
                                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                            {modalValidationError}
                                        </div>
                                    )}
                                    <div className="mt-6 flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setConfirmingRequest(null);
                                                setModalValidationError(null);
                                            }}
                                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSendWithChapa}
                                            className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                                        >
                                            Confirm Transfer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {transferResult && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Transfer Submitted</h3>
                                            <p className="mt-2 text-sm text-gray-600">{transferResult.message}</p>
                                        </div>
                                        <button
                                            onClick={() => setTransferResult(null)}
                                            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>

                                    <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">From</span>
                                            <span className="font-semibold text-gray-900">{transferResult.sourceAccount}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">To</span>
                                            <span className="font-semibold text-gray-900">
                                                {transferResult.destinationProviderName}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Bank</span>
                                            <span className="font-semibold text-gray-900">
                                                {transferResult.destinationBankName || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Account</span>
                                            <span className="font-semibold text-gray-900">
                                                {transferResult.destinationAccountNumber || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Amount</span>
                                            <span className="font-semibold text-gray-900">
                                                {transferResult.amount ? `ETB ${transferResult.amount}` : '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Reference</span>
                                            <span className="font-semibold text-gray-900">{transferResult.txRef || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-gray-600">Transfer ID</span>
                                            <span className="font-semibold text-gray-900">{transferResult.transferId || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}

const PayoutRequestPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <PayoutRequestPageContent />
        </Suspense>
    );
};

export default PayoutRequestPage;

