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
import { AdminDataTableEmpty, AdminPersonCell, AdminStatusBadge, AdminTableShell } from '@/components/admin/data-table';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchPayoutRequests, approvePayoutRequest, rejectPayoutRequest, sendPayoutViaChapa, PayoutRequest } from '@/features/payout/payoutSlice';
import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';
import { PayoutWalletAnalysisSheet } from '@/app/admin/finance/payout-request/PayoutWalletAnalysisSheet';
import { PayoutRequestActions } from '@/app/admin/finance/payout-request/PayoutRequestActions';
import {
    getPayoutStatusLabel,
    maskAccountNumber,
    sanitizeDisplayText,
} from '@/app/admin/finance/payout-request/payout-request-display';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
            if (walletAnalysisRequest?.id === id) {
                handleCloseWalletAnalysis();
            }
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
            if (walletAnalysisRequest?.id === id) {
                handleCloseWalletAnalysis();
            }
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

    const formatCurrency = (amount: string | number) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
        return `ETB ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getAmountAsNumber = (amount: string | number): number => {
        return typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
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
            <AdminShell wide>
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
                        <section className="mb-6 grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
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

                        {loading ? <AdminLoadingRow label="Loading payout requests…" /> : null}
                        {error ? <AdminErrorAlert message={typeof error === 'string' ? error : 'Something went wrong'} /> : null}

                        <AdminTableShell className="w-full min-w-0 overflow-x-auto">
                            {!loading && !error ? (
                                <div className="w-full min-w-0">
                                    <p className="border-b border-gray-100 bg-gray-50/80 px-4 py-2.5 text-xs text-gray-600">
                                        Click a row for wallet analysis. Approve, reject, or send from the Actions column or the sheet footer.
                                    </p>
                                    <table className="w-full table-fixed border-collapse text-left">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[18%]">Provider</TableHead>
                                                <TableHead className="w-[8%]">Note</TableHead>
                                                <TableHead className="w-[9%]">Status</TableHead>
                                                <TableHead className="w-[14%]">Bank details</TableHead>
                                                <TableHead className="w-[10%] text-right">Amount</TableHead>
                                                <TableHead className="w-[14%]">Requested</TableHead>
                                                <TableHead className="w-[17%] px-3 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRequests.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="p-0">
                                                        <AdminDataTableEmpty
                                                            title="No payout requests found"
                                                            description="All requests in this view have been processed."
                                                        />
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
                                                    const providerName = sanitizeDisplayText(
                                                        request.provider_name,
                                                        'Unknown provider'
                                                    );

                                                    return (
                                                        <TableRow
                                                            key={request.id}
                                                            className="group cursor-pointer align-top"
                                                            onClick={() => handleOpenWalletAnalysis(request)}
                                                        >
                                                            <TableCell>
                                                                {request.providerId ? (
                                                                    <Link
                                                                        href={`/admin/providers/${request.providerId}`}
                                                                        className="block min-w-0"
                                                                        onClick={(event) => event.stopPropagation()}
                                                                    >
                                                                        <AdminPersonCell
                                                                            name={providerName}
                                                                            meta={request.providerId.slice(0, 8)}
                                                                        />
                                                                    </Link>
                                                                ) : (
                                                                    <AdminPersonCell name={providerName} />
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                                                                    {request.note?.trim() || 'Withdrawal'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    const statusDisplay = getPayoutStatusLabel(
                                                                        normalizedPaymentStatus,
                                                                        hasChapaTransferStarted
                                                                    );
                                                                    return (
                                                                        <AdminStatusBadge tone={statusDisplay.tone}>
                                                                            {statusDisplay.label}
                                                                        </AdminStatusBadge>
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>
                                                                {request.bankDetails ? (
                                                                    <div className="min-w-0 text-xs leading-relaxed">
                                                                        <p className="truncate font-semibold text-gray-900">
                                                                            {request.bankDetails.bankName || 'Bank not set'}
                                                                        </p>
                                                                        <p className="font-mono text-gray-600">
                                                                            {maskAccountNumber(request.bankDetails.accountNumber)}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <AdminStatusBadge tone="danger">Missing bank</AdminStatusBadge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold tabular-nums text-gray-900">
                                                                {formatCurrency(request.amount)}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-600">
                                                                {formatAdminDateTimeUtc(request.createdDate)}
                                                            </TableCell>
                                                            <TableCell
                                                                className="px-3 align-top text-right"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                <PayoutRequestActions
                                                                    paymentStatus={normalizedPaymentStatus}
                                                                    hasChapaTransferStarted={hasChapaTransferStarted}
                                                                    isProcessing={isProcessing}
                                                                    onApprove={() => handleApprove(request.id)}
                                                                    onReject={() => handleReject(request.id)}
                                                                    onSendWithChapa={() => handleSendWithChapa(request)}
                                                                    onVerifyTransfer={() => handleVerifyChapaTransfer(request.id)}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </table>
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
                            requestId={walletAnalysisRequest?.id}
                            bankDetails={walletAnalysisRequest?.bankDetails}
                            paymentStatus={walletAnalysisRequest?.paymentStatus}
                            hasChapaTransferStarted={
                                walletAnalysisRequest
                                    ? Boolean(
                                          (walletAnalysisRequest.adminNote || '')
                                              .toLowerCase()
                                              .includes('chapa transfer sent.') ||
                                              (walletAnalysisRequest.adminNote || '')
                                                  .toLowerCase()
                                                  .includes('chapa transfer reference:') ||
                                              (walletAnalysisRequest.adminNote || '')
                                                  .toLowerCase()
                                                  .includes('reference=')
                                      )
                                    : false
                            }
                            isProcessing={walletAnalysisRequest ? processingId === walletAnalysisRequest.id : false}
                            onApprove={
                                walletAnalysisRequest
                                    ? () => handleApprove(walletAnalysisRequest.id)
                                    : undefined
                            }
                            onReject={
                                walletAnalysisRequest
                                    ? () => handleReject(walletAnalysisRequest.id)
                                    : undefined
                            }
                            onSend={
                                walletAnalysisRequest
                                    ? () => handleSendWithChapa(walletAnalysisRequest)
                                    : undefined
                            }
                            onVerifyTransfer={
                                walletAnalysisRequest
                                    ? () => handleVerifyChapaTransfer(walletAnalysisRequest.id)
                                    : undefined
                            }
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
                                                {formatAdminDateTimeUtc(confirmingRequest.createdDate)}
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
