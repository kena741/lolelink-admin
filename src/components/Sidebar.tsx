import React from 'react';
import Link from 'next/link';

const Sidebar = () => (
  <aside className="h-screen w-64 bg-gray-900 text-white flex flex-col p-6 fixed">
    <h2 className="text-2xl font-bold mb-8">Admin Panel</h2>
    <nav className="flex flex-col gap-4">
      <Link href="/" className="hover:bg-gray-700 p-2 rounded">Dashboard</Link>
      <Link href="/admin/providers" className="hover:bg-gray-700 p-2 rounded">Service Providers</Link>
      <Link href="/admin/customers" className="hover:bg-gray-700 p-2 rounded">Customers</Link>
      <Link href="/admin/bookings" className="hover:bg-gray-700 p-2 rounded">Bookings</Link>
    </nav>
  </aside>
);

export default Sidebar;
