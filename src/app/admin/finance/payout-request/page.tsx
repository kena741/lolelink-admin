'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminSegmentedControl,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { AdminDataTableEmpty, AdminPersonCell, AdminStatusBadge, AdminTableShell } from '@/components/admin/data-table';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchPayoutRequests, approvePayoutRequest, rejectPayoutRequest, sendPayoutViaChapa, PayoutRequest } from '@/features/payout/payoutSlice';
import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';
import { PayoutWalletAnalysisSheet } from '@/app/admin/finance/payout-request/PayoutWalletAnalysisSheet';
import { PayoutRiskReviewModal } from '@/app/admin/finance/payout-request/PayoutRiskReviewModal';
import { PayoutRejectModal } from '@/app/admin/finance/payout-request/PayoutRejectModal';
import { PayoutRequestActions } from '@/app/admin/finance/payout-request/PayoutRequestActions';
import { requiresPayoutRiskReview, type PayoutRiskReviewAction } from '@/lib/payout-risk-review';
import {
    getPayoutStatusLabel,
    maskAccountNumber,
    sanitizeDisplayText,
} from '@/app/admin/finance/payout-request/payout-request-display';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import {
    dashboardRangeLabel,
    isDateInDashboardRange,
    parseDashboardRange,
    type DashboardRange,
} from '@/lib/dashboard-range';
import { isMissingPaymentMethodPayout } from '@/lib/payout-missing-payment-method';
import { calculateWithdrawalPayoutBreakdown } from '@/lib/withdrawal-payout';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminListPagination } from '@/components/admin/AdminListPagination';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';

type PayoutStatusFilter = 'all' | 'pending' | 'approved' | 'completed' | 'rejected';

const DATE_FILTER_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Week' },
    { value: '30d', label: 'Month' },
];

const STATUS_FILTER_OPTIONS: Array<{ value: PayoutStatusFilter; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
];

const primaryButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const secondaryButtonClassName =
    'inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function PayoutRequestPageContent() {
    const dispatch = useAppDispatch();
    const searchParams = useSearchParams();
    const { canWriteFinance } = useAdminPermissions();
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
        chapaFee?: string;
        netTransferAmount?: string;
    } | null>(null);
    const [riskReview, setRiskReview] = useState<{
        request: PayoutRequest;
        analysis: ProviderPayoutAnalysis;
        action: PayoutRiskReviewAction;
    } | null>(null);
    const [rejectingRequest, setRejectingRequest] = useState<PayoutRequest | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('all');
    const [dateFilter, setDateFilter] = useState<DashboardRange>('all');
    const autoVerifyInFlightRef = useRef<Set<string>>(new Set());
    const autoVerifyLastAttemptMsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        if (!shouldRefetchAdminList('payouts', { hasRows: requests.length > 0 })) return;
        void dispatch(fetchPayoutRequests()).then((action) => {
            if (fetchPayoutRequests.fulfilled.match(action)) markAdminListFetched('payouts');
        });
    }, [dispatch, requests.length]);

    useEffect(() => {
        const urlRange = parseDashboardRange(searchParams.get('range'));
        if (urlRange) setDateFilter(urlRange);
    }, [searchParams]);

    const fetchAnalysisForRequest = useCallback(async (request: PayoutRequest): Promise<ProviderPayoutAnalysis | null> => {
        if (!request.providerId) return null;

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
        return payload.data ?? null;
    }, []);

    const loadWalletAnalysis = useCallback(async (request: PayoutRequest) => {
        if (!request.providerId) {
            setWalletAnalysisError('Provider is missing on this payout request.');
            setWalletAnalysis(null);
            return;
        }

        setWalletAnalysisError(null);
        setWalletAnalysisLoading(true);

        try {
            const analysis = await fetchAnalysisForRequest(request);
            setWalletAnalysis(analysis);
        } catch (error: unknown) {
            setWalletAnalysisError(error instanceof Error ? error.message : 'Failed to analyze provider wallet');
        } finally {
            setWalletAnalysisLoading(false);
        }
    }, [fetchAnalysisForRequest]);

    useEffect(() => {
        if (!walletAnalysisRequest) return;
        const latest = requests.find((request) => request.id === walletAnalysisRequest.id);
        if (!latest) return;
        const statusChanged = latest.paymentStatus !== walletAnalysisRequest.paymentStatus;
        const noteChanged = latest.adminNote !== walletAnalysisRequest.adminNote;
        const dateChanged = latest.paymentDate !== walletAnalysisRequest.paymentDate;
        if (!statusChanged && !noteChanged && !dateChanged) return;
        setWalletAnalysisRequest(latest);
        void loadWalletAnalysis(latest);
    }, [requests, walletAnalysisRequest, loadWalletAnalysis]);

    async function resolveWalletAnalysis(request: PayoutRequest): Promise<ProviderPayoutAnalysis | null> {
        if (walletAnalysisRequest?.id === request.id && walletAnalysis) {
            return walletAnalysis;
        }
        return fetchAnalysisForRequest(request);
    }

    async function executeApprove(id: string) {
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
    }

    function openChapaConfirm(request: PayoutRequest) {
        setModalValidationError(null);
        setConfirmingRequest(request);
    }

    async function completePayoutAction(request: PayoutRequest, action: PayoutRiskReviewAction) {
        if (action === 'approve') {
            await executeApprove(request.id);
            return;
        }
        openChapaConfirm(request);
    }

    async function beginPayoutAction(request: PayoutRequest, action: PayoutRiskReviewAction) {
        if (!canWriteFinance) return;
        setProcessingId(request.id);
        try {
            const analysis = await resolveWalletAnalysis(request);
            if (!analysis) {
                window.alert('Wallet analysis is required before this action.');
                return;
            }

            if (walletAnalysisRequest?.id === request.id) {
                setWalletAnalysis(analysis);
            }

            if (requiresPayoutRiskReview(analysis)) {
                setRiskReview({ request, analysis, action });
                return;
            }

            await completePayoutAction(request, action);
        } catch (error: unknown) {
            console.error('Failed to prepare payout action:', error);
            window.alert(error instanceof Error ? error.message : 'Failed to load wallet analysis');
        } finally {
            setProcessingId(null);
        }
    }

    async function handleRiskReviewConfirm() {
        if (!riskReview) return;
        const { request, action } = riskReview;
        setRiskReview(null);
        await completePayoutAction(request, action);
    }

    const handleApprove = async (request: PayoutRequest) => {
        await beginPayoutAction(request, 'approve');
    };

    const handleSendWithChapa = async (request: PayoutRequest) => {
        await beginPayoutAction(request, 'send');
    };

    const handleReject = (request: PayoutRequest) => {
        if (!canWriteFinance) return;
        setRejectingRequest(request);
    };

    const handleConfirmReject = async (rejectionReason: string) => {
        if (!canWriteFinance || !rejectingRequest) return;
        const id = rejectingRequest.id;
        setProcessingId(id);
        try {
            await dispatch(rejectPayoutRequest({ id, rejectionReason })).unwrap();
            setRejectingRequest(null);
            dispatch(fetchPayoutRequests());
            if (walletAnalysisRequest?.id === id) {
                handleCloseWalletAnalysis();
            }
        } catch (err) {
            console.error('Failed to reject payout:', err);
            window.alert(err instanceof Error ? err.message : 'Failed to reject payout');
        } finally {
            setProcessingId(null);
        }
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
        if (!canWriteFinance) return;
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
            await dispatch(fetchPayoutRequests()).unwrap();
        } catch (e) {
            console.error('Failed to verify transfer:', e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleOpenWalletAnalysis = async (request: PayoutRequest) => {
        setWalletAnalysisRequest(request);
        setWalletAnalysis(null);
        await loadWalletAnalysis(request);
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
        if (!canWriteFinance) return;

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
    }, [autoVerifyCandidateIds, canWriteFinance, dispatch]);

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
        const dateRef = request.paymentDate || request.createdDate;
        const inRange = isDateInDashboardRange(dateRef, dateFilter);

        if (segment === 'waiting_confirmation')
            return status === 'approved' && note.includes('reference=') && inRange;
        if (segment === 'failed_rejected')
            return status === 'rejected' && inRange;
        if (segment === 'missing_payment_method')
            return isMissingPaymentMethodPayout(request.paymentStatus, request.bankDetails) && inRange;
        if (segment === 'completed_today')
            return status === 'completed' && isToday(request.paymentDate);

        if (statusFilter !== 'all' && status !== statusFilter) return false;
        return inRange;
    });
    useEffect(() => {
        setCurrentPage(1);
    }, [segment, dateFilter, statusFilter, pageSize]);
    const totalPages = filteredRequests.length > 0 ? Math.ceil(filteredRequests.length / pageSize) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginatedRequests = filteredRequests.slice(startIdx, startIdx + pageSize);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
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
    const exportParams = new URLSearchParams();
    if (segment) exportParams.set('segment', segment);
    if (dateFilter !== 'all') exportParams.set('range', dateFilter);
    const exportAuditHref = exportParams.toString()
        ? `/api/payout/export-audit?${exportParams.toString()}`
        : '/api/payout/export-audit';

    return (
        <>
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
                                <p className="text-sm font-semibold text-text-primary">
                                    Active segment: {segmentLabel}
                                    {dateFilter !== 'all' ? ` · ${dashboardRangeLabel(dateFilter)}` : ''}
                                </p>
                                <Link href="/admin/finance/payout-request" className="text-sm font-semibold text-primary transition-colors hover:text-accent">
                                    Clear filter
                                </Link>
                            </div>
                        )}
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
                                    <span className="tabular-nums text-gray-900">{filteredRequests.length}</span>
                                    <span className="mx-1 text-gray-300">/</span>
                                    <span className="tabular-nums">{requests.length}</span>
                                </p>
                                {(statusFilter !== 'all' || dateFilter !== 'all') && !segmentLabel ? (
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
                                        {canWriteFinance
                                            ? 'Click a row for wallet analysis. Approve, reject, or send from the Actions column or the sheet footer.'
                                            : 'Click a row for wallet analysis. Viewers cannot approve or reject withdrawals.'}
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
                                                paginatedRequests.map((request) => {
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
                                                                <div className="mb-2 flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenWalletAnalysis(request)}
                                                                        className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                                    >
                                                                        Review
                                                                    </button>
                                                                </div>
                                                                {canWriteFinance ? (
                                                                    <PayoutRequestActions
                                                                        paymentStatus={normalizedPaymentStatus}
                                                                        hasChapaTransferStarted={hasChapaTransferStarted}
                                                                        isProcessing={isProcessing}
                                                                        onApprove={() => handleApprove(request)}
                                                                        onReject={() => handleReject(request)}
                                                                        onSendWithChapa={() => handleSendWithChapa(request)}
                                                                        onVerifyTransfer={() => handleVerifyChapaTransfer(request.id)}
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">—</span>
                                                                )}
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

                        <AdminListPagination
                            page={safePage}
                            pageSize={pageSize}
                            totalItems={filteredRequests.length}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />

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
                            paymentDate={walletAnalysisRequest?.paymentDate}
                            rejectionReason={walletAnalysisRequest?.rejectionReason}
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
                                canWriteFinance && walletAnalysisRequest
                                    ? () => handleApprove(walletAnalysisRequest)
                                    : undefined
                            }
                            onReject={
                                canWriteFinance && walletAnalysisRequest
                                    ? () => handleReject(walletAnalysisRequest)
                                    : undefined
                            }
                            onSend={
                                canWriteFinance && walletAnalysisRequest
                                    ? () => handleSendWithChapa(walletAnalysisRequest)
                                    : undefined
                            }
                            onVerifyTransfer={
                                canWriteFinance && walletAnalysisRequest
                                    ? () => handleVerifyChapaTransfer(walletAnalysisRequest.id)
                                    : undefined
                            }
                        />
                        {riskReview ? (
                            <PayoutRiskReviewModal
                                open
                                analysis={riskReview.analysis}
                                providerName={sanitizeDisplayText(riskReview.request.provider_name, 'Unknown provider')}
                                action={riskReview.action}
                                isProcessing={processingId === riskReview.request.id}
                                onClose={() => setRiskReview(null)}
                                onConfirm={() => void handleRiskReviewConfirm()}
                            />
                        ) : null}
                        {rejectingRequest ? (
                            <PayoutRejectModal
                                open
                                providerName={sanitizeDisplayText(rejectingRequest.provider_name, 'Unknown provider')}
                                amountLabel={formatCurrency(rejectingRequest.amount)}
                                isProcessing={processingId === rejectingRequest.id}
                                onClose={() => setRejectingRequest(null)}
                                onConfirm={(rejectionReason) => void handleConfirmReject(rejectionReason)}
                            />
                        ) : null}
                        {confirmingRequest && (() => {
                            const payoutBreakdown = calculateWithdrawalPayoutBreakdown(confirmingRequest.amount);
                            return (
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
                                            <span className="font-medium text-text-secondary">Wallet debit</span>
                                            <span className="font-semibold text-text-primary">
                                                {formatCurrency(payoutBreakdown.grossAmount)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Chapa fee (2.5%)</span>
                                            <span className="font-semibold text-text-primary">
                                                {formatCurrency(payoutBreakdown.chapaFee)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium text-text-secondary">Bank transfer</span>
                                            <span className="font-semibold text-text-primary">
                                                {formatCurrency(payoutBreakdown.netTransferAmount)}
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
                            );
                        })()}
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
                                            <span className="font-medium text-text-secondary">Wallet debit</span>
                                            <span className="font-semibold text-text-primary">
                                                {transferResult.amount ? `ETB ${transferResult.amount}` : '—'}
                                            </span>
                                        </div>
                                        {transferResult.chapaFee ? (
                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                <span className="font-medium text-text-secondary">Chapa fee (2.5%)</span>
                                                <span className="font-semibold text-text-primary">
                                                    ETB {transferResult.chapaFee}
                                                </span>
                                            </div>
                                        ) : null}
                                        {transferResult.netTransferAmount ? (
                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                <span className="font-medium text-text-secondary">Bank transfer</span>
                                                <span className="font-semibold text-text-primary">
                                                    ETB {transferResult.netTransferAmount}
                                                </span>
                                            </div>
                                        ) : null}
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
        </>
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
