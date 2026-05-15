'use client';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getSupabase } from '@/lib/supabaseClient';
import { fetchProviders, ProviderState } from '@/features/provider/providerSlice';
import { AppDispatch } from '@/store/store';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    Users, 
    CalendarCheck2, 
    UserPlus, 
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
    Sparkles,
    CircleHelp
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookedService } from '@/features/bookedService/bookedServiceSlice';

interface AnalyticsData {
    totalRevenue: number;
    totalTransaction: number;
    totalNetFlow: number;
    totalTopUp: number;
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
    weeklyData: number[];
    monthlyData: number[];
}

interface BookedServiceRow {
    totalAmount?: number | null;
    price?: number | null;
    status?: string | null;
    paymentCompleted?: boolean | null;
    payment_status?: string | null;
    createdAt?: string | null;
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

interface WalletTransactionLiteRow {
    amount?: string | number | null;
    isCredit?: boolean | null;
    note?: string | null;
    transactionId?: string | null;
    createdDate?: string | null;
}


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
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isRejectedBooking(value: BookedServiceRow): boolean {
    const normalized = (value.status ?? '').toString().trim().toLowerCase();
    return normalized.includes('rejected') || normalized.includes('cancelled') || normalized.includes('canceled');
}

function DashboardContent() {
    const dispatch: AppDispatch = useDispatch();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { providers, loading: providersLoading } = useSelector((state: { provider: ProviderState }) => state.provider);
    const [bookingCount, setBookingCount] = useState<number>(0);
    const [customerCount, setCustomerCount] = useState<number>(0);
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalRevenue: 0,
        totalTransaction: 0,
        totalNetFlow: 0,
        totalTopUp: 0,
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
        weeklyData: [],
        monthlyData: []
    });
    const [countsLoading, setCountsLoading] = useState<boolean>(true);
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
        dispatch(fetchProviders());
        const fetchAnalyticsAndLists = async () => {
            setCountsLoading(true);
            
            // Fetch bookings with full data for analytics
            const { data: bookings, error: bookingsError } = await getSupabase()
                .from('booked_service')
                .select('*')
                .order('createdAt', { ascending: false });

            if (!bookingsError && bookings) {
                setBookingCount(bookings.length);

                const bookingRows = bookings as BookedServiceRow[];
                const rangedBookingRows = bookingRows.filter((booking) => isDateInRange(booking.createdAt));
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
                const { data: walletRows, error: walletRowsError } = await getSupabase()
                    .from('wallet_transaction')
                    .select('amount, isCredit, note, transactionId, createdDate');
                const rangedWalletRows = !walletRowsError && walletRows
                    ? (walletRows as WalletTransactionLiteRow[]).filter((row) => isDateInRange(row.createdDate))
                    : [];
                const totalTransaction = rangedWalletRows.reduce((sum, row) => {
                    const amount = Number(row.amount ?? 0);
                    return sum + (Number.isFinite(amount) ? Math.abs(amount) : 0);
                }, 0);
                const totalNetFlow = rangedWalletRows.reduce((sum, row) => {
                    const amount = Number(row.amount ?? 0);
                    if (!Number.isFinite(amount)) return sum;
                    return row.isCredit === true ? sum + amount : sum - amount;
                }, 0);
                const totalTopUp = rangedWalletRows
                    .filter((row) => {
                        if (row.isCredit !== true) return false;
                        const normalizedNote = (row.note ?? '').toLowerCase();
                        const normalizedTransactionId = (row.transactionId ?? '').toLowerCase();
                        return normalizedNote.includes('top up')
                            || normalizedNote.includes('topup')
                            || normalizedTransactionId.startsWith('wallet_')
                            || normalizedTransactionId.startsWith('activation_');
                    })
                    .reduce((sum, row) => {
                        const amount = Number(row.amount ?? 0);
                        return sum + (Number.isFinite(amount) ? amount : 0);
                    }, 0);

                // Calculate monthly revenue (last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const monthlyBookings = bookingRows.filter(booking => {
                    const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                    return createdAt && createdAt >= thirtyDaysAgo;
                });
                const monthlyRevenue = monthlyBookings.reduce((sum, booking) => {
                    return sum + getPlatformRevenueFromBooking(booking);
                }, 0);

                // Calculate previous month revenue for comparison
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                const previousMonthBookings = bookingRows.filter(booking => {
                    const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                    return createdAt && createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
                });
                const previousMonthRevenue = previousMonthBookings.reduce((sum, booking) => {
                    return sum + getPlatformRevenueFromBooking(booking);
                }, 0);

                const revenueChange = previousMonthRevenue > 0 
                    ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
                    : monthlyRevenue > 0 ? 100 : 0;

                // Group bookings by status
                const bookingsByStatus: Record<string, number> = {};
                bookings.forEach(booking => {
                    const status = booking.status || 'unknown';
                    bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
                });

                // Get weekly data from ranged rows (last 7 days buckets)
                const weeklyData = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    date.setHours(0, 0, 0, 0);
                    const nextDate = new Date(date);
                    nextDate.setDate(nextDate.getDate() + 1);
                    return rangedBookingRows.filter((booking) => {
                        const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                        return createdAt && createdAt >= date && createdAt < nextDate;
                    }).length;
                });

                // Get monthly data from ranged rows (last 12 months buckets)
                const monthlyData = Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - (11 - i));
                    date.setDate(1);
                    date.setHours(0, 0, 0, 0);
                    const nextDate = new Date(date);
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    return rangedBookingRows.filter((booking) => {
                        const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                        return createdAt && createdAt >= date && createdAt < nextDate;
                    }).length;
                });

                setAnalytics({
                    totalRevenue,
                    totalTransaction,
                    totalNetFlow,
                    totalTopUp,
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
                    recentBookings: bookings.slice(0, 5),
                    weeklyData,
                    monthlyData
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

            // Count customers
            const { count: custCount } = await getSupabase()
                .from('customer')
                .select('*', { count: 'exact', head: true });
            setCustomerCount(custCount ?? 0);
            setCountsLoading(false);
        };
        fetchAnalyticsAndLists();
    }, [dispatch, dashboardRange, isDateInRange]);

    const isLoading = providersLoading || countsLoading;

    // Calculate max value for chart scaling
    const maxWeeklyValue = Math.max(...analytics.weeklyData, 1);
    const maxMonthlyValue = Math.max(...analytics.monthlyData, 1);

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
        gradient, 
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
        gradient: string;
        iconBg: string;
        href?: string;
    }) => {
        const content = (
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-white/40">
                {/* Animated gradient background */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`} />
                
                {/* Glowing effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
                
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div className={`${iconBg} p-3 rounded-xl shadow-lg`}>
                            <Icon className={`h-6 w-6 ${iconClassName ?? 'text-white'}`} />
                        </div>
                        {change !== undefined && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                change >= 0 
                                    ? 'bg-emerald-500/20 text-emerald-600' 
                                    : 'bg-red-500/20 text-red-600'
                            }`}>
                                {change >= 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                ) : (
                                    <TrendingDown className="h-3 w-3" />
                                )}
                                {Math.abs(change).toFixed(1)}%
                            </div>
                        )}
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                        {isLoading ? (
                            <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" />
                        ) : valueNode ? (
                            valueNode
                        ) : (
                            typeof value === 'number' && isCurrency
                                ? formatCurrency(value)
                                : value.toLocaleString()
                        )}
                    </p>
                    {note && (
                        <p className="mt-1 text-xs text-gray-500">
                            <sup>{note}</sup>
                        </p>
                    )}
                    {bookingBreakdown && (
                        <p className="mt-2 text-sm font-semibold">
                            <span className="text-emerald-600" title="Completed">
                                {bookingBreakdown.completed}
                            </span>
                            <span className="mx-2 text-gray-400">|</span>
                            <span className="text-blue-600" title="In Progress">
                                {bookingBreakdown.inProgress}
                            </span>
                            <span className="mx-2 text-gray-400">|</span>
                            <span className="text-red-600" title="Rejected">
                                {bookingBreakdown.rejected}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        );

        if (href) {
            return <Link href={href}>{content}</Link>;
        }
        return content;
    };

    const StatusBadge = ({ status, count }: { status: string; count: number }) => {
        const statusConfig: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
            completed: { color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
            pending: { color: 'text-amber-600', icon: Clock, bg: 'bg-amber-500/10' },
            accepted: { color: 'text-blue-600', icon: CheckCircle2, bg: 'bg-blue-500/10' },
            ongoing: { color: 'text-purple-600', icon: Activity, bg: 'bg-purple-500/10' },
            rejected: { color: 'text-red-600', icon: XCircle, bg: 'bg-red-500/10' },
            cancelled: { color: 'text-gray-600', icon: XCircle, bg: 'bg-gray-500/10' },
        };

        const config = statusConfig[status] || { color: 'text-gray-600', icon: Activity, bg: 'bg-gray-500/10' };
        const Icon = config.icon;

        return (
            <div className={`flex items-center gap-3 p-4 rounded-xl ${config.bg} border border-white/20 backdrop-blur-sm transition-all hover:scale-105`}>
                <div className={`${config.color} p-2 rounded-lg bg-white/50`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 capitalize">{status}</p>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
            </div>
        );
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        {/* Animated gradient background */}
                     
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Sparkles className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground drop-shadow-lg">
                                            Admin Dashboard
                                        </h1>
                                    </div>
                                    <p className="text-primary-foreground/90 text-base font-medium">
                                        Real-time insights and analytics for your platform
                                    </p>
                                </div>
                                <Link 
                                    href="/admin/providers" 
                                    className="group inline-flex items-center gap-2 rounded-xl bg-card/15 backdrop-blur-md px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 hover:bg-card/25 hover:ring-primary-foreground/35 transition-all duration-300 hover:scale-105"
                                >
                                    Manage Providers
                                    <ArrowUpRight className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <div className="mb-6 flex flex-wrap items-center gap-2">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: '7d', label: '7D' },
                                { id: '30d', label: '30D' },
                                { id: 'all', label: 'All' },
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setDashboardRange(range.id as DashboardRange)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                        dashboardRange === range.id
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                        {/* Main Stats Grid */}
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                            <StatCard
                                title="Total Transaction"
                                value={analytics.totalTransaction}
                                isCurrency
                                icon={DollarSign}
                                gradient="bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                                iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                            />
                            <StatCard
                                title="Total Top Up"
                                value={analytics.totalTopUp}
                                isCurrency
                                icon={DollarSign}
                                gradient="bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                                iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                            />
                            <StatCard
                                title="Net Flow"
                                value={analytics.totalNetFlow}
                                isCurrency
                                icon={DollarSign}
                                gradient="bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                                iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                            />
                            <StatCard
                                title="Total Providers"
                                value={providers.length}
                                icon={Users}
                                gradient="bg-gradient-to-br from-indigo-500/20 to-blue-500/20"
                                iconBg="bg-gradient-to-br from-indigo-500 to-blue-600"
                                href="/admin/providers"
                            />
                            <StatCard
                                title="Total Bookings"
                                value={bookingCount}
                                valueNode={
                                    <span className="inline-flex items-center text-3xl font-bold">
                                        <span className="relative inline-flex items-center">
                                            <span className="peer text-emerald-600">{analytics.totalCompletedBookings}</span>
                                            <span className="pointer-events-none absolute -top-7 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white peer-hover:block">
                                                Completed
                                            </span>
                                        </span>
                                        <span className="mx-2 text-gray-400">|</span>
                                        <span className="relative inline-flex items-center">
                                            <span className="peer text-blue-600">{analytics.totalInProgressBookings}</span>
                                            <span className="pointer-events-none absolute -top-7 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white peer-hover:block">
                                                In Progress
                                            </span>
                                        </span>
                                        <span className="mx-2 text-gray-400">|</span>
                                        <span className="relative inline-flex items-center">
                                            <span className="peer text-red-600">{analytics.totalRejectedBookings}</span>
                                            <span className="pointer-events-none absolute -top-7 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white peer-hover:block">
                                                Rejected
                                            </span>
                                        </span>
                                    </span>
                                }
                                icon={CalendarCheck2}
                                gradient="bg-gradient-to-br from-blue-500/20 to-indigo-500/20"
                                iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
                                iconClassName="text-indigo-950"
                                href="/admin/bookings"
                            />
                            <StatCard
                                title="Total Customers"
                                value={customerCount}
                                icon={Users}
                                gradient="bg-gradient-to-br from-violet-500/20 to-purple-500/20"
                                iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
                                href="/admin/customers"
                            />
                        </section>

                        <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Payout Health</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Includes waiting confirmations and delivery issues in selected range.
                                    </p>
                                </div>
                                <Link
                                    href="/admin/finance/payout-request"
                                    className="text-sm font-semibold text-foreground/90 underline-offset-4 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                >
                                    Open payout requests
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <Link
                                    href="/admin/finance/payout-request?segment=waiting_confirmation"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                        Waiting Confirmation
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Transfer was initiated but completion confirmation has not arrived yet. Open this to verify and resolve stuck payouts.
                                    </span>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{analytics.payoutWaitingConfirmation}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=failed_rejected"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                        Failed / Rejected
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Chapa payout failed or the request was rejected. Open this list to review reason and retry or close the case.
                                    </span>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{analytics.payoutFailedOrRejected}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=missing_payment_method"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                        Missing Payment Method
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Provider payout request exists but required bank or wallet method is incomplete or unavailable.
                                    </span>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{analytics.payoutMissingPaymentMethod}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=completed_today"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                        Completed Today
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Count of payouts marked completed during today in your selected dashboard range.
                                    </span>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{analytics.payoutCompletedToday}</p>
                                </Link>
                                <Link
                                    href="/admin/finance/payout-request?segment=failed_rejected"
                                    className="group relative rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                        Integration Issues
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </p>
                                    <span className="pointer-events-none absolute left-4 top-9 z-20 hidden w-[220px] rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:block">
                                        Transfer records with webhook or verification problems requiring manual payout investigation.
                                    </span>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{analytics.payoutIntegrationIssues}</p>
                                </Link>
                            </div>
                        </section>

                        {/* Analytics Charts Section */}
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Weekly Activity Chart */}
                            <div className="lg:col-span-2 rounded-2xl border border-subtle bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-accent-info-bg p-2">
                                            <BarChart3 className="h-5 w-5 text-accent-info" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-primary">Weekly Activity</h2>
                                            <p className="text-xs font-medium text-primary/80">
                                                {dashboardRange === 'today' ? 'Today'
                                                    : dashboardRange === '7d' ? 'Last 7 days'
                                                        : dashboardRange === '30d' ? 'Last 30 days'
                                                            : 'All time'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-full bg-subtle px-3 py-1">
                                        <Zap className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-semibold text-primary">Live</span>
                                    </div>
                                </div>
                                <div className="h-48 rounded-xl border border-subtle bg-subtle/60 p-3">
                                    <div className="flex h-full items-end gap-2">
                                    {analytics.weeklyData.map((value, idx) => {
                                        const height = maxWeeklyValue > 0 ? (value / maxWeeklyValue) * 100 : 0;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center group">
                                                <div 
                                                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-600 transition-all duration-200 group-hover:opacity-90"
                                                    style={{ height: `${height}%`, minHeight: value > 0 ? '6px' : '0' }}
                                                />
                                                <div className="mt-2 text-xs font-medium text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {value}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-between text-xs font-medium text-primary/80">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                        <span key={idx}>{day}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Monthly Overview */}
                            <div className="rounded-2xl border border-subtle bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="rounded-xl bg-accent-info-bg p-2">
                                        <Activity className="h-5 w-5 text-accent-info" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-primary">Monthly Trend</h2>
                                            <p className="text-xs font-medium text-primary/80">
                                                {dashboardRange === 'today' ? 'Today view'
                                                    : dashboardRange === '7d' ? '7-day view'
                                                        : dashboardRange === '30d' ? '30-day view'
                                                            : 'All-time view'}
                                            </p>
                                    </div>
                                </div>
                                <div className="h-48 rounded-xl border border-subtle bg-subtle/60 p-3">
                                    <div className="flex h-full items-end gap-1">
                                    {analytics.monthlyData.map((value, idx) => {
                                        const height = maxMonthlyValue > 0 ? (value / maxMonthlyValue) * 100 : 0;
                                        return (
                                            <div 
                                                key={idx} 
                                                className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-purple-600 transition-all duration-200 hover:opacity-90"
                                                style={{ height: `${height}%`, minHeight: value > 0 ? '6px' : '0' }}
                                                title={`${value} bookings`}
                                            />
                                        );
                                    })}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Status Breakdown & Quick Actions */}
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Booking Status Breakdown */}
                            <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                                        <CheckCircle2 className="h-5 w-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Booking Status</h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {Object.entries(analytics.bookingsByStatus).map(([status, count]) => (
                                        <StatusBadge key={status} status={status} count={count} />
                                    ))}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="rounded-2xl border border-subtle bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
                                    <Zap className="h-5 w-5 text-accent-info" />
                                    Quick Actions
                                </h3>
                                <ul className="space-y-3">
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-subtle bg-base px-4 py-3 text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2" 
                                            href="/admin/providers"
                                        >
                                            <span className="text-[16px] font-medium leading-[1.3]">Providers</span>
                                            <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-subtle bg-base px-4 py-3 text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2" 
                                            href="/admin/customers"
                                        >
                                            <span className="text-[16px] font-medium leading-[1.3]">Customers</span>
                                            <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-subtle bg-base px-4 py-3 text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2" 
                                            href="/admin/bookings"
                                        >
                                            <span className="text-[16px] font-medium leading-[1.3]">Bookings</span>
                                            <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex w-full items-center justify-between rounded-md border border-subtle bg-base px-4 py-3 text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2" 
                                            href="/admin/services/approve"
                                        >
                                            <span className="text-[16px] font-medium leading-[1.3]">Approve Services</span>
                                            <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
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
