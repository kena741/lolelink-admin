'use client';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getSupabase } from '@/lib/supabaseClient';
import { fetchProviders, Provider, ProviderState } from '@/features/provider/providerSlice';
import { AppDispatch } from '@/store/store';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader from '@/components/AdminPageHeader';
import { 
    Users, 
    CalendarCheck2, 
    Activity, 
    ArrowUpRight, 
    TrendingUp, 
    TrendingDown,
    DollarSign,
    CheckCircle2,
    Clock,
    XCircle,
    Zap,
    BarChart3,
    CircleHelp
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookedService } from '@/features/bookedService/bookedServiceSlice';
import {
    computeWalletMetrics,
    computeWalletDashboardBreakdown,
    parseWalletAmount,
    sumChapaNetFlow,
    sumDebits,
    sumManualActivationCredits,
    sumNonChapaNetFlow,
    type WalletDashboardBreakdown,
    type WalletTransactionMetricRow,
} from '@/lib/wallet-transaction-metrics';
import { DashboardBarChart } from '@/components/admin/dashboard-bar-chart';
import { WalletMetricBreakdownDebug } from '@/components/admin/wallet-metric-breakdown-debug';
import { useWalletMetricsDebugVisible } from '@/hooks/use-wallet-metrics-debug-visible';

interface ChartBucket {
    label: string;
    value: number;
}

interface AnalyticsData {
    totalRevenue: number;
    totalCredit: number;
    totalNetFlow: number;
    totalWalletCreditsAdjusted: number;
    totalWalletDebits: number;
    chapaWalletNet: number;
    chapaAvailableBalance: number | null;
    chapaLedgerBalance: number | null;
    nonChapaWalletNet: number;
    totalTopUp: number;
    totalActivationFee: number;
    totalManualActivation: number;
    totalCustomerTopUp: number;
    monthlyRevenue: number;
    revenueChange: number;
    totalCompletedRevenueBookings: number;
    totalCompletedGrossAmount: number;
    totalCompletedBookings: number;
    totalInProgressBookings: number;
    totalRejectedBookings: number;
    payoutWaitingConfirmation: number;
    payoutFailedOrRejected: number;
    payoutMissingPaymentMethod: number;
    payoutCompletedToday: number;
    payoutIntegrationIssues: number;
    bookingsByStatus: Record<string, number>;
    recentBookings: BookedService[];
    paymentChart: ChartBucket[];
    providerChart: ChartBucket[];
}

interface ProviderLiteRow {
    createdAt?: string | null;
    created_at?: string | null;
}

interface BookedServiceRow extends BookedService {
    created_at?: string | null;
    payment_status?: string | null;
}

interface WithdrawalRow {
    id: string;
    providerId?: string | null;
    paymentStatus?: string | null;
    adminNote?: string | null;
    paymentDate?: string | null;
    createdDate?: string | null;
}

interface ProviderPaymentMethodLiteRow {
    providerID?: string | null;
    is_active?: boolean | null;
}

type WalletTransactionLiteRow = WalletTransactionMetricRow;


type DashboardRange = 'today' | '7d' | '30d' | 'all';

function isCompletedBooking(value: BookedServiceRow): boolean {
    const normalized = (value.status ?? '').toString().trim().toLowerCase();
    return normalized === 'completed' || normalized === 'service_completion_approved_by_customer';
}

function isCustomerPaymentDone(value: BookedServiceRow): boolean {
    if (value.paymentCompleted === true) return true;
    const normalized = (value.payment_status ?? '').toString().trim().toLowerCase();
    return normalized === 'payment_completed';
}

function getBookingGrossAmount(value: BookedServiceRow): number {
    const raw = Number(value.totalAmount ?? value.price ?? 0);
    return Number.isFinite(raw) ? raw : 0;
}

function getPlatformRevenueFromBooking(value: BookedServiceRow): number {
    if (!isCompletedBooking(value)) return 0;
    if (!isCustomerPaymentDone(value)) return 0;
    return getBookingGrossAmount(value) * 0.1;
}

function formatCurrency(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatStatValue(value: number, isCurrency?: boolean): string {
    if (isCurrency) return formatCurrency(value);
    return value.toLocaleString('en-US');
}

function isRejectedBooking(value: BookedServiceRow): boolean {
    const normalized = (value.status ?? '').toString().trim().toLowerCase();
    return normalized.includes('rejected') || normalized.includes('cancelled') || normalized.includes('canceled');
}

function startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

const PROVIDER_ALL_RANGE_START_MONTH = 2;
const PAYMENT_ALL_RANGE_START_MONTH = 4;

function getAllRangeStart(now: Date, startMonth: number): Date {
    const thisYearStart = startOfDay(new Date(now.getFullYear(), startMonth, 1));
    if (now >= thisYearStart) return thisYearStart;
    return startOfDay(new Date(now.getFullYear() - 1, startMonth, 1));
}

function resolveBookingCreatedAt(booking: BookedServiceRow): Date | null {
    const raw = booking.createdAt ?? booking.created_at;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeBookingRows(rows: BookedServiceRow[]): BookedService[] {
    return rows.map(({ created_at, payment_status, ...rest }) => ({
        ...rest,
        createdAt: rest.createdAt ?? created_at ?? undefined,
        paymentCompleted: rest.paymentCompleted ?? undefined,
    }));
}

function countItemsInRange<T>(items: T[], start: Date, end: Date, resolveDate: (item: T) => Date | null): number {
    return items.reduce((count, item) => {
        const createdAt = resolveDate(item);
        if (!createdAt || createdAt < start || createdAt >= end) return count;
        return count + 1;
    }, 0);
}

function sumItemsInRange<T>(
    items: T[],
    start: Date,
    end: Date,
    resolveDate: (item: T) => Date | null,
    resolveValue: (item: T) => number,
): number {
    return items.reduce((sum, item) => {
        const createdAt = resolveDate(item);
        if (!createdAt || createdAt < start || createdAt >= end) return sum;
        return sum + resolveValue(item);
    }, 0);
}

function resolveWalletCreditAmount(row: WalletTransactionLiteRow): number {
    if (row.isCredit !== true) return 0;
    return parseWalletAmount(row.amount);
}

function resolveWalletDate(row: WalletTransactionLiteRow): Date | null {
    if (!row.createdDate) return null;
    const date = new Date(row.createdDate);
    return Number.isNaN(date.getTime()) ? null : date;
}

function resolveProviderDate(provider: ProviderLiteRow): Date | null {
    const raw = provider.createdAt ?? provider.created_at;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeProviderRows(rows: ProviderLiteRow[]): ProviderLiteRow[] {
    return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt ?? row.created_at ?? null,
    }));
}

function providersFromRedux(providers: Provider[]): ProviderLiteRow[] {
    return providers.map((provider) => ({
        createdAt: provider.createdAt ?? null,
        created_at: null,
    }));
}

function buildTimeSeriesChart<T>(
    items: T[],
    range: DashboardRange,
    resolveDate: (item: T) => Date | null,
    monthlyBuckets = false,
    resolveValue?: (item: T) => number,
): ChartBucket[] {
    const now = new Date();
    const today = startOfDay(now);
    const aggregate = (start: Date, end: Date) => (
        resolveValue
            ? sumItemsInRange(items, start, end, resolveDate, resolveValue)
            : countItemsInRange(items, start, end, resolveDate)
    );

    if (range === 'today') {
        const tomorrow = addDays(today, 1);
        return [{ label: 'Today', value: aggregate(today, tomorrow) }];
    }

    if (range === '7d') {
        return Array.from({ length: 7 }, (_, index) => {
            const start = addDays(today, index - 6);
            const end = addDays(start, 1);
            return {
                label: start.toLocaleDateString('en-US', { weekday: 'short' }),
                value: aggregate(start, end),
            };
        });
    }

    if (range === '30d') {
        return Array.from({ length: 6 }, (_, index) => {
            const start = addDays(today, -30 + index * 5);
            const end = addDays(start, 5);
            return {
                label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: aggregate(start, end),
            };
        });
    }

    const rangeStart = getAllRangeStart(
        now,
        monthlyBuckets ? PROVIDER_ALL_RANGE_START_MONTH : PAYMENT_ALL_RANGE_START_MONTH,
    );

    if (monthlyBuckets) {
        const buckets: ChartBucket[] = [];
        let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        const endLimit = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        while (cursor < endLimit) {
            const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            buckets.push({
                label: cursor.toLocaleDateString('en-US', { month: 'short' }),
                value: aggregate(cursor, bucketEnd),
            });
            cursor = bucketEnd;
        }

        return buckets;
    }

    const buckets: ChartBucket[] = [];
    let weekStart = rangeStart;

    while (weekStart <= today) {
        const weekEnd = addDays(weekStart, 7);
        buckets.push({
            label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: aggregate(weekStart, weekEnd),
        });
        weekStart = weekEnd;
    }

    return buckets;
}

function getPaymentChartTitle(range: DashboardRange): string {
    if (range === 'today') return "Today's Payments";
    if (range === '7d') return 'Payment Activity';
    if (range === '30d') return '30-Day Payments';
    return 'Payment Activity';
}

function getPaymentChartSubtitle(range: DashboardRange): string {
    if (range === 'today') return 'Wallet payment volume today';
    if (range === '7d') return 'Payment volume per day, last 7 days';
    if (range === '30d') return 'Payment volume per 5-day period, last 30 days';
    return 'Payment volume per week, since May';
}

function getProviderChartSubtitle(range: DashboardRange): string {
    if (range === 'today') return 'New providers today';
    if (range === '7d') return 'New providers per day, last 7 days';
    if (range === '30d') return 'New providers per 5-day period, last 30 days';
    return 'New providers per month, since March';
}

async function fetchWalletRowsForDashboard(): Promise<WalletTransactionLiteRow[]> {
    try {
        const response = await fetch('/api/wallet-transactions');
        if (!response.ok) return [];
        const payload = (await response.json()) as {
            data?: Array<WalletTransactionLiteRow & { created_date?: string | null }>;
        };
        return (payload.data ?? []).map((row) => ({
            ...row,
            createdDate: row.createdDate ?? row.created_date ?? null,
        }));
    } catch {
        return [];
    }
}

function DashboardContent() {
    const dispatch: AppDispatch = useDispatch();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { providers, loading: providersLoading } = useSelector((state: { provider: ProviderState }) => state.provider);
    const [bookingCount, setBookingCount] = useState<number>(0);
    const [providerCount, setProviderCount] = useState<number>(0);
    const [customerCount, setCustomerCount] = useState<number>(0);
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalRevenue: 0,
        totalCredit: 0,
        totalNetFlow: 0,
        totalWalletCreditsAdjusted: 0,
        totalWalletDebits: 0,
        chapaWalletNet: 0,
        chapaAvailableBalance: null,
        chapaLedgerBalance: null,
        nonChapaWalletNet: 0,
        totalTopUp: 0,
        totalActivationFee: 0,
        totalManualActivation: 0,
        totalCustomerTopUp: 0,
        monthlyRevenue: 0,
        revenueChange: 0,
        totalCompletedRevenueBookings: 0,
        totalCompletedGrossAmount: 0,
        totalCompletedBookings: 0,
        totalInProgressBookings: 0,
        totalRejectedBookings: 0,
        payoutWaitingConfirmation: 0,
        payoutFailedOrRejected: 0,
        payoutMissingPaymentMethod: 0,
        payoutCompletedToday: 0,
        payoutIntegrationIssues: 0,
        bookingsByStatus: {},
        recentBookings: [],
        paymentChart: [],
        providerChart: []
    });
    const [countsLoading, setCountsLoading] = useState<boolean>(true);
    const [walletBreakdown, setWalletBreakdown] = useState<WalletDashboardBreakdown | null>(null);
    const initialRange = (() => {
        const range = (searchParams.get('range') || '').toLowerCase();
        if (range === 'today' || range === '7d' || range === '30d' || range === 'all')
            return range as DashboardRange;
        return '30d';
    })();
    const [dashboardRange, setDashboardRange] = useState<DashboardRange>(initialRange);

    const isDateInRange = useCallback((dateString?: string | null): boolean => {
        if (dashboardRange === 'all') return true;
        if (!dateString) return false;
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return false;

        const now = new Date();
        if (dashboardRange === 'today') {
            return date.getFullYear() === now.getFullYear()
                && date.getMonth() === now.getMonth()
                && date.getDate() === now.getDate();
        }

        const days = dashboardRange === '7d' ? 7 : 30;
        const from = new Date();
        from.setDate(now.getDate() - days);
        return date >= from;
    }, [dashboardRange]);

    useEffect(() => {
        const next = new URLSearchParams(searchParams.toString());
        next.set('range', dashboardRange);
        router.replace(`/admin/dashboard?${next.toString()}`);
    }, [dashboardRange, router, searchParams]);

    useEffect(() => {
        const fetchAnalyticsAndLists = async () => {
            setCountsLoading(true);

            let providerSource = providers;
            if (providerSource.length === 0) {
                try {
                    providerSource = await dispatch(fetchProviders()).unwrap();
                } catch {
                    providerSource = [];
                }
            }

            const [
                walletRows,
                { data: bookings, error: bookingsError },
                chapaBalanceResult,
            ] = await Promise.all([
                fetchWalletRowsForDashboard(),
                getSupabase()
                    .from('booked_service')
                    .select('*')
                    .order('createdAt', { ascending: false }),
                fetch('/api/admin/chapa/balance')
                    .then(async (response) => {
                        if (!response.ok) return null;
                        const payload = (await response.json()) as {
                            data?: { available_balance?: number; ledger_balance?: number };
                        };
                        return payload.data ?? null;
                    })
                    .catch(() => null),
            ]);

            const chapaAvailableBalance =
                typeof chapaBalanceResult?.available_balance === 'number'
                    ? chapaBalanceResult.available_balance
                    : null;
            const chapaLedgerBalance =
                typeof chapaBalanceResult?.ledger_balance === 'number'
                    ? chapaBalanceResult.ledger_balance
                    : null;

            const rangedWalletRows = walletRows.filter((row) => isDateInRange(row.createdDate));
            const walletMetrics = computeWalletMetrics(rangedWalletRows);
            setWalletBreakdown(computeWalletDashboardBreakdown(rangedWalletRows));
            const chapaWalletNet = sumChapaNetFlow(rangedWalletRows);
            const nonChapaWalletNet = sumNonChapaNetFlow(rangedWalletRows);
            const totalManualActivation = sumManualActivationCredits(rangedWalletRows, { adjusted: true });
            const totalWalletDebits = sumDebits(rangedWalletRows);
            const normalizedProviders = normalizeProviderRows(providersFromRedux(providerSource));
            const rangedProviderCount = normalizedProviders.filter((provider) => {
                const createdAt = resolveProviderDate(provider);
                if (!createdAt) return false;
                return isDateInRange(createdAt.toISOString());
            }).length;
            setProviderCount(rangedProviderCount);
            const paymentChart = buildTimeSeriesChart(
                rangedWalletRows,
                dashboardRange,
                resolveWalletDate,
                false,
                resolveWalletCreditAmount,
            );
            const providerChart = buildTimeSeriesChart(
                normalizedProviders,
                dashboardRange,
                resolveProviderDate,
                dashboardRange === 'all',
            );
            setAnalytics((prev) => ({
                ...prev,
                totalCredit: rangedWalletRows.length,
                totalNetFlow: walletMetrics.totalNetFlowAdjusted,
                totalWalletCreditsAdjusted: walletMetrics.totalCreditAdjusted,
                totalWalletDebits,
                chapaWalletNet,
                chapaAvailableBalance,
                chapaLedgerBalance,
                nonChapaWalletNet,
                totalTopUp: walletMetrics.totalTopUpAdjusted,
                totalActivationFee: walletMetrics.totalActivationFeeAdjusted,
                totalManualActivation,
                totalCustomerTopUp: walletMetrics.totalCustomerTopUpAdjusted,
                paymentChart,
                providerChart,
            }));

            if (!bookingsError && bookings) {
                setBookingCount(bookings.length);

                const bookingRows = normalizeBookingRows(bookings as BookedServiceRow[]);
                const rangedBookingRows = bookingRows.filter((booking) => {
                    const createdAt = resolveBookingCreatedAt(booking);
                    if (!createdAt) return false;
                    return isDateInRange(createdAt.toISOString());
                });
                const rangedCompletedPaidBookings = rangedBookingRows.filter((booking) => {
                    return isCompletedBooking(booking) && isCustomerPaymentDone(booking);
                });
                const totalCompletedBookings = rangedBookingRows.filter((booking) => isCompletedBooking(booking)).length;
                const totalRejectedBookings = rangedBookingRows.filter((booking) => isRejectedBooking(booking)).length;
                const totalInProgressBookings = rangedBookingRows.length - totalCompletedBookings - totalRejectedBookings;

                // Calculate revenue (10% commission on completed + paid bookings)
                const totalRevenue = rangedCompletedPaidBookings.reduce((sum, booking) => {
                    return sum + getPlatformRevenueFromBooking(booking);
                }, 0);
                const totalCompletedGrossAmount = rangedCompletedPaidBookings.reduce((sum, booking) => {
                    return sum + getBookingGrossAmount(booking);
                }, 0);
                const totalCredit = rangedWalletRows.length;
                const totalNetFlow = walletMetrics.totalNetFlowAdjusted;
                const totalWalletCreditsAdjusted = walletMetrics.totalCreditAdjusted;
                const totalWalletDebitsRanged = sumDebits(rangedWalletRows);
                const chapaWalletNetRanged = sumChapaNetFlow(rangedWalletRows);
                const nonChapaWalletNetRanged = sumNonChapaNetFlow(rangedWalletRows);
                const totalTopUp = walletMetrics.totalTopUpAdjusted;
                const totalActivationFee = walletMetrics.totalActivationFeeAdjusted;
                const totalManualActivationRanged = sumManualActivationCredits(rangedWalletRows, { adjusted: true });
                const totalCustomerTopUp = walletMetrics.totalCustomerTopUpAdjusted;

                // Calculate monthly revenue (last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const monthlyBookings = bookingRows.filter((booking) => {
                    const createdAt = resolveBookingCreatedAt(booking);
                    return createdAt && createdAt >= thirtyDaysAgo;
                });
                const monthlyRevenue = monthlyBookings.reduce((sum, booking) => {
                    return sum + getPlatformRevenueFromBooking(booking);
                }, 0);

                // Calculate previous month revenue for comparison
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                const previousMonthBookings = bookingRows.filter((booking) => {
                    const createdAt = resolveBookingCreatedAt(booking);
                    return createdAt && createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
                });
                const previousMonthRevenue = previousMonthBookings.reduce((sum, booking) => {
                    return sum + getPlatformRevenueFromBooking(booking);
                }, 0);

                const revenueChange = previousMonthRevenue > 0 
                    ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
                    : monthlyRevenue > 0 ? 100 : 0;

                const bookingsByStatus: Record<string, number> = {};
                rangedBookingRows.forEach((booking) => {
                    const status = booking.status || 'unknown';
                    bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
                });

                setAnalytics({
                    totalRevenue,
                    totalCredit,
                    totalNetFlow,
                    totalWalletCreditsAdjusted,
                    totalWalletDebits: totalWalletDebitsRanged,
                    chapaWalletNet: chapaWalletNetRanged,
                    chapaAvailableBalance,
                    chapaLedgerBalance,
                    nonChapaWalletNet: nonChapaWalletNetRanged,
                    totalTopUp,
                    totalActivationFee,
                    totalManualActivation: totalManualActivationRanged,
                    totalCustomerTopUp,
                    monthlyRevenue,
                    revenueChange,
                    totalCompletedRevenueBookings: rangedCompletedPaidBookings.length,
                    totalCompletedGrossAmount,
                    totalCompletedBookings,
                    totalInProgressBookings: Math.max(totalInProgressBookings, 0),
                    totalRejectedBookings,
                    payoutWaitingConfirmation: 0,
                    payoutFailedOrRejected: 0,
                    payoutMissingPaymentMethod: 0,
                    payoutCompletedToday: 0,
                    payoutIntegrationIssues: 0,
                    bookingsByStatus,
                    recentBookings: bookingRows.slice(0, 5),
                    paymentChart,
                    providerChart,
                });
            }

            const { data: withdrawalRows, error: withdrawalError } = await getSupabase()
                .from('withdrawal_history')
                .select('id, providerId, paymentStatus, adminNote, paymentDate, createdDate');
            const { data: paymentMethodRows, error: paymentMethodError } = await getSupabase()
                .from('provider_payment_methods')
                .select('providerID, is_active');

            if (!withdrawalError && !paymentMethodError && withdrawalRows && paymentMethodRows) {
                const withdrawals = withdrawalRows as WithdrawalRow[];
                const methods = paymentMethodRows as ProviderPaymentMethodLiteRow[];
                const activeProviderIds = new Set(
                    methods
                        .filter((row) => row.is_active === true)
                        .map((row) => (row.providerID || '').trim())
                        .filter(Boolean)
                );

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const now = Date.now();
                const payoutWaitingConfirmation = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    const note = (row.adminNote || '').toLowerCase();
                    const dateRef = row.paymentDate || row.createdDate;
                    return status === 'approved' && note.includes('reference=') && isDateInRange(dateRef);
                }).length;
                const payoutStuckOver2Hours = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    const note = (row.adminNote || '').toLowerCase();
                    const dateRef = row.paymentDate || row.createdDate;
                    const dt = dateRef ? new Date(dateRef).getTime() : 0;
                    if (!dt) return false;
                    return status === 'approved' && note.includes('reference=') && now - dt >= 2 * 60 * 60 * 1000 && isDateInRange(dateRef);
                }).length;

                const payoutFailedOrRejected = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    const dateRef = row.paymentDate || row.createdDate;
                    return status === 'rejected' && isDateInRange(dateRef);
                }).length;

                const payoutMissingPaymentMethod = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    if (!['pending', 'approved'].includes(status)) return false;
                    const dateRef = row.paymentDate || row.createdDate;
                    if (!isDateInRange(dateRef)) return false;
                    const providerId = (row.providerId || '').trim();
                    if (!providerId) return true;
                    return !activeProviderIds.has(providerId);
                }).length;

                const payoutCompletedToday = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    if (status !== 'completed') return false;
                    const paymentDate = row.paymentDate ? new Date(row.paymentDate) : null;
                    return Boolean(paymentDate && paymentDate >= today && paymentDate < tomorrow);
                }).length;
                const payoutIntegrationIssues = withdrawals.filter((row) => {
                    const status = (row.paymentStatus || '').toLowerCase();
                    const note = (row.adminNote || '').toLowerCase();
                    const dateRef = row.paymentDate || row.createdDate;
                    const dt = dateRef ? new Date(dateRef).getTime() : 0;
                    const hasFailedMarker = note.includes('status=failed') || note.includes('failed to');
                    const waitingTooLong = status === 'approved' && note.includes('reference=') && dt > 0 && now - dt >= 2 * 60 * 60 * 1000;
                    return isDateInRange(dateRef) && (hasFailedMarker || waitingTooLong || status === 'rejected');
                }).length;

                setAnalytics((prev) => ({
                    ...prev,
                    payoutWaitingConfirmation: payoutStuckOver2Hours > payoutWaitingConfirmation ? payoutStuckOver2Hours : payoutWaitingConfirmation,
                    payoutFailedOrRejected,
                    payoutMissingPaymentMethod,
                    payoutCompletedToday,
                    payoutIntegrationIssues,
                }));
            }

            const { data: customerRows, error: customerError } = await getSupabase()
                .from('customer')
                .select('created_at');
            if (!customerError && customerRows) {
                const rangedCustomerCount = customerRows.filter((row) => isDateInRange(row.created_at)).length;
                setCustomerCount(rangedCustomerCount);
            } else {
                setCustomerCount(0);
            }
            setCountsLoading(false);
        };
        fetchAnalyticsAndLists();
    }, [dispatch, dashboardRange, isDateInRange, providers]);

    const isLoading = providersLoading || countsLoading;
    const isDebugHost = useWalletMetricsDebugVisible();
    const [financeDebugEnabled, setFinanceDebugEnabled] = useState(false);

    useEffect(() => {
        if (!isDebugHost) return;
        try {
            setFinanceDebugEnabled(localStorage.getItem('dashboard-finance-debug') === 'true');
        } catch {
            setFinanceDebugEnabled(false);
        }
    }, [isDebugHost]);

    const showFinanceDebug = isDebugHost && financeDebugEnabled;

    function setFinanceDebug(next: boolean) {
        setFinanceDebugEnabled(next);
        try {
            localStorage.setItem('dashboard-finance-debug', next ? 'true' : 'false');
        } catch {
        }
    }

    const chapaSurplus =
        analytics.chapaAvailableBalance != null
            ? analytics.chapaAvailableBalance - analytics.chapaWalletNet
            : null;
    const chapaNetFlowGap =
        analytics.chapaAvailableBalance != null
            ? analytics.chapaAvailableBalance - analytics.totalNetFlow
            : null;

    const chapaActivationInWallet =
        analytics.totalActivationFee - analytics.totalManualActivation;
    const otherChapaInWallet = Math.max(0, analytics.chapaWalletNet - chapaActivationInWallet);
    const hasLiveChapaBalance = analytics.chapaAvailableBalance != null;

    // Calculate max value for chart scaling
    const paymentChartData = analytics.paymentChart;
    const providerChartData = analytics.providerChart;

    const StatCard = ({ 
        title, 
        value, 
        change, 
        note,
        bookingBreakdown,
        valueNode,
        isCurrency,
        iconClassName,
        icon: Icon, 
        iconBg,
        href 
    }: { 
        title: string; 
        value: number | string; 
        change?: number; 
        note?: string;
        bookingBreakdown?: {
            completed: number;
            inProgress: number;
            rejected: number;
        };
        valueNode?: React.ReactNode;
        isCurrency?: boolean;
        iconClassName?: string;
        icon: React.ElementType; 
        iconBg: string;
        href?: string;
    }) => {
        const formattedValue =
            typeof value === 'number' ? formatStatValue(value, isCurrency) : String(value);

        const content = (
            <div className="group relative flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:bg-muted/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] sm:p-5">
                {change !== undefined && (
                    <div className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        change >= 0 
                            ? 'bg-primary/15 text-primary' 
                            : 'bg-destructive/15 text-destructive'
                    }`}>
                        {change >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                        ) : (
                            <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
                <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-text-secondary">
                        {title}
                    </p>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                        <Icon className={`h-4 w-4 ${iconClassName ?? 'text-primary'}`} />
                    </div>
                </div>
                <div className="mt-3 min-w-0 flex-1">
                    {isLoading ? (
                        <span className="inline-block h-8 w-24 animate-pulse rounded bg-muted" />
                    ) : valueNode ? (
                        valueNode
                    ) : (
                        <p
                            className="truncate font-heading text-xl font-bold tabular-nums tracking-normal text-text-primary sm:text-2xl"
                            title={formattedValue}
                        >
                            {formattedValue}
                        </p>
                    )}
                    {note && (
                        <p className="mt-1 text-xs text-text-secondary">
                            <sup>{note}</sup>
                        </p>
                    )}
                    {bookingBreakdown && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs font-medium tabular-nums text-text-secondary">
                            <span className="text-primary">{bookingBreakdown.completed} completed</span>
                            <span aria-hidden="true">·</span>
                            <span>{bookingBreakdown.inProgress} in progress</span>
                            <span aria-hidden="true">·</span>
                            <span>{bookingBreakdown.rejected} rejected</span>
                        </p>
                    )}
                </div>
            </div>
        );

        if (href) {
            return <Link href={href} className="block h-full min-w-0">{content}</Link>;
        }
        return content;
    };

    const StatusBadge = ({ status, count }: { status: string; count: number }) => {
        const statusConfig: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
            completed: { color: 'text-primary', icon: CheckCircle2, bg: 'bg-primary/10' },
            pending: { color: 'text-chart-4', icon: Clock, bg: 'bg-chart-4/15' },
            accepted: { color: 'text-chart-3', icon: CheckCircle2, bg: 'bg-chart-3/15' },
            ongoing: { color: 'text-chart-2', icon: Activity, bg: 'bg-chart-2/15' },
            rejected: { color: 'text-destructive', icon: XCircle, bg: 'bg-destructive/10' },
            cancelled: { color: 'text-text-secondary', icon: XCircle, bg: 'bg-muted' },
        };

        const config = statusConfig[status] || { color: 'text-text-secondary', icon: Activity, bg: 'bg-muted' };
        const Icon = config.icon;

        return (
            <div className={`flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted ${config.bg}`}>
                <div className={`${config.color} rounded-lg bg-card p-2`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-text-secondary capitalize">{status}</p>
                    <p className="font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{count}</p>
                </div>
            </div>
        );
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Admin Dashboard"
                            description="Real-time insights and analytics for your platform"
                            actions={
                                <Link
                                    href="/admin/providers"
                                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                                >
                                    Manage Providers
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            }
                        />

                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: '7d', label: '7D' },
                                { id: '30d', label: '30D' },
                                { id: 'all', label: 'All' },
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setDashboardRange(range.id as DashboardRange)}
                                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                        dashboardRange === range.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'border border-border bg-card text-text-primary hover:bg-muted'
                                    }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                            </div>
                            {isDebugHost && (
                                <div
                                    className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
                                    role="group"
                                    aria-label="Dashboard view"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setFinanceDebug(false)}
                                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                            !financeDebugEnabled
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        Production
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFinanceDebug(true)}
                                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                            financeDebugEnabled
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        Finance debug
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Main Stats Grid */}
                        <section className="mb-8 grid grid-cols-1 items-stretch gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-5">
                            <StatCard
                                title="Net Flow"
                                value={analytics.totalNetFlow}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                                note="Wallet credits − debits"
                            />
                            <StatCard
                                title={hasLiveChapaBalance ? 'Chapa balance' : 'App wallet'}
                                value={analytics.chapaAvailableBalance ?? analytics.chapaWalletNet}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                                note={
                                    hasLiveChapaBalance
                                        ? 'Live Chapa account'
                                        : 'Recorded in wallet ledger'
                                }
                            />
                            <StatCard
                                title="Providers"
                                value={providerCount}
                                icon={Users}
                                iconBg="bg-primary/10"
                                href="/admin/providers"
                            />
                            <StatCard
                                title="Bookings"
                                value={bookingCount}
                                bookingBreakdown={{
                                    completed: analytics.totalCompletedBookings,
                                    inProgress: analytics.totalInProgressBookings,
                                    rejected: analytics.totalRejectedBookings,
                                }}
                                icon={CalendarCheck2}
                                iconBg="bg-primary/10"
                                href="/admin/bookings"
                            />
                            <StatCard
                                title="Customers"
                                value={customerCount}
                                icon={Users}
                                iconBg="bg-primary/10"
                                href="/admin/customers"
                            />
                        </section>

                        {showFinanceDebug && (
                        <section className="mb-8 grid grid-cols-1 items-stretch gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                title="Wallet rows"
                                value={analytics.totalCredit}
                                icon={Activity}
                                iconBg="bg-primary/10"
                                note="Ledger entry count"
                            />
                            <StatCard
                                title="Wallet credits"
                                value={analytics.totalWalletCreditsAdjusted}
                                isCurrency
                                icon={TrendingUp}
                                iconBg="bg-primary/10"
                            />
                            <StatCard
                                title="Wallet debits"
                                value={analytics.totalWalletDebits}
                                isCurrency
                                icon={TrendingDown}
                                iconBg="bg-primary/10"
                            />
                            <StatCard
                                title="Non-Chapa net"
                                value={analytics.nonChapaWalletNet}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                            />
                            <StatCard
                                title="Activation fee"
                                value={analytics.totalActivationFee}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                            />
                            <StatCard
                                title="Manual activation"
                                value={analytics.totalManualActivation}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                                note="Offline · not in Chapa"
                            />
                            <StatCard
                                title="Customer top up"
                                value={analytics.totalCustomerTopUp}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                            />
                            <StatCard
                                title="Total top up"
                                value={analytics.totalTopUp}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                                note="Provider + customer"
                            />
                            <StatCard
                                title="App wallet Chapa"
                                value={analytics.chapaWalletNet}
                                isCurrency
                                icon={DollarSign}
                                iconBg="bg-primary/10"
                                note={
                                    hasLiveChapaBalance && chapaSurplus != null
                                        ? `${formatCurrency(chapaSurplus)} not in ledger`
                                        : undefined
                                }
                            />
                        </section>
                        )}

                        {showFinanceDebug && walletBreakdown && (
                            <WalletMetricBreakdownDebug
                                breakdown={walletBreakdown}
                                totals={{
                                    walletRows: analytics.totalCredit,
                                    activationFee: analytics.totalActivationFee,
                                    manualActivation: analytics.totalManualActivation,
                                    customerTopUp: analytics.totalCustomerTopUp,
                                    totalTopUp: analytics.totalTopUp,
                                    walletCredits: analytics.totalWalletCreditsAdjusted,
                                    walletDebits: analytics.totalWalletDebits,
                                    netFlow: analytics.totalNetFlow,
                                    chapaWalletNet: analytics.chapaWalletNet,
                                    chapaActivationInWallet,
                                    otherChapaInWallet,
                                    chapaAvailableBalance: analytics.chapaAvailableBalance,
                                    chapaLedgerBalance: analytics.chapaLedgerBalance,
                                    chapaSurplus,
                                    chapaNetFlowGap,
                                    nonChapaWalletNet: analytics.nonChapaWalletNet,
                                    providerCount,
                                    bookingCount,
                                    completedBookings: analytics.totalCompletedBookings,
                                    inProgressBookings: analytics.totalInProgressBookings,
                                    rejectedBookings: analytics.totalRejectedBookings,
                                    customerCount,
                                }}
                            />
                        )}

                        <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <h2 className="admin-section-title">Payout Health</h2>
                                    <p className="admin-section-desc">
                                        Includes waiting confirmations and delivery issues in selected range.
                                    </p>
                                </div>
                                <Link
                                    href="/admin/finance/payout-request"
                                    className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                >
                                    Open payout requests
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <Link
                                    href="/admin/finance/payout-request?segment=waiting_confirmation"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                                        Waiting Confirmation
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Transfer was initiated but completion confirmation has not arrived yet. Open this to verify and resolve stuck payouts.
                                    </span>
                                    <p className="mt-2 font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{analytics.payoutWaitingConfirmation}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=failed_rejected"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                                        Failed / Rejected
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Chapa payout failed or the request was rejected. Open this list to review reason and retry or close the case.
                                    </span>
                                    <p className="mt-2 font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{analytics.payoutFailedOrRejected}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=missing_payment_method"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                                        Missing Payment Method
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Provider payout request exists but required bank or wallet method is incomplete or unavailable.
                                    </span>
                                    <p className="mt-2 font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{analytics.payoutMissingPaymentMethod}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=completed_today"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                                        Completed Today
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Count of payouts marked completed during today in your selected dashboard range.
                                    </span>
                                    <p className="mt-2 font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{analytics.payoutCompletedToday}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=failed_rejected"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                                        Integration Issues
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Transfer records with webhook or verification problems requiring manual payout investigation.
                                    </span>
                                    <p className="mt-2 font-heading text-2xl font-bold tabular-nums tracking-normal text-text-primary">{analytics.payoutIntegrationIssues}</p>
                                </Link>
                            </div>
                        </section>

                        {/* Analytics Charts Section */}
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-primary/15 p-2">
                                            <BarChart3 className="h-5 w-5 text-text-secondary" />
                                        </div>
                                        <div>
                                            <h2 className="admin-section-title">{getPaymentChartTitle(dashboardRange)}</h2>
                                            <p className="admin-section-desc">
                                                {getPaymentChartSubtitle(dashboardRange)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                                        <Zap className="h-4 w-4 text-text-secondary" />
                                        <span className="text-xs font-semibold text-text-secondary">Live</span>
                                    </div>
                                </div>
                                <DashboardBarChart
                                    buckets={paymentChartData}
                                    emptyLabel="No wallet payments in this period"
                                    valueLabel="Amount"
                                    barColor="var(--chart-1)"
                                    isCurrency
                                />
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="rounded-xl bg-primary/15 p-2">
                                        <Users className="h-5 w-5 text-text-secondary" />
                                    </div>
                                    <div>
                                        <h2 className="admin-section-title">Provider Growth</h2>
                                        <p className="admin-section-desc">
                                            {getProviderChartSubtitle(dashboardRange)}
                                        </p>
                                    </div>
                                </div>
                                <DashboardBarChart
                                    buckets={providerChartData}
                                    emptyLabel="No new providers in this period"
                                    valueLabel="Providers"
                                    barColor="var(--chart-2)"
                                />
                            </div>
                        </section>

                        {/* Status Breakdown & Quick Actions */}
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="rounded-xl bg-primary/15 p-2">
                                        <CheckCircle2 className="h-5 w-5 text-text-secondary" />
                                    </div>
                                    <h2 className="admin-section-title">Booking Status</h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {Object.entries(analytics.bookingsByStatus).map(([status, count]) => (
                                        <StatusBadge key={status} status={status} count={count} />
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <h3 className="admin-section-title mb-4 flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-text-secondary" />
                                    Quick Actions
                                </h3>
                                <ul className="space-y-3">
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-text-primary transition-all duration-150 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                                            href="/admin/providers"
                                        >
                                            <span className="text-sm font-medium">Providers</span>
                                            <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-text-primary transition-all duration-150 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                                            href="/admin/customers"
                                        >
                                            <span className="text-sm font-medium">Customers</span>
                                            <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-text-primary transition-all duration-150 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                                            href="/admin/bookings"
                                        >
                                            <span className="text-sm font-medium">Bookings</span>
                                            <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-text-primary transition-all duration-150 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                                            href="/admin/services/approve"
                                        >
                                            <span className="text-sm font-medium">Approve Services</span>
                                            <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}

const Dashboard = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <DashboardContent />
        </Suspense>
    );
};

export default Dashboard;
