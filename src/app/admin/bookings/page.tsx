"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllBookings, fetchBookingById, clearSingle } from "../../../features/bookedService/bookedServiceSlice";
import { CalendarCheck2, RefreshCw, Search } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AuthGuard from "@/components/AuthGuard";

const StatusBadge = ({ status }: { status?: string }) => {
    const color = useMemo(() => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-700";
            case "ongoing":
                return "bg-blue-100 text-blue-700";
            case "accepted":
                return "bg-indigo-100 text-indigo-700";
            case "rejected":
            case "cancelled":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    }, [status]);
    return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status ?? "pending"}</span>;
};

const DetailModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
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
                                <div className="font-medium">{[single.firstName, single.lastName].filter(Boolean).join(" ") || "—"}</div>
                                <div className="text-sm text-gray-600">{single.email || "—"}</div>
                                <div className="text-sm text-gray-600">{single.phoneNumber || "—"}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Service</div>
                                <div className="font-medium">{single.serviceName || single.service_id || "—"}</div>
                                <div className="text-sm text-gray-600">Qty: {single.quantity ?? "1"}</div>
                                <div className="text-sm text-gray-600">Date: {single.bookingDate ? new Date(single.bookingDate).toLocaleString() : "—"}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Status</div>
                                <StatusBadge status={single.status} />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Amounts</div>
                                <div className="text-sm text-gray-700">Subtotal: {single.subTotal ?? 0}</div>
                                <div className="text-sm text-gray-700">Discount: {single.discount ?? 0}</div>
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
                <div className="px-5 py-3 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">Close</button>
                </div>
            </div>
        </div>
    );
};

const BookingsPage = () => {
    const dispatch = useAppDispatch();
    const { items, loading, error } = useAppSelector((s) => s.bookedService);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

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

    const filtered = useMemo(() => {
        if (!query.trim()) return items;
        const q = query.toLowerCase();
        return items.filter((b) => {
            const customer = [b.firstName, b.lastName].filter(Boolean).join(" ").toLowerCase();
            const email = (b.email ?? "").toLowerCase();
            const phone = (b.phoneNumber ?? "").toLowerCase();
            const service = (b.serviceName ?? b.service_id ?? "").toString().toLowerCase();
            const status = (b.status ?? "").toLowerCase();
            const provider = (b.provider_id ?? "").toString().toLowerCase();
            return (
                customer.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                service.includes(q) ||
                status.includes(q) ||
                provider.includes(q)
            );
        });
    }, [items, query]);

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
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <CalendarCheck2 className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Bookings
                                        </h1>
                                    </div>
                                    <p className="text-white/90 text-base font-medium">
                                        All booked services from customers across providers
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                                        <div className="text-sm text-white/80">Total Bookings</div>
                                        <div className="text-2xl font-bold text-white">{items.length}</div>
                                    </div>
                                    <button
                                        onClick={onRefresh}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Toolbar */}
                        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:w-96">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search customer, service, status, provider..."
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
                                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Date</TableHead>
                                        <TableHead className="font-semibold text-gray-700"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((b) => (
                                        <TableRow key={b.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20">
                                            <TableCell>
                                                <div className="text-sm font-medium">{b.provider_id}</div>
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
                                                        <div className="font-medium">{b.serviceName || b.service_id || '—'}</div>
                                                        <div className="text-xs text-gray-500">#{b.id.slice(0, 6)}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {[b.firstName, b.lastName].filter(Boolean).join(' ') || '—'}
                                                <div className="text-xs text-gray-500">{b.email || b.phoneNumber || '—'}</div>
                                            </TableCell>
                                            <TableCell>{b.totalAmount ?? b.price ?? 0}</TableCell>
                                            <TableCell><StatusBadge status={b.status} /></TableCell>
                                            <TableCell>{b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <button
                                                    onClick={() => onOpenDetail(b.id)}
                                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                                                >
                                                    View
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filtered.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell className="px-4 py-6 text-center text-gray-500" colSpan={7}>
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

                <DetailModal open={open} onClose={onClose} />
            </div>
        </AuthGuard>
    );
};

export default BookingsPage;
