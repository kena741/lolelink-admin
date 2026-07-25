'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StorageImage } from '@/components/StorageImage';
import { Check, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import {
    getBookingCustomerDisplayName,
    getBookingProviderDisplayName,
    type BookedService,
} from '@/features/bookedService/bookedServiceSlice';
import { formatServiceDiscountLabel } from '@/lib/service-discount';
import {
    formatBookingAddress,
    formatBookingAmount,
    formatBookingDateTime,
    formatBookingShortId,
    formatPaymentMethodLabel,
    getBookingAnomalies,
    parseBookingAmount,
    parseBookingCoupon,
    resolveBookingServiceImage,
    resolveBookingServiceName,
    sanitizePersonDisplayName,
} from '@/lib/booking-display';
import { getSupabase } from '@/lib/supabaseClient';
import {
    BOOKING_JOB_STATUS_OPTIONS,
    formatBookingJobStatusLabel,
    type BookedServiceStatus,
} from '@/lib/booking-status';
import { getAdminStatusToneClasses, getBookingJobStatusTone } from '@/lib/admin-status-badge';
import { AdminStatusBadge } from '@/components/admin/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BookingIssuesPanel } from './BookingIssuesPanel';

interface WalletLedgerRow {
    id: string;
    amount: string | null;
    isCredit: boolean | null;
    note: string | null;
    type: string | null;
    paymentType: string | null;
    createdDate: string | null;
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[13px] font-semibold text-gray-500">{label}</div>
            <div className="mt-1 text-[14px] text-gray-900">{value}</div>
        </div>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-[16px] font-bold text-gray-900">{title}</h4>
            {children}
        </section>
    );
}

function JobStatusBadge({ status }: { status?: string }) {
    return (
        <AdminStatusBadge tone={getBookingJobStatusTone(status)}>{formatBookingJobStatusLabel(status)}</AdminStatusBadge>
    );
}

function JobStatusDropdown({
    status,
    disabled,
    updating,
    onChange,
}: {
    status?: string;
    disabled?: boolean;
    updating?: boolean;
    onChange: (status: BookedServiceStatus) => void;
}) {
    const current = status ?? 'pending';
    const toneClass = getAdminStatusToneClasses(getBookingJobStatusTone(current));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled || updating}>
                <button
                    type="button"
                    className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 disabled:opacity-60 ${toneClass}`}
                    aria-label="Change job status"
                >
                    {updating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {formatBookingJobStatusLabel(current)}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="z-[110] w-56">
                {BOOKING_JOB_STATUS_OPTIONS.map((option) => {
                    const selected = option.value === current;
                    return (
                        <DropdownMenuItem
                            key={option.value}
                            onSelect={() => {
                                if (!selected) onChange(option.value);
                            }}
                            className="justify-between gap-3"
                        >
                            <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold ${getAdminStatusToneClasses(getBookingJobStatusTone(option.value))}`}
                            >
                                {option.label}
                            </span>
                            {selected ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function BookingDetailModal({
    open,
    booking,
    loading,
    highlightIssues = false,
    onClose,
    onDelete,
    deleting,
    canDelete,
    onVerifyPayment,
    verifyingPayment = false,
    onUpdateStatus,
    updatingStatus = false,
}: {
    open: boolean;
    booking: BookedService | null;
    loading: boolean;
    highlightIssues?: boolean;
    onClose: () => void;
    onDelete: (id: string) => Promise<void>;
    deleting: boolean;
    canDelete: boolean;
    onVerifyPayment?: (id: string) => Promise<void>;
    verifyingPayment?: boolean;
    onUpdateStatus?: (id: string, status: BookedServiceStatus) => Promise<void>;
    updatingStatus?: boolean;
}) {
    const [walletRows, setWalletRows] = useState<WalletLedgerRow[]>([]);
    const [walletLoading, setWalletLoading] = useState(false);
    const issuesSectionRef = useRef<HTMLElement>(null);

    const canVerifyChapa =
        Boolean(onVerifyPayment) &&
        Boolean(booking?.id) &&
        booking?.paymentCompleted !== true &&
        (booking?.payment_status ?? '') === 'pending_payment';

    const canEditStatus = Boolean(onUpdateStatus) && Boolean(booking?.id);

    useEffect(() => {
        if (!open || !booking?.id) {
            setWalletRows([]);
            return;
        }

        let cancelled = false;

        const bookingId = booking.id;

        async function loadWalletRows() {
            setWalletLoading(true);
            try {
                const { data, error } = await getSupabase()
                    .from('wallet_transaction')
                    .select('id, amount, isCredit, note, type, paymentType, createdDate')
                    .eq('transactionId', bookingId)
                    .order('createdDate', { ascending: true });

                if (cancelled) return;
                if (error) throw error;
                setWalletRows((data ?? []) as WalletLedgerRow[]);
            } catch {
                if (!cancelled) setWalletRows([]);
            } finally {
                if (!cancelled) setWalletLoading(false);
            }
        }

        void loadWalletRows();

        return () => {
            cancelled = true;
        };
    }, [open, booking?.id]);

    const bookingRecord = booking as unknown as Record<string, unknown>;
    const anomalies = booking ? getBookingAnomalies(bookingRecord) : [];

    useEffect(() => {
        if (!open || loading || !highlightIssues || anomalies.length === 0) return;

        const frame = window.requestAnimationFrame(() => {
            issuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [open, loading, highlightIssues, anomalies.length, booking?.id]);

    if (!open) return null;

    const serviceName = booking ? resolveBookingServiceName(bookingRecord) : '—';
    const serviceImage = booking ? resolveBookingServiceImage(bookingRecord) : null;
    const coupon = booking ? parseBookingCoupon(booking.coupon) : null;
    const extraChargeModel =
        booking?.extraChargeModel && typeof booking.extraChargeModel === 'object'
            ? (booking.extraChargeModel as Record<string, unknown>)
            : null;
    const totalAmount = booking ? parseBookingAmount(booking.totalAmount ?? booking.price) : null;

    return (
        <Sheet open={open} onClose={onClose} widthClassName="w-full max-w-3xl lg:max-w-4xl">
            <SheetHeader onClose={onClose}>
                <SheetTitle>{serviceName}</SheetTitle>
                {booking && (
                    <SheetDescription>
                        <span className="font-mono text-xs">#{formatBookingShortId(booking.id)}</span>
                        <span className="mt-1 block break-all font-mono text-xs text-gray-400">{booking.id}</span>
                    </SheetDescription>
                )}
            </SheetHeader>

            <SheetBody className="space-y-4 bg-gray-50/50">
                    {loading && <div className="text-[14px] text-gray-500">Loading booking…</div>}

                    {!loading && booking && (
                        <>
                            <BookingIssuesPanel
                                ref={issuesSectionRef}
                                anomalies={anomalies}
                                highlighted={highlightIssues && anomalies.length > 0}
                            />

                            <div className="grid gap-4 md:grid-cols-2">
                                <SectionCard title="Customer">
                                    <div className="space-y-3">
                                        <DetailField label="Name" value={sanitizePersonDisplayName(getBookingCustomerDisplayName(booking)) || '—'} />
                                        <DetailField label="Email" value={booking.email || '—'} />
                                        <DetailField
                                            label="Phone"
                                            value={
                                                booking.countryCode && booking.phoneNumber
                                                    ? `${booking.countryCode} ${booking.phoneNumber}`
                                                    : booking.phoneNumber || '—'
                                            }
                                        />
                                        <DetailField
                                            label="Customer ID"
                                            value={<span className="font-mono text-[13px]">{booking.customer_id || '—'}</span>}
                                        />
                                    </div>
                                </SectionCard>

                                <SectionCard title="Provider">
                                    <div className="space-y-3">
                                        <DetailField label="Name" value={sanitizePersonDisplayName(getBookingProviderDisplayName(booking)) || '—'} />
                                        <DetailField
                                            label="Provider ID"
                                            value={<span className="font-mono text-[13px]">{booking.provider_id}</span>}
                                        />
                                        <DetailField
                                            label="Handyman assignment"
                                            value={booking.providerMySelf ? 'Provider (self)' : 'Other handyman'}
                                        />
                                    </div>
                                </SectionCard>
                            </div>

                            <SectionCard title="Financial breakdown">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <DetailField label="List price" value={formatBookingAmount(booking.price)} />
                                    <DetailField label="Discount" value={formatServiceDiscountLabel(booking.discount)} />
                                    <DetailField label="Subtotal" value={formatBookingAmount(booking.subTotal)} />
                                    <DetailField label="Extra charge" value={formatBookingAmount(booking.extraChargeAmount)} />
                                    <DetailField
                                        label="Coupon"
                                        value={
                                            coupon
                                                ? `${coupon.code ?? '—'} (${coupon.amount ?? '0'})${coupon.active ? '' : ' · inactive'}`
                                                : '—'
                                        }
                                    />
                                    <DetailField label="Admin commission" value={booking.adminCommission ?? '—'} />
                                    <DetailField
                                        label="Total"
                                        value={
                                            <span
                                                className={
                                                    totalAmount !== null && totalAmount < 0
                                                        ? 'font-bold text-red-600'
                                                        : 'font-bold text-gray-900'
                                                }
                                            >
                                                {formatBookingAmount(booking.totalAmount ?? booking.price)}
                                            </span>
                                        }
                                    />
                                </div>
                                {extraChargeModel && (
                                    <p className="mt-3 text-[14px] text-gray-600">
                                        Extra charge note:{' '}
                                        {typeof extraChargeModel.chargeDetail === 'string'
                                            ? extraChargeModel.chargeDetail
                                            : '—'}
                                    </p>
                                )}
                            </SectionCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <SectionCard title="Payment">
                                    <div className="space-y-3">
                                        <DetailField label="Method" value={formatPaymentMethodLabel(booking.paymentType)} />
                                        <DetailField label="Payment status" value={booking.payment_status || '—'} />
                                        <DetailField
                                            label="paymentCompleted"
                                            value={booking.paymentCompleted ? 'true' : 'false'}
                                        />
                                        <DetailField
                                            label="Payment ID"
                                            value={
                                                booking.payment_id ? (
                                                    <span className="font-mono text-[13px]">{booking.payment_id}</span>
                                                ) : (
                                                    '—'
                                                )
                                            }
                                        />
                                    </div>
                                </SectionCard>

                                <SectionCard title="Job lifecycle">
                                    <div className="space-y-3">
                                        <DetailField
                                            label="Job status"
                                            value={
                                                canEditStatus && onUpdateStatus && booking ? (
                                                    <JobStatusDropdown
                                                        status={booking.status}
                                                        updating={updatingStatus}
                                                        onChange={(status) => {
                                                            void onUpdateStatus(booking.id, status);
                                                        }}
                                                    />
                                                ) : (
                                                    <JobStatusBadge status={booking.status} />
                                                )
                                            }
                                        />
                                        <DetailField label="Booking date" value={formatBookingDateTime(booking.bookingDate)} />
                                        <DetailField label="Created" value={formatBookingDateTime(booking.createdAt)} />
                                        <DetailField label="Started" value={formatBookingDateTime(booking.startTime)} />
                                        <DetailField label="Ended" value={formatBookingDateTime(booking.endTime)} />
                                        <DetailField label="OTP" value={booking.otp || '—'} />
                                        <DetailField label="Quantity" value={booking.quantity ?? '1'} />
                                    </div>
                                </SectionCard>
                            </div>

                            <SectionCard title="Wallet ledger (this booking)">
                                {walletLoading && <p className="text-[14px] text-gray-500">Loading wallet rows…</p>}
                                {!walletLoading && walletRows.length === 0 && (
                                    <p className="text-[14px] text-gray-500">No wallet_transaction rows for this booking ID.</p>
                                )}
                                {!walletLoading && walletRows.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[14px]">
                                            <thead>
                                                <tr className="border-b border-gray-200 text-[13px] font-semibold text-gray-500">
                                                    <th className="py-2 pr-3">When</th>
                                                    <th className="py-2 pr-3">Direction</th>
                                                    <th className="py-2 pr-3">Amount</th>
                                                    <th className="py-2 pr-3">Type</th>
                                                    <th className="py-2">Note</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {walletRows.map((row) => (
                                                    <tr key={row.id} className="border-b border-gray-100">
                                                        <td className="py-2 pr-3 whitespace-nowrap">
                                                            {formatBookingDateTime(row.createdDate)}
                                                        </td>
                                                        <td className="py-2 pr-3">
                                                            {row.isCredit ? 'Credit' : 'Debit'}
                                                        </td>
                                                        <td className="py-2 pr-3 font-medium tabular-nums">
                                                            {formatBookingAmount(row.amount)}
                                                        </td>
                                                        <td className="py-2 pr-3">{row.type || '—'}</td>
                                                        <td className="py-2">{row.note || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </SectionCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <SectionCard title="Location">
                                    <DetailField label="Address" value={formatBookingAddress(booking.bookingAddress)} />
                                </SectionCard>

                                <SectionCard title="Notes">
                                    <DetailField label="Customer note" value={booking.description?.trim() || '—'} />
                                    {booking.reason && (
                                        <div className="mt-3">
                                            <DetailField label="Rejection reason" value={booking.reason} />
                                        </div>
                                    )}
                                </SectionCard>
                            </div>

                            {serviceImage && (
                                <SectionCard title="Service image">
                                    <StorageImage
                                        src={serviceImage}
                                        alt="service"
                                        width={800}
                                        height={300}
                                        className="h-48 w-full rounded-md object-cover"
                                    />
                                </SectionCard>
                            )}
                        </>
                    )}
            </SheetBody>

            <SheetFooter>
                    {booking && canVerifyChapa && onVerifyPayment && (
                        <button
                            type="button"
                            onClick={() => void onVerifyPayment(booking.id)}
                            disabled={verifyingPayment}
                            className="inline-flex h-10 items-center rounded-md bg-accent-primary px-4 text-[14px] font-medium text-text-inverse hover:bg-accent-primary-hover disabled:opacity-50"
                        >
                            {verifyingPayment ? 'Verifying…' : 'Verify Chapa payment'}
                        </button>
                    )}
                    {booking && canDelete && (
                        <button
                            type="button"
                            onClick={() => void onDelete(booking.id)}
                            disabled={deleting}
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-[14px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto h-10 rounded-md border border-gray-200 bg-white px-4 text-[14px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Close
                    </button>
            </SheetFooter>
        </Sheet>
    );
}
