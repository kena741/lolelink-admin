import {
    isActivationCredit,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '@/lib/wallet-transaction-metrics';
import { BOOKING_PAYMENT_STATUS, resolveBookingPaymentStatus } from '@/lib/booking-status';
import { CHAPA_DOMESTIC_FEE_RATE } from '@/lib/chapa-config';

export type DashboardRevenueCategory =
    | 'total'
    | 'activation_fee'
    | 'commission'
    | 'boost_featured'
    | 'customer_job_post'
    | 'ads';

export interface DashboardRevenueBreakdown {
    total: number;
    activationFee: number;
    commission: number;
    boostFeatured: number;
    customerJobPost: number;
    ads: number;
}

export interface DashboardWalletRow extends WalletTransactionMetricRow {
    id?: string | null;
}

export interface DashboardBookingCommissionRow {
    id?: string | null;
    status?: string | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    adminCommission?: string | number | null;
    serviceName?: string | null;
    customerName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    createdAt?: string | null;
}

export interface DashboardJobRequestRow {
    id?: string | null;
    createdAt?: string | null;
    is_paid?: boolean | null;
    price?: string | number | null;
    title?: string | null;
    status?: string | null;
}

export interface DashboardRevenueTransactionLine {
    id: string;
    bucket: Exclude<DashboardRevenueCategory, 'total'>;
    occurredAt: string | null;
    amount: number;
    title: string;
    subtitle: string;
    reference: string;
}

export const DASHBOARD_REVENUE_CATEGORY_LABELS: Record<DashboardRevenueCategory, string> = {
    total: 'Total',
    activation_fee: 'Activation fee',
    commission: 'Commission',
    boost_featured: 'Boost/Featured',
    customer_job_post: 'Customer job Post',
    ads: 'Ads',
};

export const DASHBOARD_REVENUE_BUCKET_LABELS: Record<
    Exclude<DashboardRevenueCategory, 'total'>,
    string
> = {
    activation_fee: 'Activation fee',
    commission: 'Commission',
    boost_featured: 'Boost/Featured',
    customer_job_post: 'Customer job Post',
    ads: 'Ads',
};

function normalizeNote(row: WalletTransactionMetricRow): string {
    return (row.note ?? '').toLowerCase();
}

function isServiceListingUpgrade(note: string): boolean {
    return note.includes('service listing plan upgrade') || note.includes('listing plan upgrade');
}

/** Mobile often writes featured Chapa fees as provider debits, not platform credits. */
function isFeaturedRequestPaymentNote(note: string): boolean {
    return (
        note.includes('featured request payment')
        || note.includes('featured request')
        || (note.includes('featured') && note.includes('payment') && note.includes('service='))
    );
}

export function isBoostFeaturedWalletCredit(row: WalletTransactionMetricRow): boolean {
    const note = normalizeNote(row);
    if (isServiceListingUpgrade(note)) return false;
    if (isFeaturedRequestPaymentNote(note)) return true;
    if (row.isCredit !== true) return false;
    return (
        note.includes('featured post')
        || note.includes('featured psot')
        || note.includes('featured')
        || note.includes('boost')
    );
}

/** Platform revenue after Chapa fee. Gross featured fees (e.g. 500) → net (487.50). */
export function boostFeaturedRevenueAmount(row: WalletTransactionMetricRow): number {
    if (!isBoostFeaturedWalletCredit(row)) return 0;
    const magnitude = walletTransactionMagnitude(row.amount);
    if (magnitude <= 0) return 0;
    const note = normalizeNote(row);
    if (note.includes('net after fee')) return magnitude;
    if (isFeaturedRequestPaymentNote(note)) {
        return Math.round(magnitude * (1 - CHAPA_DOMESTIC_FEE_RATE) * 100) / 100;
    }
    return magnitude;
}

export function isActivationFeeWalletCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    if (isServiceListingUpgrade(normalizeNote(row))) return true;
    if (!isActivationCredit(row)) return false;
    return !isBoostFeaturedWalletCredit(row);
}

export function isAdsWalletCredit(row: WalletTransactionMetricRow): boolean {
    if (row.isCredit !== true) return false;
    const note = normalizeNote(row);
    return (
        note.includes('banner ad')
        || note.includes('ad purchase')
        || note.includes('advertisement')
        || (note.includes(' ad ') && !note.includes('admin'))
        || note.startsWith('ad ')
    );
}

function sumWalletCredits(
    rows: WalletTransactionMetricRow[],
    matcher: (row: WalletTransactionMetricRow) => boolean
): number {
    return rows.reduce((sum, row) => {
        if (!matcher(row)) return sum;
        return sum + walletTransactionMagnitude(row.amount);
    }, 0);
}

function sumBoostFeaturedRevenue(rows: WalletTransactionMetricRow[]): number {
    return rows.reduce((sum, row) => sum + boostFeaturedRevenueAmount(row), 0);
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isCompletedBooking(status: string | null | undefined): boolean {
    const normalized = (status ?? '').trim().toLowerCase();
    return normalized === 'completed' || normalized === 'service_completion_approved_by_customer';
}

function isCustomerPaymentDone(row: DashboardBookingCommissionRow): boolean {
    if (row.paymentCompleted === true) return true;
    const resolved = resolveBookingPaymentStatus(row.payment_status ?? '', row.paymentCompleted);
    return (
        resolved === BOOKING_PAYMENT_STATUS.COMPLETED ||
        resolved === 'payment_approved_by_admin'
    );
}

function bookingGrossAmount(row: DashboardBookingCommissionRow): number {
    return parseAmount(row.totalAmount ?? row.price);
}

export function bookingCommissionAmount(row: DashboardBookingCommissionRow): number {
    const storedCommission = parseAmount(row.adminCommission);
    if (storedCommission > 0) return storedCommission;

    const gross = bookingGrossAmount(row);
    if (gross <= 0) return 0;
    return Math.round(gross * 0.1 * 100) / 100;
}

export function isBookingCommissionRevenueRow(row: DashboardBookingCommissionRow): boolean {
    if (!isCompletedBooking(row.status)) return false;
    if (!isCustomerPaymentDone(row)) return false;
    return bookingCommissionAmount(row) > 0;
}

export function sumBookingCommissionRevenue(rows: DashboardBookingCommissionRow[]): number {
    return rows.reduce((sum, row) => {
        if (!isBookingCommissionRevenueRow(row)) return sum;
        return sum + bookingCommissionAmount(row);
    }, 0);
}

export function sumCustomerJobPostRevenue(rows: DashboardJobRequestRow[]): number {
    return rows.reduce((sum, row) => {
        if (row.is_paid !== true) return sum;
        return sum + parseAmount(row.price);
    }, 0);
}

function resolveWalletRowId(row: DashboardWalletRow, index: number): string {
    if (typeof row.id === 'string' && row.id.trim()) return row.id.trim();
    const transactionId = (row.transactionId ?? '').trim();
    if (transactionId) return `wallet:${transactionId}`;
    return `wallet:${row.createdDate ?? 'unknown'}:${index}`;
}

function resolveBookingCustomerName(row: DashboardBookingCommissionRow): string {
    if (typeof row.customerName === 'string' && row.customerName.trim()) {
        return row.customerName.trim();
    }
    return [row.firstName, row.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();
}

function walletRowToLine(
    row: DashboardWalletRow,
    bucket: Exclude<DashboardRevenueCategory, 'total'>,
    index: number
): DashboardRevenueTransactionLine {
    const note = (row.note ?? '').trim();
    const reference = (row.transactionId ?? '').trim();
    const amount =
        bucket === 'boost_featured'
            ? boostFeaturedRevenueAmount(row)
            : walletTransactionMagnitude(row.amount);
    return {
        id: resolveWalletRowId(row, index),
        bucket,
        occurredAt: row.createdDate ?? null,
        amount,
        title: note || DASHBOARD_REVENUE_BUCKET_LABELS[bucket],
        subtitle: reference ? `Ref ${reference}` : 'Wallet credit',
        reference: reference || resolveWalletRowId(row, index),
    };
}

function bookingRowToLine(row: DashboardBookingCommissionRow): DashboardRevenueTransactionLine {
    const serviceName = (row.serviceName ?? '').trim() || 'Booking';
    const customerName = resolveBookingCustomerName(row);
    const bookingId = (row.id ?? '').trim();
    return {
        id: bookingId ? `booking:${bookingId}` : `booking:${row.createdAt ?? 'unknown'}`,
        bucket: 'commission',
        occurredAt: row.createdAt ?? null,
        amount: bookingCommissionAmount(row),
        title: serviceName,
        subtitle: customerName ? `Customer ${customerName}` : 'Completed paid booking',
        reference: bookingId ? bookingId.slice(0, 8) : '—',
    };
}

function jobRequestRowToLine(row: DashboardJobRequestRow): DashboardRevenueTransactionLine {
    const title = (row.title ?? '').trim() || 'Job request';
    const jobId = (row.id ?? '').trim();
    return {
        id: jobId ? `job:${jobId}` : `job:${row.createdAt ?? 'unknown'}`,
        bucket: 'customer_job_post',
        occurredAt: row.createdAt ?? null,
        amount: parseAmount(row.price),
        title,
        subtitle: typeof row.status === 'string' && row.status.trim()
            ? `Status ${row.status.trim()}`
            : 'Paid job post',
        reference: jobId ? jobId.slice(0, 8) : '—',
    };
}

function compareLinesByDateDesc(
    left: DashboardRevenueTransactionLine,
    right: DashboardRevenueTransactionLine
): number {
    const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
    const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
}

export function buildDashboardRevenueTransactionLines(
    category: DashboardRevenueCategory,
    input: {
        walletRows: DashboardWalletRow[];
        bookings: DashboardBookingCommissionRow[];
        jobRequests: DashboardJobRequestRow[];
    }
): DashboardRevenueTransactionLine[] {
    const activationLines = input.walletRows
        .filter(isActivationFeeWalletCredit)
        .map((row, index) => walletRowToLine(row, 'activation_fee', index));
    const boostLines = input.walletRows
        .filter(isBoostFeaturedWalletCredit)
        .map((row, index) => walletRowToLine(row, 'boost_featured', index));
    const adsLines = input.walletRows
        .filter(isAdsWalletCredit)
        .map((row, index) => walletRowToLine(row, 'ads', index));
    const commissionLines = input.bookings
        .filter(isBookingCommissionRevenueRow)
        .map((row) => bookingRowToLine(row));
    const jobPostLines = input.jobRequests
        .filter((row) => row.is_paid === true)
        .map((row) => jobRequestRowToLine(row));

    if (category === 'activation_fee') return activationLines.sort(compareLinesByDateDesc);
    if (category === 'boost_featured') return boostLines.sort(compareLinesByDateDesc);
    if (category === 'ads') return adsLines.sort(compareLinesByDateDesc);
    if (category === 'commission') return commissionLines.sort(compareLinesByDateDesc);
    if (category === 'customer_job_post') return jobPostLines.sort(compareLinesByDateDesc);

    return [
        ...activationLines,
        ...boostLines,
        ...adsLines,
        ...commissionLines,
        ...jobPostLines,
    ].sort(compareLinesByDateDesc);
}

export function sumDashboardRevenueTransactionLines(
    lines: DashboardRevenueTransactionLine[]
): number {
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return Math.round(total * 100) / 100;
}

export function computeDashboardRevenueBreakdown(input: {
    walletRows: DashboardWalletRow[];
    bookings: DashboardBookingCommissionRow[];
    jobRequests: DashboardJobRequestRow[];
}): DashboardRevenueBreakdown {
    const activationFee = sumWalletCredits(input.walletRows, isActivationFeeWalletCredit);
    const boostFeatured = sumBoostFeaturedRevenue(input.walletRows);
    const ads = sumWalletCredits(input.walletRows, isAdsWalletCredit);
    const commission = sumBookingCommissionRevenue(input.bookings);
    const customerJobPost = sumCustomerJobPostRevenue(input.jobRequests);

    const total = Math.round(
        (activationFee + commission + boostFeatured + customerJobPost + ads) * 100
    ) / 100;

    return {
        total,
        activationFee: Math.round(activationFee * 100) / 100,
        commission: Math.round(commission * 100) / 100,
        boostFeatured: Math.round(boostFeatured * 100) / 100,
        customerJobPost: Math.round(customerJobPost * 100) / 100,
        ads: Math.round(ads * 100) / 100,
    };
}
