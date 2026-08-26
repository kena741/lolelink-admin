'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StorageImage } from '@/components/StorageImage';
import {
    Archive,
    Check,
    ChevronDown,
    CreditCard,
    Loader2,
    MapPin,
    Trash2,
    Wallet,
} from 'lucide-react';
import {
    getBookingCustomerDisplayName,
    getBookingProviderDisplayName,
    type BookedService,
} from '@/features/bookedService/bookedServiceSlice';
import { isAdminBookerBooking } from '@/lib/admin-booker-customer';
import { formatServiceDiscountLabel } from '@/lib/service-discount';
import {
    formatBookingAddress,
    formatBookingAmount,
    formatBookingDateTime,
    formatBookingShortId,
    formatPaymentMethodLabel,
    getBookingAnomalies,
    customerBookingFundsHeld,
    hasBookingCustomerRefund,
    parseBookingAmount,
    parseBookingCoupon,
    resolveBookingServiceImage,
    resolveBookingServiceName,
    sanitizePersonDisplayName,
} from '@/lib/booking-display';
import {
    computeAdminCommissionFee,
    parseAdminCommissionConfig,
    resolveBookingAdminCommissionAmount,
    type AdminCommissionConfig,
} from '@/lib/booking-admin-commission';
import { computeProviderPayoutAmount } from '@/lib/booking-completion-payout';

import { formatDisplayPhone } from '@/lib/phone-display';
import { getSupabase } from '@/lib/supabaseClient';
import {
    BOOKING_JOB_STATUS_OPTIONS,
    formatBookingJobStatusLabel,
    formatBookingPaymentStatusLabel,
    type BookedServiceStatus,
} from '@/lib/booking-status';
import {
    getAdminStatusToneClasses,
    getBookingJobStatusTone,
    getBookingPaymentMethodTone,
    getBookingPaymentStatusTone,
} from '@/lib/admin-status-badge';
import { AdminStatusBadge } from '@/components/admin/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BookingIssuesPanel } from './BookingIssuesPanel';
import { cn } from '@/lib/utils';
import { isRecurringBooking } from '@/lib/recurring-payments';

interface WalletLedgerRow {
    id: string;
    amount: string | null;
    isCredit: boolean | null;
    note: string | null;
    type: string | null;
    paymentType: string | null;
    createdDate: string | null;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[minmax(0,110px)_1fr] items-start gap-3 py-2 sm:grid-cols-[minmax(0,132px)_1fr]">
            <dt className="text-[12px] font-medium text-gray-500">{label}</dt>
            <dd className="min-w-0 wrap-break-word text-[13px] text-gray-900">{value}</dd>
        </div>
    );
}

function Section({
    title,
    children,
    className,
    action,
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}) {
    return (
        <section className={cn('rounded-xl border border-gray-200 bg-white', className)}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
                {action}
            </div>
            <div className="px-4 py-3">{children}</div>
        </section>
    );
}

function PersonBlock({
    title,
    name,
    email,
    phone,
    idLabel,
    idValue,
    extra,
    badge,
}: {
    title: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    idLabel: string;
    idValue: string;
    extra?: React.ReactNode;
    badge?: string;
}) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
        <Section title={title}>
            <div className="mb-3 flex items-center gap-3">
                <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100"
                >
                    {initial}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{name || '—'}</p>
                    {badge ? (
                        <span className="mt-0.5 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                            {badge}
                        </span>
                    ) : null}
                    {email ? <p className="truncate text-xs text-gray-500">{email}</p> : null}
                </div>
            </div>
            <dl className="divide-y divide-gray-100">
                <MetaRow label="Phone" value={formatDisplayPhone(phone) || '—'} />
                <MetaRow label={idLabel} value={<span className="font-mono text-[12px] text-gray-700">{idValue}</span>} />
                {extra}
            </dl>
        </Section>
    );
}

function JobStatusBadge({ status }: { status?: string }) {
    return (
        <AdminStatusBadge tone={getBookingJobStatusTone(status)}>
            {formatBookingJobStatusLabel(status)}
        </AdminStatusBadge>
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
                    className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2',
                        'disabled:opacity-60',
                        toneClass
                    )}
                    aria-label="Change job status"
                >
                    {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {formatBookingJobStatusLabel(current)}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="z-110 w-56">
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
                                className={cn(
                                    'inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold',
                                    getAdminStatusToneClasses(getBookingJobStatusTone(option.value))
                                )}
                            >
                                {option.label}
                            </span>
                            {selected ? <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden /> : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function primaryButtonClassName(extra?: string) {
    return cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-[13px] font-semibold text-white',
        'transition-colors duration-150 hover:bg-indigo-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        extra
    );
}

function secondaryButtonClassName(extra?: string) {
    return cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700',
        'transition-colors duration-150 hover:bg-gray-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        extra
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
    onRecollectPayment,
    recollectingPayment = false,
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
    onRecollectPayment?: (id: string, mode: 'wallet' | 'mark_paid') => Promise<void>;
    recollectingPayment?: boolean;
    onUpdateStatus?: (
        id: string,
        status: BookedServiceStatus,
        options?: { applyCommission?: boolean }
    ) => Promise<void>;
    updatingStatus?: boolean;
}) {
    const [walletRows, setWalletRows] = useState<WalletLedgerRow[]>([]);
    const [walletLoading, setWalletLoading] = useState(false);
    const [commissionConfig, setCommissionConfig] = useState<AdminCommissionConfig | null>(null);
    const [deductCommissionOnComplete, setDeductCommissionOnComplete] = useState(false);
    const issuesSectionRef = useRef<HTMLElement>(null);

    const canVerifyChapa =
        Boolean(onVerifyPayment) &&
        Boolean(booking?.id) &&
        booking?.paymentCompleted !== true &&
        (booking?.payment_status ?? '') === 'pending_payment';

    const paymentStatusLower = (booking?.payment_status ?? '').toLowerCase();
    const isBookingUnpaid =
        Boolean(booking?.id) &&
        booking?.paymentCompleted !== true &&
        paymentStatusLower !== 'payment_completed';

    const needsRecollect =
        Boolean(onRecollectPayment) &&
        Boolean(booking?.id) &&
        (booking?.customer_refund_recorded === true ||
            hasBookingCustomerRefund(
                booking?.id ?? '',
                walletRows.filter((row) => row.isCredit === true)
            )) &&
        !customerBookingFundsHeld(booking?.id ?? '', walletRows);

    const canAdminMarkPaid = Boolean(onRecollectPayment) && isBookingUnpaid;

    const canEditStatus = Boolean(onUpdateStatus) && Boolean(booking?.id);

    const completePayoutPreview = (() => {
        if (!booking) return null;
        const gross =
            parseBookingAmount(booking.totalAmount) ?? parseBookingAmount(booking.price) ?? 0;
        if (!(gross > 0)) return null;
        const config = commissionConfig ?? { value: 0, isFix: false, active: false };
        const fee = deductCommissionOnComplete
            ? computeAdminCommissionFee(gross, config)
            : 0;
        const payout = computeProviderPayoutAmount(
            gross,
            config,
            deductCommissionOnComplete
        );
        return { gross, fee, payout };
    })();

    const changeJobStatus = (status: BookedServiceStatus) => {
        if (!booking || !onUpdateStatus) return;
        void onUpdateStatus(
            booking.id,
            status,
            status === 'completed' ? { applyCommission: deductCommissionOnComplete } : undefined
        );
    };

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void (async () => {
            try {
                const { data } = await getSupabase()
                    .from('app_settings')
                    .select('data')
                    .eq('id', 'admin_commission')
                    .maybeSingle();
                if (cancelled) return;
                setCommissionConfig(parseAdminCommissionConfig((data as { data?: unknown } | null)?.data));
            } catch {
                if (!cancelled) setCommissionConfig(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

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
    }, [open, booking?.id, booking?.paymentType, booking?.payment_id, booking?.paymentCompleted]);

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
    const commissionAmount =
        booking != null ? resolveBookingAdminCommissionAmount(booking, commissionConfig) : 0;
    const isArchived = booking?.is_archived === true;

    const snapshotItems = booking
        ? [
              {
                  label: 'Total',
                  value: (
                      <span
                          className={cn(
                              'font-semibold tabular-nums',
                              totalAmount !== null && totalAmount < 0 ? 'text-rose-600' : 'text-gray-900'
                          )}
                      >
                          {formatBookingAmount(booking.totalAmount ?? booking.price)}
                      </span>
                  ),
              },
              {
                  label: 'Method',
                  value: (
                      <AdminStatusBadge tone={getBookingPaymentMethodTone(booking.paymentType)}>
                          {formatPaymentMethodLabel(booking.paymentType)}
                      </AdminStatusBadge>
                  ),
              },
              {
                  label: 'Payment',
                  value: (
                      <AdminStatusBadge
                          tone={getBookingPaymentStatusTone(booking.payment_status, booking.paymentCompleted)}
                      >
                          {formatBookingPaymentStatusLabel(booking.payment_status, booking.paymentCompleted)}
                      </AdminStatusBadge>
                  ),
              },
              {
                  label: 'Job',
                  value: canEditStatus && onUpdateStatus ? (
                      <div className="flex flex-col items-start gap-2">
                          <JobStatusDropdown
                              status={booking.status}
                              updating={updatingStatus}
                              onChange={changeJobStatus}
                          />
                          {booking.status !== 'completed' ? (
                              <label className="flex max-w-xs items-start gap-2 text-[11px] leading-snug text-gray-600">
                                  <input
                                      type="checkbox"
                                      checked={deductCommissionOnComplete}
                                      onChange={(e) =>
                                          setDeductCommissionOnComplete(e.target.checked)
                                      }
                                      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                  />
                                  <span>
                                      On complete: deduct commission
                                      {completePayoutPreview ? (
                                          <span className="mt-0.5 block font-medium text-gray-800">
                                              Provider +
                                              {formatBookingAmount(completePayoutPreview.payout)}
                                              {deductCommissionOnComplete
                                                  ? ` (fee ${formatBookingAmount(completePayoutPreview.fee)})`
                                                  : ' full service'}
                                          </span>
                                      ) : null}
                                  </span>
                              </label>
                          ) : null}
                      </div>
                  ) : (
                      <JobStatusBadge status={booking.status} />
                  ),
              },
          ]
        : [];

    return (
        <Sheet open={open} onClose={onClose} widthClassName="w-full max-w-3xl lg:max-w-4xl">
            <SheetHeader onClose={onClose} className="border-gray-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                    {serviceImage ? (
                        <StorageImage
                            src={serviceImage}
                            alt=""
                            width={48}
                            height={48}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                        />
                    ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 ring-1 ring-gray-200">
                            <CreditCard className="h-5 w-5 text-gray-400" aria-hidden />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <SheetTitle>{loading ? 'Loading booking…' : serviceName}</SheetTitle>
                        {booking ? (
                            <SheetDescription>
                                <span className="inline-flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-medium text-gray-600">
                                        #{formatBookingShortId(booking.id)}
                                    </span>
                                    {isArchived ? (
                                        <span
                                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                                            title={booking.archive_note ?? 'Archived'}
                                        >
                                            <Archive className="h-3 w-3" aria-hidden />
                                            Archived
                                        </span>
                                    ) : null}
                                </span>
                                <span className="mt-1 block break-all font-mono text-[11px] text-gray-400">
                                    {booking.id}
                                </span>
                            </SheetDescription>
                        ) : null}
                    </div>
                </div>
            </SheetHeader>

            <SheetBody className="space-y-4 bg-gray-50/80 px-4 py-4 sm:px-6">
                {loading && !booking ? (
                    <div className="space-y-3" aria-busy="true" aria-label="Loading booking details">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-28 animate-pulse rounded-xl bg-white ring-1 ring-gray-100" />
                        ))}
                    </div>
                ) : null}

                {!loading && booking ? (
                    <>
                        <BookingIssuesPanel
                            ref={issuesSectionRef}
                            anomalies={anomalies}
                            highlighted={highlightIssues && anomalies.length > 0}
                        />

                        {needsRecollect && onRecollectPayment ? (
                            <div
                                role="status"
                                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                            >
                                <p className="text-[13px] font-medium text-amber-950">
                                    Customer was refunded. Re-collect payment before completing the job.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={recollectingPayment}
                                        onClick={() => void onRecollectPayment(booking.id, 'wallet')}
                                        className={primaryButtonClassName('h-9 px-3 text-xs')}
                                    >
                                        {recollectingPayment ? 'Working…' : 'Re-collect from wallet'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={recollectingPayment}
                                        onClick={() => void onRecollectPayment(booking.id, 'mark_paid')}
                                        className={secondaryButtonClassName('h-9 px-3 text-xs')}
                                    >
                                        Mark re-collected
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {canAdminMarkPaid && onRecollectPayment && !needsRecollect ? (
                            <div
                                role="status"
                                className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3"
                            >
                                <p className="text-[13px] font-medium text-indigo-950">
                                    {isAdminBookerBooking(booking)
                                        ? 'Admin booked — record offline payment. Provider is paid when you set status to Completed.'
                                        : 'Mark as paid records payment only. Provider wallet credit happens on Completed.'}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={recollectingPayment}
                                        onClick={() => void onRecollectPayment(booking.id, 'mark_paid')}
                                        className={primaryButtonClassName('h-9 px-3 text-xs')}
                                    >
                                        {recollectingPayment ? 'Working…' : 'Mark as paid (admin)'}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-4">
                            {snapshotItems.map((item) => (
                                <div key={item.label} className="bg-white px-3 py-3 sm:px-4">
                                    <p className="text-[11px] font-medium text-gray-500">{item.label}</p>
                                    <div className="mt-1.5 min-h-8 flex items-center">{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <PersonBlock
                                title="Customer"
                                name={sanitizePersonDisplayName(getBookingCustomerDisplayName(booking))}
                                email={booking.email}
                                phone={booking.phoneNumber}
                                idLabel="Customer ID"
                                idValue={booking.customer_id || '—'}
                                badge={isAdminBookerBooking(booking) ? 'Admin booked' : undefined}
                            />
                            <PersonBlock
                                title="Provider"
                                name={sanitizePersonDisplayName(getBookingProviderDisplayName(booking))}
                                email={booking.providerEmail}
                                phone={booking.providerPhone}
                                idLabel="Provider ID"
                                idValue={booking.provider_id}
                                extra={
                                    <MetaRow
                                        label="Assignment"
                                        value={booking.providerMySelf ? 'Provider (self)' : 'Other handyman'}
                                    />
                                }
                            />
                        </div>

                        <Section title="Financial breakdown">
                            <dl className="grid gap-x-6 sm:grid-cols-2">
                                <MetaRow label="List price" value={formatBookingAmount(booking.price)} />
                                <MetaRow label="Discount" value={formatServiceDiscountLabel(booking.discount)} />
                                <MetaRow label="Subtotal" value={formatBookingAmount(booking.subTotal)} />
                                <MetaRow
                                    label="Extra charge"
                                    value={formatBookingAmount(booking.extraChargeAmount)}
                                />
                                <MetaRow
                                    label="Coupon"
                                    value={
                                        coupon
                                            ? `${coupon.code ?? '—'} (${coupon.amount ?? '0'})${
                                                  coupon.active ? '' : ' · inactive'
                                              }`
                                            : '—'
                                    }
                                />
                                <MetaRow
                                    label="Admin commission"
                                    value={commissionAmount > 0 ? formatBookingAmount(commissionAmount) : '—'}
                                />
                                <div className="sm:col-span-2">
                                    <MetaRow
                                        label="Total"
                                        value={
                                            <span
                                                className={cn(
                                                    'text-sm font-semibold tabular-nums',
                                                    totalAmount !== null && totalAmount < 0
                                                        ? 'text-rose-600'
                                                        : 'text-gray-900'
                                                )}
                                            >
                                                {formatBookingAmount(booking.totalAmount ?? booking.price)}
                                            </span>
                                        }
                                    />
                                </div>
                            </dl>
                            {extraChargeModel ? (
                                <p className="mt-2 border-t border-gray-100 pt-3 text-[13px] text-gray-600">
                                    Extra charge note:{' '}
                                    {typeof extraChargeModel.chargeDetail === 'string'
                                        ? extraChargeModel.chargeDetail
                                        : '—'}
                                </p>
                            ) : null}
                        </Section>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Section title="Payment">
                                <dl className="divide-y divide-gray-100">
                                    <MetaRow
                                        label="Method"
                                        value={formatPaymentMethodLabel(booking.paymentType)}
                                    />
                                    <MetaRow
                                        label="Status"
                                        value={formatBookingPaymentStatusLabel(
                                            booking.payment_status,
                                            booking.paymentCompleted
                                        )}
                                    />
                                    <MetaRow
                                        label="Marked paid"
                                        value={booking.paymentCompleted ? 'Yes' : 'No'}
                                    />
                                    <MetaRow
                                        label="Pricing"
                                        value={
                                            isRecurringBooking(booking)
                                                ? 'Recurring'
                                                : 'One-time'
                                        }
                                    />
                                    <MetaRow
                                        label="Period start"
                                        value={formatBookingDateTime(booking.currentPeriodStart)}
                                    />
                                    <MetaRow
                                        label="Period end"
                                        value={formatBookingDateTime(booking.currentPeriodEnd)}
                                    />
                                    <MetaRow
                                        label="Next cycle due"
                                        value={booking.nextCycleDue === true ? 'Yes' : 'No'}
                                    />
                                    <MetaRow
                                        label="Payment ID"
                                        value={
                                            booking.payment_id ? (
                                                <span className="font-mono text-[12px]">{booking.payment_id}</span>
                                            ) : (
                                                '—'
                                            )
                                        }
                                    />
                                    {isArchived ? (
                                        <MetaRow
                                            label="Archive note"
                                            value={booking.archive_note?.trim() || 'Archived'}
                                        />
                                    ) : null}
                                </dl>
                            </Section>

                            <Section title="Job lifecycle">
                                <dl className="divide-y divide-gray-100">
                                    <MetaRow
                                        label="Status"
                                        value={
                                            canEditStatus && onUpdateStatus ? (
                                                <JobStatusDropdown
                                                    status={booking.status}
                                                    updating={updatingStatus}
                                                    onChange={changeJobStatus}
                                                />
                                            ) : (
                                                <JobStatusBadge status={booking.status} />
                                            )
                                        }
                                    />
                                    <MetaRow
                                        label="Booking date"
                                        value={formatBookingDateTime(booking.bookingDate)}
                                    />
                                    <MetaRow label="Created" value={formatBookingDateTime(booking.createdAt)} />
                                    <MetaRow label="Started" value={formatBookingDateTime(booking.startTime)} />
                                    <MetaRow label="Ended" value={formatBookingDateTime(booking.endTime)} />
                                    <MetaRow label="OTP" value={booking.otp || '—'} />
                                    <MetaRow label="Quantity" value={booking.quantity ?? '1'} />
                                </dl>
                            </Section>
                        </div>

                        <Section
                            title="Wallet ledger"
                            action={
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                                    <Wallet className="h-3.5 w-3.5" aria-hidden />
                                    This booking
                                </span>
                            }
                        >
                            {walletLoading ? (
                                <p className="text-[13px] text-gray-500">Loading wallet rows…</p>
                            ) : null}
                            {!walletLoading && walletRows.length === 0 ? (
                                <p className="text-[13px] text-gray-500">
                                    No wallet movements linked to this booking.
                                </p>
                            ) : null}
                            {!walletLoading && walletRows.length > 0 ? (
                                <div className="overflow-x-auto -mx-1">
                                    <table className="w-full min-w-120 text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                <th className="pb-2 pr-3 font-semibold">When</th>
                                                <th className="pb-2 pr-3 font-semibold">Dir</th>
                                                <th className="pb-2 pr-3 font-semibold">Amount</th>
                                                <th className="pb-2 pr-3 font-semibold">Type</th>
                                                <th className="pb-2 font-semibold">Note</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {walletRows.map((row) => (
                                                <tr key={row.id}>
                                                    <td className="whitespace-nowrap py-2.5 pr-3 text-gray-600">
                                                        {formatBookingDateTime(row.createdDate)}
                                                    </td>
                                                    <td className="py-2.5 pr-3">
                                                        <span
                                                            className={cn(
                                                                'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                                                                row.isCredit
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-rose-50 text-rose-700'
                                                            )}
                                                        >
                                                            {row.isCredit ? 'Credit' : 'Debit'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 pr-3 font-medium tabular-nums text-gray-900">
                                                        {formatBookingAmount(row.amount)}
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-gray-700">{row.type || '—'}</td>
                                                    <td className="py-2.5 text-gray-600">{row.note || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </Section>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Section
                                title="Location"
                                action={<MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden />}
                            >
                                <p className="text-[13px] leading-relaxed text-gray-800">
                                    {formatBookingAddress(booking.bookingAddress)}
                                </p>
                            </Section>
                            <Section title="Notes">
                                <dl className="divide-y divide-gray-100">
                                    <MetaRow
                                        label="Customer"
                                        value={booking.description?.trim() || '—'}
                                    />
                                    {booking.reason ? (
                                        <MetaRow label="Rejection" value={booking.reason} />
                                    ) : null}
                                </dl>
                            </Section>
                        </div>

                        {serviceImage ? (
                            <Section title="Service image">
                                <StorageImage
                                    src={serviceImage}
                                    alt=""
                                    width={800}
                                    height={300}
                                    className="h-44 w-full rounded-lg object-cover ring-1 ring-gray-100"
                                />
                            </Section>
                        ) : null}
                    </>
                ) : null}
            </SheetBody>

            <SheetFooter className="flex-wrap gap-2 border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {booking && needsRecollect && onRecollectPayment ? (
                        <>
                            <button
                                type="button"
                                onClick={() => void onRecollectPayment(booking.id, 'wallet')}
                                disabled={recollectingPayment}
                                className={primaryButtonClassName()}
                            >
                                {recollectingPayment ? 'Working…' : 'Re-collect from wallet'}
                            </button>
                            <button
                                type="button"
                                onClick={() => void onRecollectPayment(booking.id, 'mark_paid')}
                                disabled={recollectingPayment}
                                className={secondaryButtonClassName()}
                            >
                                Mark re-collected
                            </button>
                        </>
                    ) : null}
                    {booking && canAdminMarkPaid && onRecollectPayment && !needsRecollect ? (
                        <button
                            type="button"
                            onClick={() => void onRecollectPayment(booking.id, 'mark_paid')}
                            disabled={recollectingPayment}
                            className={primaryButtonClassName()}
                        >
                            {recollectingPayment ? 'Working…' : 'Mark as paid (admin)'}
                        </button>
                    ) : null}
                    {booking && canVerifyChapa && onVerifyPayment ? (
                        <button
                            type="button"
                            onClick={() => void onVerifyPayment(booking.id)}
                            disabled={verifyingPayment}
                            className={primaryButtonClassName()}
                        >
                            {verifyingPayment ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    Verifying…
                                </>
                            ) : (
                                'Verify Chapa payment'
                            )}
                        </button>
                    ) : null}
                    {booking && canDelete ? (
                        <button
                            type="button"
                            onClick={() => void onDelete(booking.id)}
                            disabled={deleting}
                            className={cn(
                                secondaryButtonClassName(),
                                'border-rose-200 text-rose-600 hover:bg-rose-50'
                            )}
                        >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                    ) : null}
                </div>
                <button type="button" onClick={onClose} className={secondaryButtonClassName('ml-auto')}>
                    Close
                </button>
            </SheetFooter>
        </Sheet>
    );
}
