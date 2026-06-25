"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllBookings, fetchBookingById, clearSingle, deleteBooking, verifyBookingPayment, getBookingCustomerDisplayName, getBookingProviderDisplayName } from "../../../features/bookedService/bookedServiceSlice";
import { Plus, RefreshCw, Search } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AdminPageHeader, { adminHeaderButtonClassName } from "@/components/AdminPageHeader";
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
        if (!row) return false;
        const paymentType = String(row.paymentType ?? '').toLowerCase();
        const paymentStatus = String(row.payment_status ?? '');
        const completed = row.paymentCompleted === true;
        return paymentType === 'chapa' && !completed && paymentStatus === 'pending_payment';
    }, [debugData]);

    async function reloadDebugData() {
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
    }

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
    }, [bookingId, dispatch, onVerified]);

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [debugBookingId, setDebugBookingId] = useState<string | null>(null);
    const [highlightIssues, setHighlightIssues] = useState(false);

    const debugListRow = useMemo(
        () => items.find((item) => item.id === debugBookingId) ?? null,
        [items, debugBookingId]
    );

    useEffect(() => {
        // Load all bookings across all providers
        dispatch(fetchAllBookings());
    }, [dispatch]);

    const onRefresh = () => {
        dispatch(fetchAllBookings());
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
    }, [items, query, jobStatusFilter, paymentMethodFilter, flaggedOnly]);

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Bookings"
                            description="All booked services from customers across providers"
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
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </>
                            }
                        />
                        <div className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="w-full lg:max-w-md">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Search ID, customer, provider, service…"
                                            className="h-10 w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-semibold text-gray-900">{filtered.length}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{items.length}</span> bookings
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={jobStatusFilter}
                                    onChange={(e) => setJobStatusFilter(e.target.value)}
                                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="all">All job statuses</option>
                                    <option value="pending">Awaiting provider</option>
                                    <option value="completed">Completed</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="on_the_way">On the way</option>
                                </select>
                                <select
                                    value={paymentMethodFilter}
                                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="all">All payment methods</option>
                                    <option value="wallet">Wallet</option>
                                    <option value="chapa">Chapa</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={flaggedOnly}
                                        onChange={(e) => setFlaggedOnly(e.target.checked)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
                                    />
                                    Has issues
                                </label>
                            </div>
                        </div>

                        {loading && (
                            <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                Loading bookings...
                            </div>
                        )}
                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <BookingsTable
                            bookings={filtered}
                            loading={loading}
                            deletingId={deletingId}
                            canWriteBookings={canWriteBookings}
                            isLocalhost={isLocalhost}
                            onOpenDetail={(id) => onOpenDetail(id)}
                            onOpenIssues={(id) => onOpenDetail(id, { focusIssues: true })}
                            onDelete={(id) => void handleDeleteBooking(id)}
                            onDebug={setDebugBookingId}
                        />
                    </div>
                </main>

                <BookingDetailModal
                    open={open}
                    booking={single}
                    loading={loading}
                    highlightIssues={highlightIssues}
                    onClose={onClose}
                    onDelete={handleDeleteBooking}
                    deleting={Boolean(deletingId)}
                    canDelete={canWriteBookings}
                />
                {isLocalhost && (
                    <BookingDebugModal
                        open={Boolean(debugBookingId)}
                        bookingId={debugBookingId}
                        listRow={debugListRow}
                        onClose={() => setDebugBookingId(null)}
                        onVerified={() => dispatch(fetchAllBookings())}
                    />
                )}
                {canWriteBookings && (
                <CreateBookingModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => dispatch(fetchAllBookings())}
                />
                )}
            </div>
        </AuthGuard>
    );
};

export default BookingsPage;
