'use client';
import React, { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers } from '@/features/customer/customerSlice';

export default function CustomersPage() {
  const dispatch = useAppDispatch();
  const { customers, loading, error } = useAppSelector((s) => s.customer);

  useEffect(() => {
    dispatch(fetchAllCustomers());
  }, [dispatch]);

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 w-full p-10 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Customers</h1>
        {loading && <div>Loading customers...</div>}
        {error && <div className="text-red-500">{error}</div>}
        {!loading && customers.length === 0 && <div>No customers yet.</div>}

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-100 text-sm text-gray-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Last Request</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3">{c.email || '-'}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.address || '-'}</td>
                  <td className="px-4 py-3">{c.last_request_at ? new Date(c.last_request_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
