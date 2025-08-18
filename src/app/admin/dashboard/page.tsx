'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabaseClient';
import { fetchProviders, ProviderState } from '@/features/provider/providerSlice';
import { AppDispatch } from '@/store/store';
import Sidebar from '@/components/Sidebar';

const Dashboard = () => {
  const dispatch: AppDispatch = useDispatch();
  const { providers } = useSelector((state: { provider: ProviderState }) => state.provider);
  const [analytics, setAnalytics] = useState<Record<string, unknown>[] | null>(null);
  const [bookingCount, setBookingCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);

  useEffect(() => {
    dispatch(fetchProviders());
    const fetchAnalyticsAndLists = async () => {
      const { data: analyticsData } = await supabase.from('analytics').select('*');
      setAnalytics(Array.isArray(analyticsData) ? analyticsData : []);

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
    };
    fetchAnalyticsAndLists();
  }, [dispatch]);

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 w-full p-10 bg-gray-50 min-h-screen">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Admin Dashboard</h1>

        {/* Overview Stats */}
        <section className="mb-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="bg-white rounded shadow p-6">
            <div className="text-sm text-gray-500">Total Providers</div>
            <div className="mt-2 text-3xl font-semibold text-gray-800">{providers.length}</div>
          </div>
          <div className="bg-white rounded shadow p-6">
            <div className="text-sm text-gray-500">Total Bookings</div>
            <div className="mt-2 text-3xl font-semibold text-gray-800">{bookingCount}</div>
          </div>
          <div className="bg-white rounded shadow p-6">
            <div className="text-sm text-gray-500">Total Customers</div>
            <div className="mt-2 text-3xl font-semibold text-gray-800">{customerCount}</div>
          </div>
        </section>
        <section className="mb-10 bg-white rounded shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Analytics</h2>
          {/* Render analytics charts/stats here */}
          <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify(analytics, null, 2)}</pre>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
