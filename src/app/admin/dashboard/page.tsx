'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabaseClient';
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
    Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { BookedService } from '@/features/bookedService/bookedServiceSlice';

interface AnalyticsData {
    totalRevenue: number;
    monthlyRevenue: number;
    revenueChange: number;
    bookingsByStatus: Record<string, number>;
    recentBookings: BookedService[];
    weeklyData: number[];
    monthlyData: number[];
}

const Dashboard = () => {
    const dispatch: AppDispatch = useDispatch();
    const { providers, loading: providersLoading } = useSelector((state: { provider: ProviderState }) => state.provider);
    const [bookingCount, setBookingCount] = useState<number>(0);
    const [customerCount, setCustomerCount] = useState<number>(0);
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalRevenue: 0,
        monthlyRevenue: 0,
        revenueChange: 0,
        bookingsByStatus: {},
        recentBookings: [],
        weeklyData: [],
        monthlyData: []
    });
    const [countsLoading, setCountsLoading] = useState<boolean>(true);

    useEffect(() => {
        dispatch(fetchProviders());
        const fetchAnalyticsAndLists = async () => {
            setCountsLoading(true);
            
            // Fetch bookings with full data for analytics
            const { data: bookings, error: bookingsError } = await supabase
                .from('booked_service')
                .select('*')
                .order('createdAt', { ascending: false });

            if (!bookingsError && bookings) {
                setBookingCount(bookings.length);

                // Calculate revenue
                const totalRevenue = bookings.reduce((sum, booking) => {
                    return sum + (booking.totalAmount || booking.price || 0);
                }, 0);

                // Calculate monthly revenue (last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const monthlyBookings = bookings.filter(booking => {
                    const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                    return createdAt && createdAt >= thirtyDaysAgo;
                });
                const monthlyRevenue = monthlyBookings.reduce((sum, booking) => {
                    return sum + (booking.totalAmount || booking.price || 0);
                }, 0);

                // Calculate previous month revenue for comparison
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                const previousMonthBookings = bookings.filter(booking => {
                    const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                    return createdAt && createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
                });
                const previousMonthRevenue = previousMonthBookings.reduce((sum, booking) => {
                    return sum + (booking.totalAmount || booking.price || 0);
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

                // Get weekly data (last 7 days)
                const weeklyData = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    date.setHours(0, 0, 0, 0);
                    const nextDate = new Date(date);
                    nextDate.setDate(nextDate.getDate() + 1);
                    
                    return bookings.filter(booking => {
                        const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                        return createdAt && createdAt >= date && createdAt < nextDate;
                    }).length;
                });

                // Get monthly data (last 12 months)
                const monthlyData = Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - (11 - i));
                    date.setDate(1);
                    date.setHours(0, 0, 0, 0);
                    const nextDate = new Date(date);
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    
                    return bookings.filter(booking => {
                        const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
                        return createdAt && createdAt >= date && createdAt < nextDate;
                    }).length;
                });

                setAnalytics({
                    totalRevenue,
                    monthlyRevenue,
                    revenueChange,
                    bookingsByStatus,
                    recentBookings: bookings.slice(0, 5),
                    weeklyData,
                    monthlyData
                });
            }

            // Count customers
            const { count: custCount } = await supabase
                .from('customer')
                .select('*', { count: 'exact', head: true });
            setCustomerCount(custCount ?? 0);
            setCountsLoading(false);
        };
        fetchAnalyticsAndLists();
    }, [dispatch]);

    const isLoading = providersLoading || countsLoading;

    // Calculate max value for chart scaling
    const maxWeeklyValue = Math.max(...analytics.weeklyData, 1);
    const maxMonthlyValue = Math.max(...analytics.monthlyData, 1);

    const StatCard = ({ 
        title, 
        value, 
        change, 
        icon: Icon, 
        gradient, 
        iconBg,
        href 
    }: { 
        title: string; 
        value: number | string; 
        change?: number; 
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
                            <Icon className="h-6 w-6 text-white" />
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
                        ) : (
                            typeof value === 'number' && title.includes('Revenue') 
                                ? `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : value.toLocaleString()
                        )}
                    </p>
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
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden">
                        {/* Animated gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        
                        {/* Animated orbs */}
                        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Sparkles className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Admin Dashboard
                                        </h1>
                                    </div>
                                    <p className="text-white/90 text-base font-medium">
                                        Real-time insights and analytics for your platform
                                    </p>
                                </div>
                                <Link 
                                    href="/admin/providers" 
                                    className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                >
                                    Manage Providers
                                    <ArrowUpRight className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Main Stats Grid */}
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="Total Revenue"
                                value={analytics.totalRevenue}
                                change={analytics.revenueChange}
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
                                icon={CalendarCheck2}
                                gradient="bg-gradient-to-br from-purple-500/20 to-pink-500/20"
                                iconBg="bg-gradient-to-br from-purple-500 to-pink-600"
                                href="/admin/bookings"
                            />
                            <StatCard
                                title="Total Customers"
                                value={customerCount}
                                icon={UserPlus}
                                gradient="bg-gradient-to-br from-fuchsia-500/20 to-rose-500/20"
                                iconBg="bg-gradient-to-br from-fuchsia-500 to-rose-600"
                                href="/admin/customers"
                            />
                        </section>

                        {/* Analytics Charts Section */}
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Weekly Activity Chart */}
                            <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                                            <BarChart3 className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">Weekly Activity</h2>
                                            <p className="text-xs text-gray-600">Last 7 days</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full">
                                        <Zap className="h-4 w-4 text-indigo-600" />
                                        <span className="text-xs font-semibold text-indigo-600">Live</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 h-48">
                                    {analytics.weeklyData.map((value, idx) => {
                                        const height = maxWeeklyValue > 0 ? (value / maxWeeklyValue) * 100 : 0;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center group">
                                                <div 
                                                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 via-purple-500 to-fuchsia-500 transition-all duration-500 hover:from-indigo-400 hover:via-purple-400 hover:to-fuchsia-400 group-hover:shadow-lg group-hover:shadow-purple-500/50"
                                                    style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
                                                />
                                                <div className="mt-2 text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {value}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between mt-4 text-xs text-gray-500">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                        <span key={idx}>{day}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Monthly Overview */}
                            <div className="rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                                        <Activity className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Monthly Trend</h2>
                                        <p className="text-xs text-gray-600">Last 12 months</p>
                                    </div>
                                </div>
                                <div className="flex items-end gap-1 h-48">
                                    {analytics.monthlyData.map((value, idx) => {
                                        const height = maxMonthlyValue > 0 ? (value / maxMonthlyValue) * 100 : 0;
                                        return (
                                            <div 
                                                key={idx} 
                                                className="flex-1 rounded-t-md bg-gradient-to-t from-purple-500 to-pink-500 transition-all duration-300 hover:from-purple-400 hover:to-pink-400"
                                                style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
                                                title={`${value} bookings`}
                                            />
                                        );
                                    })}
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
                            <div className="rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-indigo-600" />
                                    Quick Actions
                                </h3>
                                <ul className="space-y-3">
                                    <li>
                                        <Link 
                                            className="group flex items-center justify-between w-full rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 px-4 py-3 hover:from-indigo-500/20 hover:to-purple-500/20 hover:border-indigo-300/50 transition-all duration-300 hover:scale-[1.02]" 
                                            href="/admin/providers"
                                        >
                                            <span className="font-medium text-gray-700">Providers</span>
                                            <ArrowUpRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex items-center justify-between w-full rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 px-4 py-3 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-300/50 transition-all duration-300 hover:scale-[1.02]" 
                                            href="/admin/customers"
                                        >
                                            <span className="font-medium text-gray-700">Customers</span>
                                            <ArrowUpRight className="h-4 w-4 text-purple-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex items-center justify-between w-full rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200/50 px-4 py-3 hover:from-emerald-500/20 hover:to-teal-500/20 hover:border-emerald-300/50 transition-all duration-300 hover:scale-[1.02]" 
                                            href="/admin/bookings"
                                        >
                                            <span className="font-medium text-gray-700">Bookings</span>
                                            <ArrowUpRight className="h-4 w-4 text-emerald-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </Link>
                                    </li>
                                    <li>
                                        <Link 
                                            className="group flex items-center justify-between w-full rounded-xl bg-gradient-to-r from-fuchsia-500/10 to-rose-500/10 border border-fuchsia-200/50 px-4 py-3 hover:from-fuchsia-500/20 hover:to-rose-500/20 hover:border-fuchsia-300/50 transition-all duration-300 hover:scale-[1.02]" 
                                            href="/admin/services/approve"
                                        >
                                            <span className="font-medium text-gray-700">Approve Services</span>
                                            <ArrowUpRight className="h-4 w-4 text-fuchsia-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
};

export default Dashboard;
