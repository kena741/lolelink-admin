'use client';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { AdminTableShell } from '@/components/admin/data-table';
import {
    DollarSign,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchPayoutRequests, approvePayoutRequest, rejectPayoutRequest, sendPayoutViaChapa, PayoutRequest } from '@/features/payout/payoutSlice';
import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';
import { PayoutWalletAnalysisSheet } from '@/app/admin/finance/payout-request/PayoutWalletAnalysisSheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const primaryButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const destructiveButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const secondaryButtonClassName =
    'inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function PayoutRequestPageContent() {
    const dispatch = useAppDispatch();
    const searchParams = useSearchParams();
    const { requests, loading, error } = useAppSelector((state) => state.payout);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmingRequest, setConfirmingRequest] = useState<PayoutRequest | null>(null);
    const [modalValidationError, setModalValidationError] = useState<string | null>(null);
    const [debugRequestId, setDebugRequestId] = useState<string | null>(null);
    const [walletAnalysisRequest, setWalletAnalysisRequest] = useState<PayoutRequest | null>(null);
    const [walletAnalysis, setWalletAnalysis] = useState<ProviderPayoutAnalysis | null>(null);
    const [walletAnalysisLoading, setWalletAnalysisLoading] = useState(false);
    const [walletAnalysisError, setWalletAnalysisError] = useState<string | null>(null);
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

    const handleOpenWalletAnalysis = async (request: PayoutRequest) => {
        if (!request.providerId) {
            setWalletAnalysisError('Provider is missing on this payout request.');
            setWalletAnalysisRequest(request);
            setWalletAnalysis(null);
            return;
        }

        setWalletAnalysisRequest(request);
        setWalletAnalysis(null);
        setWalletAnalysisError(null);
        setWalletAnalysisLoading(true);

        try {
            const params = new URLSearchParams({
                providerId: request.providerId,
                withdrawalId: request.id,
            });
            const response = await fetch(`/api/payout/provider-wallet-analysis?${params.toString()}`);
            const payload = (await response.json()) as {
                data?: ProviderPayoutAnalysis;
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to analyze provider wallet');
            }
            setWalletAnalysis(payload.data ?? null);
        } catch (error: unknown) {
            setWalletAnalysisError(error instanceof Error ? error.message : 'Failed to analyze provider wallet');
        } finally {
            setWalletAnalysisLoading(false);
        }
    };

    const handleCloseWalletAnalysis = () => {
        setWalletAnalysisRequest(null);
        setWalletAnalysis(null);
        setWalletAnalysisError(null);
        setWalletAnalysisLoading(false);
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
            <AdminShell>
                        <AdminPageHeader
                            title="Payout Request"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Payout Request' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchPayoutRequests())}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    <Link
                                        href={exportAuditHref}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        Export Audit CSV
                                    </Link>
                                </>
                            }
                        />
                        {segmentLabel && (
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
                                <p className="text-sm font-semibold text-text-primary">Active segment: {segmentLabel}</p>
                                <Link href="/admin/finance/payout-request" className="text-sm font-semibold text-primary transition-colors hover:text-accent">
                                    Clear filter
                                </Link>
                            </div>
                        )}
                        <section className="mb-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                            <AdminStatCard
                                title="Pending Requests"
                                value={loading ? '…' : String(pendingRequests.length)}
                            />
                            <AdminStatCard
                                title="Pending Amount"
                                value={loading ? '…' : formatCurrency(totalPendingAmount)}
                            />
                            <AdminStatCard
                                title="Approved"
                                value={loading ? '…' : String(approvedRequests)}
                            />
                            <AdminStatCard
                                title="Total Requests"
                                value={loading ? '…' : String(totalRequests)}
                            />
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
                                        className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                                    >
                                        Hide Debug
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">Holder Name</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.holderName || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">Bank Name</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.bankName || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">Account Number</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.accountNumber || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">Bank Code</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.bankCode || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">SWIFT</p>
                                        <p className="text-amber-900">{debugRequest.bankDetails?.swiftCode || 'null'}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                        <p className="font-medium text-amber-700">Branch</p>
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

                        {loading ? <AdminLoadingRow label="Loading payout requests…" /> : null}
                        {error ? <AdminErrorAlert message={typeof error === 'string' ? error : 'Something went wrong'} /> : null}

                        <AdminTableShell>
                            {!loading && !error ? (
                                <div className="overflow-x-auto">
                                    <p className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
                                        Click a row to run wallet analysis for that provider before approving payout.
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Provider Name</TableHead>
                                                <TableHead>Note</TableHead>
                                                <TableHead>Payment Status</TableHead>
                                                <TableHead>Bank Details</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Create Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRequests.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
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
                                                        rejected: { color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
                                                    };
                                                    const statusInfo = statusConfig[normalizedPaymentStatus] || statusConfig.pending;
                                                    const StatusIcon = statusInfo.icon;

                                                    return (
                                                        <TableRow
                                                            key={request.id}
                                                            className="cursor-pointer"
                                                            onClick={() => handleOpenWalletAnalysis(request)}
                                                        >
                                                            <TableCell className="font-medium text-text-primary">
                                                                {request.providerId ? (
                                                                    <Link
                                                                        href={`/admin/providers/${request.providerId}`}
                                                                        className="font-semibold text-primary transition-colors hover:text-accent hover:underline"
                                                                    >
                                                                        {request.provider_name || 'Unknown Provider'}
                                                                    </Link>
                                                                ) : (
                                                                    <span>{request.provider_name || 'Unknown Provider'}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-text-secondary">
                                                                {request.note || '—'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center gap-2 rounded-full border border-current/20 px-3 py-1.5 text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                                    {normalizedPaymentStatus.charAt(0).toUpperCase() + normalizedPaymentStatus.slice(1)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-text-secondary">
                                                                {request.bankDetails ? (
                                                                    <div className="space-y-0.5 text-xs">
                                                                        <p className="font-semibold text-text-primary">{request.bankDetails.bankName || 'Bank not set'}</p>
                                                                        <p>Acct: {request.bankDetails.accountNumber || '—'}</p>
                                                                        <p>Holder: {request.bankDetails.holderName || '—'}</p>
                                                                        <p>
                                                                            {request.bankDetails.branchCity || '—'}
                                                                            {request.bankDetails.branchCountry ? `, ${request.bankDetails.branchCountry}` : ''}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">No bank details</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-semibold text-text-primary">
                                                                {formatCurrency(request.amount)}
                                                            </TableCell>
                                                            <TableCell className="text-text-secondary">
                                                                {formatDate(request.createdDate)}
                                                            </TableCell>
                                                            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                                                {normalizedPaymentStatus === 'pending' ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleApprove(request.id)}
                                                                            disabled={isProcessing}
                                                                            className={primaryButtonClassName}
                                                                        >
                                                                            {isProcessing ? 'Processing...' : 'Allow'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleReject(request.id)}
                                                                            disabled={isProcessing}
                                                                            className={destructiveButtonClassName}
                                                                        >
                                                                            Reject
                                                                        </button>
                                                                    </div>
                                                                ) : normalizedPaymentStatus === 'approved' && !hasChapaTransferStarted ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => setDebugRequestId(request.id)}
                                                                            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                                                                        >
                                                                            Debug Bank
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSendWithChapa(request)}
                                                                            disabled={isProcessing}
                                                                            className={primaryButtonClassName}
                                                                        >
                                                                            {isProcessing ? 'Processing...' : 'Send with Chapa'}
                                                                        </button>
                                                                    </div>
                                                                ) : normalizedPaymentStatus === 'approved' && hasChapaTransferStarted ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleVerifyChapaTransfer(request.id)}
                                                                            disabled={isProcessing}
                                                                            className={secondaryButtonClassName}
                                                                        >
                                                                            {isProcessing ? 'Verifying...' : 'Verify status'}
                                                                        </button>
                                                                        <span className="text-sm italic text-text-secondary">Waiting confirmation</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm italic text-text-secondary">Processed</span>
                                                                )}
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
                        <PayoutWalletAnalysisSheet
                            open={walletAnalysisRequest !== null}
                            onClose={handleCloseWalletAnalysis}
                            loading={walletAnalysisLoading}
                            error={walletAnalysisError}
                            analysis={walletAnalysis}
                            withdrawalAmount={walletAnalysisRequest?.amount}
                        />
                        {confirmingRequest && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                                    <h3 className="font-heading text-xl font-bold text-text-primary">Confirm Chapa Transfer</h3>
                                    <p className="mt-2 text-sm text-text-secondary">
                                        Review payout details before sending money to the provider bank account.
                                    </p>
                                    <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted p-4">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">From</span>
                                            <span className="font-semibold text-text-primary">Platform Chapa Account</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">To Provider</span>
                                            <span className="font-semibold text-text-primary">
                                                {confirmingRequest.provider_name || 'Unknown Provider'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Beneficiary Name</span>
                                            <span className="font-semibold text-text-primary">
                                                {confirmingRequest.bankDetails?.holderName || 'Unknown Holder'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Bank</span>
                                            <span className="font-semibold text-text-primary">
                                                {confirmingRequest.bankDetails?.bankName || 'Unknown Bank'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Account</span>
                                            <span className="font-semibold text-text-primary">
                                                {maskAccountNumber(confirmingRequest.bankDetails?.accountNumber)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Account Holder</span>
                                            <span className="font-semibold text-text-primary">
                                                {confirmingRequest.bankDetails?.holderName || 'Unknown Holder'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Bank Code / SWIFT</span>
                                            <span className="font-semibold text-text-primary">
                                                {confirmingRequest.bankDetails?.bankCode || confirmingRequest.bankDetails?.swiftCode || 'Missing'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Amount</span>
                                            <span className="font-semibold text-text-primary">
                                                {formatCurrency(confirmingRequest.amount)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Requested Date</span>
                                            <span className="font-semibold text-text-primary">
                                                {formatDate(confirmingRequest.createdDate)}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-medium text-text-secondary">Request Note</p>
                                            <p className="mt-1 text-text-primary">{confirmingRequest.note || '—'}</p>
                                        </div>
                                    </div>
                                    {modalValidationError && (
                                        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                                            {modalValidationError}
                                        </div>
                                    )}
                                    <div className="mt-6 flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setConfirmingRequest(null);
                                                setModalValidationError(null);
                                            }}
                                            className={secondaryButtonClassName}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSendWithChapa}
                                            className={primaryButtonClassName}
                                        >
                                            Confirm Transfer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {transferResult && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-heading text-xl font-bold text-text-primary">Transfer Submitted</h3>
                                            <p className="mt-2 text-sm text-text-secondary">{transferResult.message}</p>
                                        </div>
                                        <button
                                            onClick={() => setTransferResult(null)}
                                            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-muted"
                                        >
                                            Close
                                        </button>
                                    </div>

                                    <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted p-4">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">From</span>
                                            <span className="font-semibold text-text-primary">{transferResult.sourceAccount}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">To</span>
                                            <span className="font-semibold text-text-primary">
                                                {transferResult.destinationProviderName}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Bank</span>
                                            <span className="font-semibold text-text-primary">
                                                {transferResult.destinationBankName || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Account</span>
                                            <span className="font-semibold text-text-primary">
                                                {transferResult.destinationAccountNumber || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Amount</span>
                                            <span className="font-semibold text-text-primary">
                                                {transferResult.amount ? `ETB ${transferResult.amount}` : '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Reference</span>
                                            <span className="font-semibold text-text-primary">{transferResult.txRef || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Transfer ID</span>
                                            <span className="font-semibold text-text-primary">{transferResult.transferId || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
            </AdminShell>
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
