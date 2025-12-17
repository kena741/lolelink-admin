"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Briefcase, CalendarCheck2, LogOut, DollarSign, CreditCard, Receipt, ChevronDown, ChevronRight, FileCheck, Settings, FolderTree, FolderKanban, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/providers', label: 'Providers', icon: Briefcase },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck2 },
    { href: '/admin/services/approve', label: 'Approve Services', icon: CalendarCheck2 },
    { href: '/admin/verify-documents', label: 'Verify Documents', icon: FileCheck },
    { href: '/admin/handyman', label: 'Handyman', icon: Wrench },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const financeSubItems = [
    { href: '/admin/finance/payout-request', label: 'Payout Request', icon: DollarSign },
    { href: '/admin/finance/payment', label: 'Payment', icon: CreditCard },
    { href: '/admin/finance/taxes', label: 'Taxes', icon: Receipt },
];

const categorySubItems = [
    { href: '/admin/categories', label: 'Category', icon: FolderTree },
    { href: '/admin/subcategories', label: 'Subcategory', icon: FolderKanban },
];

const Sidebar = () => {
    const pathname = usePathname();
    const isFinanceActive = pathname?.startsWith('/admin/finance');
    const isCategoryActive = pathname?.startsWith('/admin/categories') || pathname?.startsWith('/admin/subcategories');
    const [isFinanceOpen, setIsFinanceOpen] = useState(isFinanceActive);
    const [isCategoryOpen, setIsCategoryOpen] = useState(isCategoryActive);

    React.useEffect(() => {
        if (isFinanceActive) {
            setIsFinanceOpen(true);
        }
    }, [isFinanceActive]);

    React.useEffect(() => {
        if (isCategoryActive) {
            setIsCategoryOpen(true);
        }
    }, [isCategoryActive]);

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 flex flex-col">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                {/* Brand */}
                <div className="flex items-center gap-2 px-6 py-5">
                    <Image
                        src="/img/logoicon.png"
                        alt="Lolelink logo"
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-lg object-contain"
                        priority
                    />
                    <span className="text-base font-semibold text-gray-900">Lolelink Admin</span>
                </div>
                <div className="px-6">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                </div>

                {/* Nav */}
                <nav className="mt-4 px-3 pb-6">
                    <ul className="space-y-1">
                        {navItems.map(({ href, label, icon: Icon }) => {
                            const active = pathname === href || (href !== '/admin/dashboard' && pathname?.startsWith(href));
                            return (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active
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
                        
                        {/* Finance Section */}
                        <li>
                            <button
                                onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                                className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    isFinanceActive
                                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <DollarSign className={`h-4 w-4 ${isFinanceActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-700'}`} />
                                    <span>Finance</span>
                                </div>
                                {isFinanceOpen ? (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                            </button>
                            {isFinanceOpen && (
                                <ul className="mt-1 ml-7 space-y-1">
                                    {financeSubItems.map(({ href, label, icon: Icon }) => {
                                        const active = pathname === href;
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
                                                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-700'}`} />
                                                    <span>{label}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>

                        {/* Category Section */}
                        <li>
                            <button
                                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    isCategoryActive
                                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <FolderTree className={`h-4 w-4 ${isCategoryActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-700'}`} />
                                    <span>Category</span>
                                </div>
                                {isCategoryOpen ? (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                            </button>
                            {isCategoryOpen && (
                                <ul className="mt-1 ml-7 space-y-1">
                                    {categorySubItems.map(({ href, label, icon: Icon }) => {
                                        const active = pathname === href || (href === '/admin/categories' && pathname?.startsWith('/admin/categories/'));
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
                                                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-700'}`} />
                                                    <span>{label}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    </ul>
                </nav>
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-gray-200 px-6 py-4">
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
