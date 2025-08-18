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
      <div className="flex">
        <Sidebar />
        <main className="ml-64 w-full min-h-screen">
        {/* Page header */}
        <div className="relative isolate overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-white/15 p-2 text-white ring-1 ring-white/20">
                  <CalendarCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Bookings</h1>
                  <p className="mt-1 text-white/80 text-sm">All booked services from customers across providers.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-white/80">{items.length} total</div>
                <button
                  onClick={onRefresh}
                  className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/15"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 bg-gray-50">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-96">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customer, service, status, provider..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          </div>

          {loading && <div className="mb-4 text-sm text-gray-600">Loading bookings...</div>}
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-600">
                  <TableHead>Provider</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id} className="hover:bg-gray-50/60">
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
                          <div className="text-xs text-gray-500">#{b.id.slice(0,6)}</div>
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
