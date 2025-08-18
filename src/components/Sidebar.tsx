"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Briefcase, CalendarCheck2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/providers', label: 'Providers', icon: Briefcase },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck2 },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600" />
        <span className="text-base font-semibold text-gray-900">Lolelink Admin</span>
      </div>
      <div className="px-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Nav */}
      <nav className="mt-4 px-3">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname?.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-700'}`} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-auto px-6 py-4">
        <button
          onClick={async () => { await supabase.auth.signOut(); location.href = '/login'; }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <p className="mt-3 text-center text-xs text-gray-500">© {new Date().getFullYear()} Lolelink</p>
      </div>
    </aside>
  );
};

export default Sidebar;
