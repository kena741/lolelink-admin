'use client';

import type { ComponentProps } from 'react';
import Image from 'next/image';
import { Briefcase, Bug, Eye, Loader2, Trash2 } from 'lucide-react';
import {
    getBookingCustomerDisplayName,
    getBookingProviderDisplayName,
    type BookedService,
} from '@/features/bookedService/bookedServiceSlice';
import {
    formatBookingAmount,
    formatBookingTableDate,
    formatPaymentMethodLabel,
    getBookingAnomalies,
    bookingAmountTone,
    resolveBookingServiceImage,
    resolveBookingServiceName,
    sanitizePersonDisplayName,
    formatBookingShortId,
} from '@/lib/booking-display';
import {
    formatBookingJobStatusLabel,
    formatBookingPaymentStatusLabel,
} from '@/lib/booking-status';
import {
    getBookingJobStatusTone,
    getBookingPaymentMethodTone,
    getBookingPaymentStatusTone,
} from '@/lib/admin-status-badge';
import { BookingFlagsCell } from './BookingFlagsCell';
import { AdminDataTableEmpty, AdminIconActionButton, AdminStatusBadge, AdminTableShell } from '@/components/admin/data-table';

function JobStatusBadge({ status }: { status?: string }) {
    return (
        <AdminStatusBadge tone={getBookingJobStatusTone(status)}>
            {formatBookingJobStatusLabel(status)}
        </AdminStatusBadge>
    );
}

function PaymentStatusBadge({
    paymentStatus,
    paymentCompleted,
}: {
    paymentStatus?: string | null;
    paymentCompleted?: boolean | null;
}) {
    return (
        <AdminStatusBadge tone={getBookingPaymentStatusTone(paymentStatus, paymentCompleted)}>
            {formatBookingPaymentStatusLabel(paymentStatus, paymentCompleted)}
        </AdminStatusBadge>
    );
}

function PaymentMethodBadge({ paymentType }: { paymentType?: string | null }) {
    const label = formatPaymentMethodLabel(paymentType);
    if (label === '—') return <span className="text-sm text-gray-400">—</span>;

    return <AdminStatusBadge tone={getBookingPaymentMethodTone(paymentType)}>{label}</AdminStatusBadge>;
}

function BookingAmount({ value }: { value: unknown }) {
    const tone = bookingAmountTone(value);
    const className =
        tone === 'negative'
            ? 'font-semibold text-rose-600'
            : tone === 'positive'
              ? 'font-semibold text-gray-900'
              : 'font-medium text-gray-500';

    return <span className={`tabular-nums ${className}`}>{formatBookingAmount(value)}</span>;
}

function PersonCell({ name, meta }: { name: string; meta?: string }) {
    return (
        <div className="min-w-0 max-w-[168px]">
            <div className="truncate text-sm font-medium text-gray-900" title={name}>
                {name}
            </div>
            {meta && (
                <div className="mt-0.5 truncate text-xs text-gray-500" title={meta}>
                    {meta}
                </div>
            )}
        </div>
    );
}

interface BookingsTableProps {
    bookings: BookedService[];
    loading: boolean;
    deletingId: string | null;
    canWriteBookings: boolean;
    isLocalhost: boolean;
    onOpenDetail: (id: string) => void;
    onOpenIssues: (id: string) => void;
    onDelete: (id: string) => void;
    onDebug: (id: string) => void;
}

export function BookingsTable({
    bookings,
    loading,
    deletingId,
    canWriteBookings,
    isLocalhost,
    onOpenDetail,
    onOpenIssues,
    onDelete,
    onDebug,
}: BookingsTableProps) {
    if (!loading && bookings.length === 0) {
        return (
            <AdminTableShell>
                <AdminDataTableEmpty
                    title="No bookings found"
                    description="Try adjusting your search or filters."
                />
            </AdminTableShell>
        );
    }

    return (
        <AdminTableShell>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] table-fixed border-collapse text-left">
                    <colgroup>
                        <col className="w-[88px]" />
                        <col className="w-[132px]" />
                        <col className="w-[300px]" />
                        <col className="w-[156px]" />
                        <col className="w-[96px]" />
                        <col className="w-[80px]" />
                        <col className="w-[120px]" />
                        <col className="w-[72px]" />
                        <col className="w-[64px]" />
                        <col className="w-[128px]" />
                        <col className="w-[96px]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {['ID', 'Provider', 'Service', 'Customer', 'Amount', 'Method', 'Job', 'Payment', 'Issues', 'Created', ''].map(
                                (heading) => (
                                    <th
                                        key={heading || 'actions'}
                                        className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500"
                                    >
                                        {heading}
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {bookings.map((booking) => {
                            const bookingRecord = booking as unknown as Record<string, unknown>;
                            const anomalies = getBookingAnomalies(bookingRecord);
                            const hasErrorFlag = anomalies.some((item) => item.severity === 'error');
                            const hasWarningFlag = anomalies.some((item) => item.severity === 'warning');
                            const serviceName = resolveBookingServiceName(bookingRecord);
                            const serviceImage = resolveBookingServiceImage(bookingRecord);
                            const providerName = sanitizePersonDisplayName(getBookingProviderDisplayName(booking));
                            const customerName = sanitizePersonDisplayName(getBookingCustomerDisplayName(booking));

                            return (
                                <tr
                                    key={booking.id}
                                    className={`transition-colors hover:bg-gray-50/80 ${
                                        hasErrorFlag
                                            ? 'bg-rose-50/30'
                                            : hasWarningFlag
                                              ? 'bg-amber-50/20'
                                              : 'bg-white'
                                    }`}
                                >
                                    <td className="px-4 py-3 align-top">
                                        <button
                                            type="button"
                                            onClick={() => onOpenDetail(booking.id)}
                                            className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                                            title={booking.id}
                                        >
                                            #{formatBookingShortId(booking.id)}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PersonCell name={providerName || 'Unknown provider'} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-start gap-2.5">
                                            {serviceImage ? (
                                                <Image
                                                    src={serviceImage}
                                                    alt=""
                                                    width={36}
                                                    height={36}
                                                    className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                                                />
                                            ) : (
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 ring-1 ring-gray-200">
                                                    <Briefcase className="h-4 w-4 text-gray-400" />
                                                </div>
                                            )}
                                            <span
                                                className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900"
                                                title={serviceName}
                                            >
                                                {serviceName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PersonCell
                                            name={customerName || 'Unknown customer'}
                                            meta={booking.email || booking.phoneNumber || undefined}
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
                                        <BookingAmount value={booking.totalAmount ?? booking.price} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PaymentMethodBadge paymentType={booking.paymentType} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <JobStatusBadge status={booking.status} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <PaymentStatusBadge
                                            paymentStatus={booking.payment_status}
                                            paymentCompleted={booking.paymentCompleted}
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                                        <BookingFlagsCell booking={booking} onOpenIssues={onOpenIssues} />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-gray-600">
                                        {formatBookingTableDate(booking.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-center justify-end gap-1">
                                            <AdminIconActionButton
                                                onClick={() => onOpenDetail(booking.id)}
                                                aria-label="View booking details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </AdminIconActionButton>
                                            {canWriteBookings && (
                                                <AdminIconActionButton
                                                    tone="danger"
                                                    onClick={() => onDelete(booking.id)}
                                                    disabled={deletingId === booking.id}
                                                    aria-label="Delete booking"
                                                >
                                                    {deletingId === booking.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </AdminIconActionButton>
                                            )}
                                            {isLocalhost && (
                                                <AdminIconActionButton
                                                    tone="info"
                                                    onClick={() => onDebug(booking.id)}
                                                    aria-label="Debug booking"
                                                >
                                                    <Bug className="h-4 w-4" />
                                                </AdminIconActionButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </AdminTableShell>
    );
}
