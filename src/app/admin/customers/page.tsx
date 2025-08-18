"use client";
import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllCustomers } from '@/features/customer/customerSlice';
import { Search, Users } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AuthGuard from '@/components/AuthGuard';

export default function CustomersPage() {
  const dispatch = useAppDispatch();
  const { customers, loading, error } = useAppSelector((s) => s.customer);
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(fetchAllCustomers());
  }, [dispatch]);

  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 w-full min-h-screen">
        {/* Page header */}
        <div className="relative isolate overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-white/15 p-2 text-white ring-1 ring-white/20">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Customers</h1>
                  <p className="mt-1 text-white/80 text-sm">Directory of customers and their recent activity.</p>
                </div>
              </div>
              <div className="text-sm text-white/80">{customers.length} total</div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 bg-gray-50">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-96">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, phone, address..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          </div>

          {loading && <div className="mb-4 text-sm text-gray-600">Loading customers...</div>}
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {!loading && customers.length === 0 && <div className="text-sm text-gray-600">No customers yet.</div>}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-600">
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Last Request</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers
                  .filter((c) => {
                    const q = query.toLowerCase();
                    if (!q) return true;
                    const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
                    const email = (c.email ?? '').toLowerCase();
                    const phone = (c.phone ?? '').toLowerCase();
                    const address = (c.address ?? '').toLowerCase();
                    return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
                  })
                  .map((c) => (
                    <TableRow key={c.id} className="hover:bg-gray-50/60">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 grid place-items-center text-xs font-semibold">
                            {(() => {
                              const first = (c.first_name ?? '').toString();
                              const last = (c.last_name ?? '').toString();
                              const parts = `${first} ${last}`.trim().split(/\s+/).filter(Boolean);
                              const initials = parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
                              return initials || 'CU';
                            })()}
                          </div>
                          <div>
                            <div className="text-gray-900">{c.first_name} {c.last_name}</div>
                            {c.address && <div className="text-xs text-gray-500">{c.address}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{c.email || '-'}</TableCell>
                      <TableCell>{c.phone || '-'}</TableCell>
                      <TableCell>{c.address || '-'}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{c.last_request_at ? new Date(c.last_request_at).toLocaleString() : '-'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                {customers.length === 0 && !loading && (
                  <TableRow>
                    <TableCell className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                      No customers yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption>All customers</TableCaption>
            </Table>
          </div>
        </div>
        </main>
      </div>
    </AuthGuard>
  );
}
