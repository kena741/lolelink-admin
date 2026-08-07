"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllBookings, fetchBookingById, clearSingle, deleteBooking, verifyBookingPayment, updateBookingStatus, recollectBookingPayment, getBookingCustomerDisplayName, getBookingProviderDisplayName } from "../../../features/bookedService/bookedServiceSlice";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import AdminPageHeader, { adminHeaderButtonClassName } from "@/components/AdminPageHeader";
import {
    AdminErrorAlert,
    AdminShell,
} from "@/components/admin/admin-layout";
import { AdminFilterSelect } from "@/components/admin/AdminFilterSelect";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { getSupabase } from "@/lib/supabaseClient";
import type { BookedService } from "@/features/bookedService/bookedServiceSlice";
import { CreateBookingModal } from "./CreateBookingModal";
import { BookingDetailModal } from "./BookingDetailModal";
import { BookingsTable } from "./BookingsTable";
import { useIsLocalhost } from "@/hooks/use-is-localhost";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import {
    formatBookingShortId,
    getBookingAnomalies,
    resolveBookingServiceName,
} from "@/lib/booking-display";
import type { BookedServiceStatus } from "@/lib/booking-status";
import { BOOKING_PAYMENT_STATUS } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import { markAdminListFetched, shouldRefetchAdminList } from "@/lib/admin-list-cache";

interface ToastState {
    message: string;
    variant: 'success' | 'error' | 'warning';
}

type QueueFocus = 'all' | 'awaiting' | 'issues' | 'unpaid';

const JOB_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All job statuses' },
    { value: 'pending', label: 'Awaiting provider' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'on_the_way', label: 'On the way' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_METHOD_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All methods' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'chapa', label: 'Chapa' },
    { value: 'admin', label: 'Admin' },
];

function isUnpaidBooking(booking: BookedService): boolean {
    return !(
        booking.paymentCompleted === true ||
        booking.payment_status === BOOKING_PAYMENT_STATUS.COMPLETED
    );
}

function DebugJsonBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1.5 text-[13px] font-semibold text-card-foreground">{title}</div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-muted-foreground">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}

interface BookingDebugData {
    listRow: Record<string, unknown> | null;
    booked_service: Record<string, unknown> | null;
    payments: Record<string, unknown> | null;
    errors: {
        booked_service?: string;
        payments?: string;
    };
    fetchedAt: string;
}

const BookingDebugModal: React.FC<{
    open: boolean;
    bookingId: string | null;
    listRow: BookedService | null;
    onClose: () => void;
    onVerified: () => void;
}> = ({ open, bookingId, listRow, onClose, onVerified }) => {
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);
    const [debugData, setDebugData] = useState<BookingDebugData | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
    const verifyInFlightRef = useRef(false);

    const needsChapaVerify = useMemo(() => {
        const row = debugData?.booked_service;
        const payment = debugData?.payments;
        if (!row) return false;
        const completed = row.paymentCompleted === true;
        const paymentStatus = String(row.payment_status ?? '');
        if (completed || paymentStatus === 'payment_completed') return false;

        const paymentType = String(row.paymentType ?? '').toLowerCase();
        const paymentMethod = String(payment?.payment_method ?? payment?.provider ?? '').toLowerCase();
        const hasChapaPending =
            paymentType === 'chapa' ||
            paymentMethod === 'chapa' ||
            Boolean(payment?.provider_ref);

        return hasChapaPending && paymentStatus === 'pending_payment';
    }, [debugData]);

    const reloadDebugData = useCallback(async () => {
        if (!bookingId) return;
        setLoading(true);
        setFetchError(null);

        try {
            const supabase = getSupabase();
            const [bookingRes, paymentsRes] = await Promise.all([
                supabase.from('booked_service').select('*').eq('id', bookingId).single(),
                supabase.from('payments').select('*').eq('booking_id', bookingId).maybeSingle(),
            ]);

            setDebugData({
                listRow: listRow ? (listRow as unknown as Record<string, unknown>) : null,
                booked_service: (bookingRes.data as Record<string, unknown> | null) ?? null,
                payments: (paymentsRes.data as Record<string, unknown> | null) ?? null,
                errors: {
                    booked_service: bookingRes.error?.message,
                    payments: paymentsRes.error?.message,
                },
                fetchedAt: new Date().toISOString(),
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load debug data';
            setFetchError(message);
        } finally {
            setLoading(false);
        }
    }, [bookingId, listRow]);

    useEffect(() => {
        if (!open || !bookingId) {
            setDebugData(null);
            setFetchError(null);
            setVerifyMessage(null);
            return;
        }

        let cancelled = false;

        async function loadDebugData() {
            setLoading(true);
            setFetchError(null);

            try {
                const supabase = getSupabase();
                const [bookingRes, paymentsRes] = await Promise.all([
                    supabase.from('booked_service').select('*').eq('id', bookingId).single(),
                    supabase.from('payments').select('*').eq('booking_id', bookingId).maybeSingle(),
                ]);

                if (cancelled) return;

                setDebugData({
                    listRow: listRow ? (listRow as unknown as Record<string, unknown>) : null,
                    booked_service: (bookingRes.data as Record<string, unknown> | null) ?? null,
                    payments: (paymentsRes.data as Record<string, unknown> | null) ?? null,
                    errors: {
                        booked_service: bookingRes.error?.message,
                        payments: paymentsRes.error?.message,
                    },
                    fetchedAt: new Date().toISOString(),
                });
            } catch (error: unknown) {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : 'Failed to load debug data';
                setFetchError(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadDebugData();

        return () => {
            cancelled = true;
        };
    }, [open, bookingId, listRow]);

    const runVerifyPayment = useCallback(async (options?: { auto?: boolean }) => {
        if (!bookingId || verifyInFlightRef.current) return;

        verifyInFlightRef.current = true;
        if (!options?.auto) setVerifying(true);
        if (!options?.auto) setVerifyMessage(null);

        try {
            await dispatch(verifyBookingPayment({ bookingId })).unwrap();
            setVerifyMessage('Payment verified and booking updated.');
            onVerified();
            await reloadDebugData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Verification failed';
            const isPending =
                message.toLowerCase().includes('not yet confirmed') ||
                message.toLowerCase().includes('payment not yet');
            if (options?.auto && isPending) {
                setVerifyMessage('Auto-verifying… waiting for Chapa confirmation.');
            } else {
                setVerifyMessage(message);
            }
        } finally {
            verifyInFlightRef.current = false;
            if (!options?.auto) setVerifying(false);
        }
    }, [bookingId, dispatch, onVerified, reloadDebugData]);

    useEffect(() => {
        if (!open || !bookingId || !needsChapaVerify) return;

        let cancelled = false;

        function tryAutoVerify() {
            if (cancelled) return;
            void runVerifyPayment({ auto: true });
        }

        const initialTimer = window.setTimeout(tryAutoVerify, 500);
        const intervalTimer = window.setInterval(tryAutoVerify, 5000);

        return () => {
            cancelled = true;
            window.clearTimeout(initialTimer);
            window.clearInterval(intervalTimer);
        };
    }, [open, bookingId, needsChapaVerify, runVerifyPayment]);

    async function handleVerifyPayment() {
        await runVerifyPayment();
    }

    if (!open || !bookingId) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
                <div className="flex items-center justify-between border-b px-5 py-3">
                    <div>
                        <h3 className="text-lg font-semibold">Booking Debug</h3>
                        <p className="text-xs text-gray-500">#{bookingId}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="space-y-3 overflow-y-auto p-5">
                    {loading && <div className="text-sm text-gray-600">Loading table responses...</div>}
                    {fetchError && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{fetchError}</div>
                    )}
                    {verifyMessage && (
                        <div className={`rounded-md p-3 text-sm ${verifyMessage.includes('verified') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                            {verifyMessage}
                        </div>
                    )}

                    {debugData && (
                        <>
                            <DebugJsonBlock
                                title="Redux list row (bookings table)"
                                value={{
                                    table: 'booked_service',
                                    source: 'fetchAllBookings → Redux items[]',
                                    row: debugData.listRow,
                                }}
                            />
                            <DebugJsonBlock
                                title="booked_service — fresh select(*)"
                                value={{
                                    table: 'booked_service',
                                    error: debugData.errors.booked_service ?? null,
                                    row: debugData.booked_service,
                                }}
                            />
                            <DebugJsonBlock
                                title="payments — select by booking_id"
                                value={{
                                    table: 'payments',
                                    error: debugData.errors.payments ?? null,
                                    row: debugData.payments,
                                }}
                            />
                            <p className="text-xs text-gray-500">Fetched at {debugData.fetchedAt}</p>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
                    {needsChapaVerify && (
                        <button
                            type="button"
                            onClick={() => void handleVerifyPayment()}
                            disabled={verifying || loading}
                            className="rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-primary-hover disabled:opacity-50"
                        >
                            {verifying ? 'Verifying...' : 'Verify Chapa Payment'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className={`rounded bg-gray-100 px-4 py-2 hover:bg-gray-200 ${needsChapaVerify ? '' : 'ml-auto block'}`}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const BookingsPage = () => {
    const dispatch = useAppDispatch();
    const isLocalhost = useIsLocalhost();
    const { canWriteBookings } = useAdminPermissions();
    const { items, loading, error, single } = useAppSelector((s) => s.bookedService);
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [jobStatusFilter, setJobStatusFilter] = useState("all");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [unpaidOnly, setUnpaidOnly] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [debugBookingId, setDebugBookingId] = useState<string | null>(null);
    const [highlightIssues, setHighlightIssues] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const chapaReturnHandledRef = useRef<string | null>(null);
    const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);
    const [recollectingPayment, setRecollectingPayment] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const status = (new URLSearchParams(window.location.search).get('status') ?? '').trim().toLowerCase();
        if (status) setJobStatusFilter(status);
    }, []);

    const debugListRow = useMemo(
        () => items.find((item) => item.id === debugBookingId) ?? null,
        [items, debugBookingId]
    );

    const reloadBookings = useCallback(
        (force = true) => {
            const key = `bookings:arch=${showArchived ? '1' : '0'}`;
            if (
                !shouldRefetchAdminList(key, {
                    force,
                    hasRows: items.length > 0,
                })
            ) {
                return;
            }
            void dispatch(fetchAllBookings({ includeArchived: showArchived })).then((action) => {
                if (fetchAllBookings.fulfilled.match(action)) markAdminListFetched(key);
            });
        },
        [dispatch, showArchived, items.length]
    );

    useEffect(() => {
        reloadBookings(false);
    }, [reloadBookings]);

    useEffect(() => {
        if (!toast) return;
        const timeoutId = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timeoutId);
    }, [toast]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const bookingId = (params.get('chapa_verify') ?? '').trim();
        if (!bookingId || chapaReturnHandledRef.current === bookingId) return;

        chapaReturnHandledRef.current = bookingId;
        let cancelled = false;

        async function verifyReturnedChapaPayment() {
            setToast({ message: 'Confirming Chapa payment…', variant: 'warning' });
            try {
                await dispatch(verifyBookingPayment({ bookingId })).unwrap();
                if (cancelled) return;
                setToast({ message: 'Chapa payment verified. Booking marked as paid.', variant: 'success' });
                reloadBookings();
                setHighlightIssues(false);
                setOpen(true);
                dispatch(fetchBookingById(bookingId));
            } catch (error: unknown) {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : 'Could not verify Chapa payment yet';
                setToast({ message, variant: 'warning' });
                setDebugBookingId(bookingId);
            } finally {
                params.delete('chapa_verify');
                const next = params.toString();
                const path = `${window.location.pathname}${next ? `?${next}` : ''}`;
                window.history.replaceState({}, '', path);
            }
        }

        void verifyReturnedChapaPayment();
        return () => {
            cancelled = true;
        };
    }, [dispatch, reloadBookings]);

    const onRefresh = () => {
        reloadBookings();
    };

    const onOpenDetail = (id: string, options?: { focusIssues?: boolean }) => {
        setHighlightIssues(options?.focusIssues === true);
        setOpen(true);
        dispatch(fetchBookingById(id));
    };

    const onClose = () => {
        setOpen(false);
        setHighlightIssues(false);
        dispatch(clearSingle());
    };

    const handleVerifyPaymentFromDetail = async (id: string) => {
        setVerifyingPaymentId(id);
        try {
            await dispatch(verifyBookingPayment({ bookingId: id })).unwrap();
            setToast({ message: 'Chapa payment verified. Booking marked as paid.', variant: 'success' });
            await dispatch(fetchBookingById(id));
            reloadBookings();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Verification failed';
            setToast({ message, variant: 'error' });
        } finally {
            setVerifyingPaymentId(null);
        }
    };

    const handleRecollectPayment = async (id: string, mode: 'wallet' | 'mark_paid') => {
        setRecollectingPayment(true);
        try {
            const result = await dispatch(recollectBookingPayment({ bookingId: id, mode })).unwrap();
            setToast({
                message:
                    mode === 'wallet'
                        ? `Re-collected ETB ${result.amount.toFixed(2)} from customer wallet. You can complete the job now.`
                        : `Marked paid (admin) ETB ${result.amount.toFixed(2)}. Provider is credited when you set status to Completed.`,
                variant: 'success',
            });
            await dispatch(fetchBookingById(id));
            reloadBookings();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to re-collect payment';
            setToast({ message, variant: 'error' });
        } finally {
            setRecollectingPayment(false);
        }
    };

    const handleUpdateBookingStatus = async (
        id: string,
        status: BookedServiceStatus,
        options?: { applyCommission?: boolean }
    ) => {
        setUpdatingStatus(true);
        try {
            const result = await dispatch(
                updateBookingStatus({
                    bookingId: id,
                    status,
                    applyCommission: options?.applyCommission,
                })
            ).unwrap();
            const payout = result.provider_payout;
            const clawback = result.provider_clawback;
            const refund = result.customer_refund;
            if (status === 'completed' && payout && payout.skipped === false) {
                setToast({
                    message: `Job completed. Provider wallet credited ETB ${payout.amount.toFixed(2)}.`,
                    variant: 'success',
                });
            } else if (status === 'completed' && payout?.skipped && payout.reason === 'unpaid') {
                setToast({
                    message:
                        'Job completed without provider payout — mark as paid (or collect customer payment) first, then set Completed again or re-open completed.',
                    variant: 'warning',
                });
            } else if (status === 'completed' && payout?.skipped && payout.reason === 'already_credited') {
                setToast({
                    message: 'Job completed. Provider payout was already recorded.',
                    variant: 'success',
                });
            } else if (status === 'rejected' && (clawback?.skipped === false || refund?.skipped === false)) {
                const parts: string[] = ['Job rejected.'];
                if (clawback && clawback.skipped === false) {
                    parts.push(`Provider payout reversed ETB ${clawback.amount.toFixed(2)}.`);
                }
                if (refund && refund.skipped === false) {
                    parts.push(`Customer refunded ETB ${refund.amount.toFixed(2)}.`);
                }
                setToast({ message: parts.join(' '), variant: 'success' });
            } else if (clawback && clawback.skipped === false) {
                setToast({
                    message: `Job status updated. Provider completion payout reversed ETB ${clawback.amount.toFixed(2)}.`,
                    variant: 'success',
                });
            } else {
                setToast({ message: 'Job status updated.', variant: 'success' });
            }
            await dispatch(fetchBookingById(id));
            reloadBookings();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update job status';
            setToast({ message, variant: 'error' });
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleDeleteBooking = async (id: string) => {
        const booking = items.find((item) => item.id === id);
        const label = booking?.serviceName || booking?.id || 'this booking';
        if (!confirm(`Delete booking for ${label}? This cannot be undone.`)) return;

        setDeletingId(id);
        try {
            await dispatch(deleteBooking(id)).unwrap();
            if (open) onClose();
        } catch {
        } finally {
            setDeletingId(null);
        }
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return items.filter((b) => {
            const bookingRecord = b as unknown as Record<string, unknown>;
            const serviceName = resolveBookingServiceName(bookingRecord).toLowerCase();
            const customer = getBookingCustomerDisplayName(b).toLowerCase();
            const provider = getBookingProviderDisplayName(b).toLowerCase();
            const email = (b.email ?? "").toLowerCase();
            const phone = (b.phoneNumber ?? "").toLowerCase();
            const status = (b.status ?? "").toLowerCase();
            const paymentStatus = (b.payment_status ?? "").toLowerCase();
            const paymentMethod = (b.paymentType ?? "").toLowerCase();
            const shortId = formatBookingShortId(b.id).toLowerCase();

            if (jobStatusFilter !== "all" && status !== jobStatusFilter) return false;
            if (paymentMethodFilter !== "all" && paymentMethod !== paymentMethodFilter) return false;
            if (flaggedOnly && getBookingAnomalies(bookingRecord).length === 0) return false;
            if (unpaidOnly && !isUnpaidBooking(b)) return false;
            if (!showArchived && b.is_archived === true) return false;

            if (!q) return true;

            return (
                b.id.toLowerCase().includes(q) ||
                shortId.includes(q) ||
                customer.includes(q) ||
                provider.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                serviceName.includes(q) ||
                status.includes(q) ||
                paymentStatus.includes(q) ||
                paymentMethod.includes(q)
            );
        });
    }, [items, query, jobStatusFilter, paymentMethodFilter, flaggedOnly, unpaidOnly, showArchived]);

    const queueCounts = useMemo(() => {
        let awaiting = 0;
        let withIssues = 0;
        let unpaid = 0;

        for (const booking of items) {
            if (!showArchived && booking.is_archived === true) continue;
            if ((booking.status ?? '').toLowerCase() === 'pending') awaiting += 1;
            if (getBookingAnomalies(booking as unknown as Record<string, unknown>).length > 0) {
                withIssues += 1;
            }
            if (isUnpaidBooking(booking)) unpaid += 1;
        }

        return { awaiting, withIssues, unpaid, visible: items.filter((b) => showArchived || b.is_archived !== true).length };
    }, [items, showArchived]);

    const queueFocus: QueueFocus = useMemo(() => {
        if (flaggedOnly && jobStatusFilter === 'all' && !unpaidOnly) return 'issues';
        if (unpaidOnly && jobStatusFilter === 'all' && !flaggedOnly) return 'unpaid';
        if (jobStatusFilter === 'pending' && !flaggedOnly && !unpaidOnly) return 'awaiting';
        if (!flaggedOnly && !unpaidOnly && jobStatusFilter === 'all') return 'all';
        return 'all';
    }, [flaggedOnly, unpaidOnly, jobStatusFilter]);

    const filtersActive =
        query.trim().length > 0 ||
        jobStatusFilter !== 'all' ||
        paymentMethodFilter !== 'all' ||
        flaggedOnly ||
        unpaidOnly ||
        showArchived;

    function clearFilters() {
        setQuery('');
        setJobStatusFilter('all');
        setPaymentMethodFilter('all');
        setFlaggedOnly(false);
        setUnpaidOnly(false);
        setShowArchived(false);
    }

    function applyQueueFocus(focus: QueueFocus) {
        if (focus === 'all') {
            setJobStatusFilter('all');
            setFlaggedOnly(false);
            setUnpaidOnly(false);
            return;
        }
        if (focus === 'awaiting') {
            setJobStatusFilter('pending');
            setFlaggedOnly(false);
            setUnpaidOnly(false);
            return;
        }
        if (focus === 'issues') {
            setJobStatusFilter('all');
            setFlaggedOnly(true);
            setUnpaidOnly(false);
            return;
        }
        setJobStatusFilter('all');
        setFlaggedOnly(false);
        setUnpaidOnly(true);
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [query, jobStatusFilter, paymentMethodFilter, flaggedOnly, unpaidOnly, showArchived, pageSize]);

    const jobStatusOptions = useMemo(() => {
        if (
            jobStatusFilter !== 'all' &&
            !JOB_STATUS_OPTIONS.some((option) => option.value === jobStatusFilter)
        ) {
            return [...JOB_STATUS_OPTIONS, { value: jobStatusFilter, label: jobStatusFilter }];
        }
        return JOB_STATUS_OPTIONS;
    }, [jobStatusFilter]);

    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / pageSize) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = filtered.slice(startIdx, startIdx + pageSize);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    return (
        <>
            <AdminShell>
                        {toast ? (
                            <div className="fixed right-6 top-6 z-120">
                                <div
                                    className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl ${
                                        toast.variant === 'success'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : toast.variant === 'warning'
                                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                                              : 'border-red-200 bg-red-50 text-red-700'
                                    }`}
                                >
                                    {toast.message}
                                </div>
                            </div>
                        ) : null}
                        <AdminPageHeader
                            title="Bookings"
                            description="Verify payment, update job status, investigate issues"
                            actions={
                                <>
                                    {canWriteBookings && (
                                        <button
                                            type="button"
                                            onClick={() => setCreateOpen(true)}
                                            className={adminHeaderButtonClassName()}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create booking
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onRefresh}
                                        className={adminHeaderButtonClassName()}
                                        disabled={loading}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </>
                            }
                        />

                        {error ? <AdminErrorAlert message={error} /> : null}

                        <section
                            aria-label="Booking queue filters"
                            className="mb-4 flex flex-col gap-3"
                        >
                            <div
                                role="tablist"
                                aria-label="Queue focus"
                                className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1"
                            >
                                {(
                                    [
                                        { id: 'all' as const, label: 'All', count: queueCounts.visible },
                                        {
                                            id: 'awaiting' as const,
                                            label: 'Awaiting provider',
                                            count: queueCounts.awaiting,
                                        },
                                        {
                                            id: 'issues' as const,
                                            label: 'Has issues',
                                            count: queueCounts.withIssues,
                                        },
                                        {
                                            id: 'unpaid' as const,
                                            label: 'Unpaid',
                                            count: queueCounts.unpaid,
                                        },
                                    ] as const
                                ).map((tab) => {
                                    const selected = queueFocus === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={selected}
                                            onClick={() => applyQueueFocus(tab.id)}
                                            className={cn(
                                                'inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-2px)] px-3 text-sm font-medium transition-colors duration-150',
                                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                selected
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-text-secondary hover:bg-muted hover:text-text-primary'
                                            )}
                                        >
                                            {tab.label}
                                            <span
                                                className={cn(
                                                    'tabular-nums text-[12px]',
                                                    selected
                                                        ? 'text-primary-foreground/85'
                                                        : 'text-text-hint'
                                                )}
                                            >
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <div className="relative min-w-0 flex-1">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-hint"
                                            aria-hidden
                                        />
                                        <input
                                            type="search"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Search ID, customer, provider, service…"
                                            className="h-10 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-hint focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <AdminFilterSelect
                                            aria-label="Job status"
                                            value={jobStatusFilter}
                                            options={jobStatusOptions}
                                            onChange={(value) => {
                                                setJobStatusFilter(value);
                                                if (value !== 'pending') setUnpaidOnly(false);
                                            }}
                                            className="min-w-44"
                                        />
                                        <AdminFilterSelect
                                            aria-label="Payment method"
                                            value={paymentMethodFilter}
                                            options={PAYMENT_METHOD_OPTIONS}
                                            onChange={setPaymentMethodFilter}
                                            className="min-w-36"
                                        />
                                        <button
                                            type="button"
                                            aria-pressed={showArchived}
                                            onClick={() => setShowArchived((value) => !value)}
                                            className={cn(
                                                'inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors duration-150',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                showArchived
                                                    ? 'border-primary/30 bg-secondary text-secondary-foreground'
                                                    : 'border-border bg-background text-text-primary hover:bg-muted'
                                            )}
                                        >
                                            Show archived
                                        </button>
                                        {filtersActive ? (
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <X className="h-3.5 w-3.5" aria-hidden />
                                                Clear
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="text-sm text-text-secondary">
                                    <span className="font-semibold tabular-nums text-text-primary">
                                        {filtered.length}
                                    </span>
                                    {' of '}
                                    <span className="tabular-nums">{queueCounts.visible}</span>
                                    {' bookings'}
                                    {loading ? ' · updating…' : null}
                                </p>
                            </div>
                        </section>

                        <BookingsTable
                            bookings={paginated}
                            loading={loading}
                            deletingId={deletingId}
                            canWriteBookings={canWriteBookings}
                            isLocalhost={isLocalhost}
                            onOpenDetail={(id) => onOpenDetail(id)}
                            onOpenIssues={(id) => onOpenDetail(id, { focusIssues: true })}
                            onDelete={(id) => void handleDeleteBooking(id)}
                            onDebug={setDebugBookingId}
                        />

                        <AdminListPagination
                            page={safePage}
                            pageSize={pageSize}
                            totalItems={filtered.length}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />

                <BookingDetailModal
                    open={open}
                    booking={single}
                    loading={loading}
                    highlightIssues={highlightIssues}
                    onClose={onClose}
                    onDelete={handleDeleteBooking}
                    deleting={Boolean(deletingId)}
                    canDelete={canWriteBookings}
                    onVerifyPayment={canWriteBookings ? handleVerifyPaymentFromDetail : undefined}
                    verifyingPayment={Boolean(verifyingPaymentId)}
                    onRecollectPayment={canWriteBookings ? handleRecollectPayment : undefined}
                    recollectingPayment={recollectingPayment}
                    onUpdateStatus={canWriteBookings ? handleUpdateBookingStatus : undefined}
                    updatingStatus={updatingStatus}
                />
                {isLocalhost && (
                    <BookingDebugModal
                        open={Boolean(debugBookingId)}
                        bookingId={debugBookingId}
                        listRow={debugListRow}
                        onClose={() => setDebugBookingId(null)}
                        onVerified={() => reloadBookings()}
                    />
                )}
                {canWriteBookings && (
                <CreateBookingModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => reloadBookings()}
                />
                )}
            </AdminShell>
        </>
    );
};

export default BookingsPage;
