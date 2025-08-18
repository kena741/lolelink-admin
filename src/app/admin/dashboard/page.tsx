'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabaseClient';
import { fetchProviders, ProviderState } from '@/features/provider/providerSlice';
import { AppDispatch } from '@/store/store';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { Users, CalendarCheck2, UserPlus, Activity, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const Dashboard = () => {
    const dispatch: AppDispatch = useDispatch();
    const { providers, loading: providersLoading } = useSelector((state: { provider: ProviderState }) => state.provider);
    const [bookingCount, setBookingCount] = useState<number>(0);
    const [customerCount, setCustomerCount] = useState<number>(0);
    const [countsLoading, setCountsLoading] = useState<boolean>(true);

    useEffect(() => {
        dispatch(fetchProviders());
        const fetchAnalyticsAndLists = async () => {
            setCountsLoading(true);
            // Optional: fetch analytics data here if needed later

            // Efficient count of bookings from booked_service without fetching rows
            const { count } = await supabase
                .from('booked_service')
                .select('*', { count: 'exact', head: true });
            setBookingCount(count ?? 0);

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
    const analyticsPreview = useMemo(() => {
        // Predefined bar heights using Tailwind classes (no inline styles)
        return ['h-16', 'h-24', 'h-14', 'h-28', 'h-20', 'h-36', 'h-24'];
    }, []);

    return (
        <AuthGuard>
            <div className="flex">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Top header */}
                    <div className="relative isolate overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
                        <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Admin Dashboard</h1>
                                    <p className="mt-2 text-white/80 text-sm">Overview of your platform’s activity and key metrics.</p>
                                </div>
                                <Link href="/admin/providers" className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/15">
                                    Manage Providers
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 bg-gray-50">

                        {/* Overview Stats */}
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Providers card */}
                            <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Users className="h-5 w-5" /></div>
                                        <div>
                                            <p className="text-sm text-gray-500">Total Providers</p>
                                            <p className="mt-1 text-3xl font-semibold text-gray-900">{isLoading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-gray-200" /> : providers.length}</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/providers" className="text-xs text-indigo-600 hover:underline">View all</Link>
                                </div>
                            </div>
                            {/* Bookings card */}
                            <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><CalendarCheck2 className="h-5 w-5" /></div>
                                        <div>
                                            <p className="text-sm text-gray-500">Total Bookings</p>
                                            <p className="mt-1 text-3xl font-semibold text-gray-900">{isLoading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-gray-200" /> : bookingCount}</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/bookings" className="text-xs text-emerald-700 hover:underline">View all</Link>
                                </div>
                            </div>
                            {/* Customers card */}
                            <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-fuchsia-50 p-2 text-fuchsia-600"><UserPlus className="h-5 w-5" /></div>
                                        <div>
                                            <p className="text-sm text-gray-500">Total Customers</p>
                                            <p className="mt-1 text-3xl font-semibold text-gray-900">{isLoading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-gray-200" /> : customerCount}</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/customers" className="text-xs text-fuchsia-700 hover:underline">View all</Link>
                                </div>
                            </div>
                        </section>
                        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Analytics preview */}
                            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-md bg-indigo-50 p-2 text-indigo-600"><Activity className="h-4 w-4" /></div>
                                        <h2 className="text-base font-semibold text-gray-900">Analytics</h2>
                                    </div>
                                    <span className="text-xs text-gray-500">Preview</span>
                                </div>
                                <div className="mt-6 flex items-end gap-3 h-36">
                                    {analyticsPreview.map((hClass, idx) => (
                                        <div key={idx} className={`flex-1 rounded-md bg-gradient-to-t from-indigo-200 to-indigo-500 ${hClass}`} />
                                    ))}
                                </div>
                            </div>
                            {/* Quick links */}
                            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                                <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Links</h3>
                                <ul className="space-y-3 text-sm">
                                    <li><Link className="inline-flex items-center justify-between w-full rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50" href="/admin/providers">Providers <ArrowUpRight className="h-4 w-4" /></Link></li>
                                    <li><Link className="inline-flex items-center justify-between w-full rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50" href="/admin/customers">Customers <ArrowUpRight className="h-4 w-4" /></Link></li>
                                    <li><Link className="inline-flex items-center justify-between w-full rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50" href="/admin/bookings">Bookings <ArrowUpRight className="h-4 w-4" /></Link></li>
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
