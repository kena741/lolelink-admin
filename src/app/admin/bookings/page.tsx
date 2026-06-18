"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllBookings, fetchBookingById, clearSingle, deleteBooking, verifyBookingPayment, getBookingCustomerDisplayName, getBookingProviderDisplayName } from "../../../features/bookedService/bookedServiceSlice";
import { Plus, RefreshCw, Search, Trash2, Bug, Eye, Loader2 } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AuthGuard from "@/components/AuthGuard";
import AdminPageHeader, { adminHeaderButtonClassName } from "@/components/AdminPageHeader";
import { formatServiceDiscountLabel } from "@/lib/service-discount";
import {
    formatBookingJobStatusLabel,
    formatBookingPaymentStatusLabel,
    resolveBookingPaymentStatus,
} from "@/lib/booking-status";
import { getSupabase } from "@/lib/supabaseClient";
import type { BookedService } from "@/features/bookedService/bookedServiceSlice";
import { CreateBookingModal } from "./CreateBookingModal";
import { useIsLocalhost } from "@/hooks/use-is-localhost";

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

const JobStatusBadge = ({ status }: { status?: string }) => {
    const color = useMemo(() => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-700";
            case "in_progress":
            case "on_the_way":
                return "bg-blue-100 text-blue-700";
            case "accepted":
            case "pending_approval":
                return "bg-indigo-100 text-indigo-700";
            case "rejected":
                return "bg-red-100 text-red-700";
            case "pending_extra_payment":
            case "hold":
                return "bg-amber-100 text-amber-700";
            case "admin_paid":
                return "bg-emerald-100 text-emerald-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    }, [status]);
    return (
        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${color}`}>
            {formatBookingJobStatusLabel(status ?? "pending")}
        </span>
    );
};

const PaymentStatusBadge = ({
    paymentStatus,
    paymentCompleted,
}: {
    paymentStatus?: string | null;
    paymentCompleted?: boolean | null;
}) => {
    const resolved = resolveBookingPaymentStatus(paymentStatus, paymentCompleted);
    const color = useMemo(() => {
        switch (resolved) {
            case "payment_completed":
                return "bg-green-100 text-green-800";
            case "payment_approved_by_admin":
                return "bg-blue-100 text-blue-800";
            case "pending_payment":
                return "bg-amber-100 text-amber-900";
            case "payment_rejected_by_admin":
            case "payment_cancelled":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-700";
        }
    }, [resolved]);

    return (
        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${color}`}>
            {formatBookingPaymentStatusLabel(paymentStatus, paymentCompleted)}
        </span>
    );
};

const DetailModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onDelete: (id: string) => Promise<void>;
    deleting: boolean;
}> = ({ open, onClose, onDelete, deleting }) => {
    const { single, loading } = useAppSelector((s) => s.bookedService);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white w-full max-w-2xl rounded shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <h3 className="text-lg font-semibold">Booking Details</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <div className="p-5">
                    {loading && <div>Loading...</div>}
                    {!loading && single && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Customer</div>
                                <div className="font-medium">{getBookingCustomerDisplayName(single)}</div>
                                <div className="text-sm text-gray-600">{single.email || "—"}</div>
                                <div className="text-sm text-gray-600">{single.phoneNumber || "—"}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Provider</div>
                                <div className="font-medium">{getBookingProviderDisplayName(single)}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Service</div>
                                <div className="font-medium">{single.serviceName?.trim() || "—"}</div>
                                <div className="text-sm text-gray-600">Qty: {single.quantity ?? "1"}</div>
                                <div className="text-sm text-gray-600">Date: {single.bookingDate ? new Date(single.bookingDate).toLocaleString() : "—"}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Job status</div>
                                <JobStatusBadge status={single.status} />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Payment</div>
                                <PaymentStatusBadge
                                    paymentStatus={single.payment_status}
                                    paymentCompleted={single.paymentCompleted}
                                />
                                {single.paymentType && (
                                    <div className="mt-1 text-xs text-gray-500 capitalize">
                                        via {single.paymentType}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Amounts</div>
                                <div className="text-sm text-gray-700">Subtotal: {single.subTotal ?? 0}</div>
                                <div className="text-sm text-gray-700">Discount: {formatServiceDiscountLabel(single.discount)}</div>
                                <div className="text-sm text-gray-900 font-semibold">Total: {single.totalAmount ?? single.price ?? 0}</div>
                            </div>
                            {single.serviceImage && (
                                <div className="md:col-span-2">
                                    <Image
                                        src={single.serviceImage}
                                        alt="service"
                                        width={800}
                                        height={300}
                                        className="w-full h-48 object-cover rounded"
                                    />
                                </div>
                            )}
                            {single.description && (
                                <div className="md:col-span-2">
                                    <div className="text-sm text-gray-500 mb-1">Description</div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{single.description}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="px-5 py-3 border-t flex items-center justify-between gap-2">
                    {single && (
                        <button
                            type="button"
                            onClick={() => void onDelete(single.id)}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                    <button onClick={onClose} className="ml-auto px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">Close</button>
                </div>
            </div>
        </div>
    );
};

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
    const { items, loading, error } = useAppSelector((s) => s.bookedService);
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [debugBookingId, setDebugBookingId] = useState<string | null>(null);

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

    const onOpenDetail = (id: string) => {
        setOpen(true);
        dispatch(fetchBookingById(id));
    };

    const onClose = () => {
        setOpen(false);
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
        if (!query.trim()) return items;
        const q = query.toLowerCase();
        return items.filter((b) => {
            const customer = getBookingCustomerDisplayName(b).toLowerCase();
            const provider = getBookingProviderDisplayName(b).toLowerCase();
            const email = (b.email ?? "").toLowerCase();
            const phone = (b.phoneNumber ?? "").toLowerCase();
            const service = (b.serviceName ?? "").toString().toLowerCase();
            const status = (b.status ?? "").toLowerCase();
            const paymentStatus = (b.payment_status ?? "").toLowerCase();
            return (
                customer.includes(q) ||
                provider.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                service.includes(q) ||
                status.includes(q) ||
                paymentStatus.includes(q)
            );
        });
    }, [items, query]);

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
                                    <button
                                        type="button"
                                        onClick={() => setCreateOpen(true)}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create booking
                                    </button>
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
                        {/* Toolbar */}
                        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:w-96">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search customer, provider, service, status..."
                                        className="w-full rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50 shadow-lg transition-all"
                                    />
                                </div>
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

                        <div className="rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20">
                                        <TableHead className="font-semibold text-gray-700">Provider</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Service</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Job status</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Payment</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Date</TableHead>
                                        <TableHead className="font-semibold text-gray-700"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((b) => (
                                        <TableRow key={b.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20">
                                            <TableCell>
                                                <div className="text-sm font-medium">{getBookingProviderDisplayName(b)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {b.serviceImage ? (
                                                        <Image
                                                            src={b.serviceImage}
                                                            alt="service"
                                                            width={40}
                                                            height={40}
                                                            className="h-10 w-10 rounded object-cover ring-1 ring-gray-200"
                                                        />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded bg-gray-200" />
                                                    )}
                                                    <div>
                                                        <div className="font-medium">{b.serviceName?.trim() || '—'}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{getBookingCustomerDisplayName(b)}</div>
                                                <div className="text-xs text-gray-500">{b.email || b.phoneNumber || '—'}</div>
                                            </TableCell>
                                            <TableCell>{b.totalAmount ?? b.price ?? 0}</TableCell>
                                            <TableCell>
                                                <JobStatusBadge status={b.status} />
                                            </TableCell>
                                            <TableCell>
                                                <PaymentStatusBadge
                                                    paymentStatus={b.payment_status}
                                                    paymentCompleted={b.paymentCompleted}
                                                />
                                            </TableCell>
                                            <TableCell>{b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenDetail(b.id)}
                                                        aria-label="View booking details"
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDeleteBooking(b.id)}
                                                        disabled={deletingId === b.id}
                                                        aria-label={deletingId === b.id ? 'Deleting booking' : 'Delete booking'}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                                                    >
                                                        {deletingId === b.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    {isLocalhost && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDebugBookingId(b.id)}
                                                            aria-label="Debug booking"
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                        >
                                                            <Bug className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filtered.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                                                No bookings found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                <TableCaption>All bookings</TableCaption>
                            </Table>
                        </div>
                    </div>
                </main>

                <DetailModal
                    open={open}
                    onClose={onClose}
                    onDelete={handleDeleteBooking}
                    deleting={Boolean(deletingId)}
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
                <CreateBookingModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => dispatch(fetchAllBookings())}
                />
            </div>
        </AuthGuard>
    );
};

export default BookingsPage;
