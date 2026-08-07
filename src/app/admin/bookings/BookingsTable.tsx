'use client';

import { StorageImage } from '@/components/StorageImage';
import { Archive, Briefcase, Bug, Eye, Loader2, Trash2 } from 'lucide-react';
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
import {
    AdminDataTableEmpty,
    AdminIconActionButton,
    AdminStatusBadge,
    AdminTableShell,
} from '@/components/admin/data-table';
import { cn } from '@/lib/utils';

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
    return (
        <span
            className={cn(
                'tabular-nums text-sm',
                tone === 'negative' && 'font-semibold text-rose-600',
                tone === 'positive' && 'font-semibold text-gray-900',
                tone !== 'negative' && tone !== 'positive' && 'font-medium text-gray-500'
            )}
        >
            {formatBookingAmount(value)}
        </span>
    );
}

function PersonCell({ name, meta }: { name: string; meta?: string }) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
        <div className="flex min-w-0 max-w-44 items-start gap-2.5">
            <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200/80"
            >
                {initial}
            </span>
            <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900" title={name}>
                    {name}
                </div>
                {meta ? (
                    <div className="mt-0.5 truncate text-xs text-gray-500" title={meta}>
                        {meta}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="divide-y divide-gray-100" aria-hidden>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 px-4 py-4">
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
                    <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
                </div>
            ))}
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
    if (loading && bookings.length === 0) {
        return (
            <AdminTableShell>
                <TableSkeleton />
            </AdminTableShell>
        );
    }

    if (!loading && bookings.length === 0) {
        return (
            <AdminTableShell>
                <AdminDataTableEmpty
                    title="No bookings match"
                    description="Try a different search, clear filters, or show archived bookings."
                />
            </AdminTableShell>
        );
    }

    return (
        <AdminTableShell className="shadow-none">
            <div className="overflow-x-auto">
                <table className="w-full min-w-295 border-collapse text-left">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/90">
                            {[
                                'Booking',
                                'Service',
                                'Customer',
                                'Provider',
                                'Amount',
                                'Pay',
                                'Job',
                                'Payment',
                                'Flags',
                                'Created',
                                '',
                            ].map((heading) => (
                                <th
                                    key={heading || 'actions'}
                                    scope="col"
                                    className="sticky top-0 z-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500 first:pl-4 last:pr-4"
                                >
                                    {heading}
                                </th>
                            ))}
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
                            const providerName =
                                sanitizePersonDisplayName(getBookingProviderDisplayName(booking)) ||
                                'Unknown provider';
                            const customerName =
                                sanitizePersonDisplayName(getBookingCustomerDisplayName(booking)) ||
                                'Unknown customer';
                            const isArchived = booking.is_archived === true;
                            const isDeleting = deletingId === booking.id;

                            return (
                                <tr
                                    key={booking.id}
                                    tabIndex={0}
                                    onClick={() => onOpenDetail(booking.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onOpenDetail(booking.id);
                                        }
                                    }}
                                    className={cn(
                                        'group cursor-pointer transition-colors duration-150',
                                        'focus-visible:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300',
                                        isArchived && 'opacity-75',
                                        hasErrorFlag
                                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                            : hasWarningFlag
                                              ? 'bg-amber-50/30 hover:bg-amber-50/55'
                                              : 'bg-white hover:bg-gray-50/90'
                                    )}
                                >
                                    <td className="px-3 py-3 pl-4 align-middle">
                                        <div className="flex flex-col gap-1">
                                            <span
                                                className="font-mono text-xs font-semibold text-indigo-600 group-hover:text-indigo-800"
                                                title={booking.id}
                                            >
                                                #{formatBookingShortId(booking.id)}
                                            </span>
                                            {isArchived ? (
                                                <span
                                                    className="inline-flex w-fit items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                                                    title={booking.archive_note ?? 'Archived'}
                                                >
                                                    <Archive className="h-3 w-3" aria-hidden />
                                                    Archived
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <div className="flex min-w-0 max-w-60 items-center gap-2.5">
                                            {serviceImage ? (
                                                <StorageImage
                                                    src={serviceImage}
                                                    alt=""
                                                    width={36}
                                                    height={36}
                                                    className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                                                />
                                            ) : (
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 ring-1 ring-gray-200">
                                                    <Briefcase className="h-4 w-4 text-gray-400" aria-hidden />
                                                </div>
                                            )}
                                            <span
                                                className="min-w-0 truncate text-sm font-medium text-gray-900"
                                                title={serviceName}
                                            >
                                                {serviceName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <PersonCell
                                            name={customerName}
                                            meta={booking.email || booking.phoneNumber || undefined}
                                        />
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <PersonCell name={providerName} />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 align-middle">
                                        <BookingAmount value={booking.totalAmount ?? booking.price} />
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <PaymentMethodBadge paymentType={booking.paymentType} />
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <JobStatusBadge status={booking.status} />
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <PaymentStatusBadge
                                            paymentStatus={booking.payment_status}
                                            paymentCompleted={booking.paymentCompleted}
                                        />
                                    </td>
                                    <td
                                        className="whitespace-nowrap px-3 py-3 align-middle"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <BookingFlagsCell booking={booking} onOpenIssues={onOpenIssues} />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 align-middle text-xs text-gray-500">
                                        {formatBookingTableDate(booking.createdAt)}
                                    </td>
                                    <td
                                        className="px-3 py-3 pr-4 align-middle"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                            <AdminIconActionButton
                                                onClick={() => onOpenDetail(booking.id)}
                                                aria-label="View booking details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </AdminIconActionButton>
                                            {canWriteBookings ? (
                                                <AdminIconActionButton
                                                    tone="danger"
                                                    onClick={() => onDelete(booking.id)}
                                                    disabled={isDeleting}
                                                    aria-label="Delete booking"
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </AdminIconActionButton>
                                            ) : null}
                                            {isLocalhost ? (
                                                <AdminIconActionButton
                                                    tone="info"
                                                    onClick={() => onDebug(booking.id)}
                                                    aria-label="Debug booking"
                                                >
                                                    <Bug className="h-4 w-4" />
                                                </AdminIconActionButton>
                                            ) : null}
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
