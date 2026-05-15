"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    LayoutDashboard, 
    Users, 
    Briefcase, 
    CalendarCheck2, 
    LogOut, 
    DollarSign, 
    Wallet,
    CreditCard, 
    Receipt, 
    ChevronDown, 
    ChevronRight, 
    FileCheck, 
    Settings, 
    FolderTree, 
    FolderKanban, 
    Wrench,
    FileImage,
    FileText,
    Ticket,
    CheckSquare,
    MessageSquare,
    Moon,
    Sun
} from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';
import { SupabaseEnvSwitcher, SupabaseStagingBanner } from '@/components/SupabaseEnvSwitcher';
import Image from 'next/image';

// Provider Management Section
const providerManagementSubItems = [
    { href: '/admin/providers', label: 'Providers', icon: Briefcase },
    { href: '/admin/verify-documents', label: 'Verify Documents', icon: FileCheck },
];

// Service Management Section
const serviceManagementSubItems = [
    { href: '/admin/services/approve', label: 'All Services', icon: CheckSquare },
    { href: '/admin/categories', label: 'Categories', icon: FolderTree, isCategory: true },
    { href: '/admin/documents', label: 'Documents', icon: FileText },
    { href: '/admin/banners', label: 'Banners', icon: FileImage },
    { href: '/admin/coupon', label: 'Coupon', icon: Ticket },
];

const categorySubItems = [
    { href: '/admin/categories', label: 'Category', icon: FolderTree },
    { href: '/admin/subcategories', label: 'Subcategory', icon: FolderKanban },
];

// Works Section
const worksSubItems = [
    { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck2 },
    { href: '/admin/handyman', label: 'Handyman', icon: Wrench },
];

// Customers Section
const customersSubItems = [
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/customers/job-requests', label: 'Job Requests', icon: FileText },
];

// System Management Section
const financeSubItems = [
    { href: '/admin/finance/payout-request', label: 'Payout Request', icon: DollarSign },
    { href: '/admin/finance/payment', label: 'Payment', icon: CreditCard },
    { href: '/admin/finance/payment-settings', label: 'Payment Settings', icon: Settings },
    { href: '/admin/finance/wallet-transactions', label: 'Wallet Transactions', icon: Wallet },
    { href: '/admin/finance/taxes', label: 'Taxes', icon: Receipt },
];

const Sidebar = () => {
    const pathname = usePathname();
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    
    // Category sub-section (still collapsible)
    const isCategoryActive = pathname?.startsWith('/admin/categories') || pathname?.startsWith('/admin/subcategories');
    const [isCategoryOpen, setIsCategoryOpen] = useState(isCategoryActive);
    
    // Finance sub-section (still collapsible)
    const isFinanceActive = pathname?.startsWith('/admin/finance');
    const [isFinanceOpen, setIsFinanceOpen] = useState(isFinanceActive);

    React.useEffect(() => {
        if (isCategoryActive) {
            setIsCategoryOpen(true);
        }
    }, [isCategoryActive]);

    React.useEffect(() => {
        if (isFinanceActive) {
            setIsFinanceOpen(true);
        }
    }, [isFinanceActive]);

    React.useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const initialTheme = savedTheme === 'light' || savedTheme === 'dark'
            ? savedTheme
            : 'dark';
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
        setTheme(initialTheme);
    }, []);

    const toggleTheme = () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
        localStorage.setItem('theme', nextTheme);
    };

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur supports-[backdrop-filter]:bg-sidebar/90">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                {/* Brand */}
                <div className="flex items-center gap-2 ">
                    <Image
                        src="/logo.png"
                        alt="Zemen Service logo"
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-lg object-contain"
                        priority
                    />
                    <span className="text-base font-semibold text-sidebar-foreground">Zemen Service Admin</span>
                </div>
                <SupabaseStagingBanner />
                <div className="px-6">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
                </div>

                {/* Nav */}
                <nav className="mt-4 px-3 pb-6">
                    <ul className="space-y-1">
                        {/* Dashboard */}
                        <li>
                            <Link
                                href="/admin/dashboard"
                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    pathname === '/admin/dashboard'
                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                }`}
                            >
                                <LayoutDashboard className={`h-4 w-4 ${pathname === '/admin/dashboard' ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                <span>Dashboard</span>
                            </Link>
                        </li>

                        {/* Works Section */}
                        <li className="pt-2">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Works</p>
                            </div>
                            <ul className="space-y-1">
                                {worksSubItems.map(({ href, label, icon: Icon }) => {
                                    const active = pathname === href;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    active
                                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>

                        {/* Customers Section */}
                        <li className="pt-2">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customers</p>
                            </div>
                            <ul className="space-y-1">
                                {customersSubItems.map(({ href, label, icon: Icon }) => {
                                    const active = href === '/admin/customers'
                                        ? pathname === '/admin/customers'
                                        : pathname === href;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    active
                                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>

                        {/* Provider Management Section */}
                        <li className="pt-2">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider Management</p>
                            </div>
                            <ul className="space-y-1">
                                {providerManagementSubItems.map(({ href, label, icon: Icon }) => {
                                    const active = pathname === href || (href === '/admin/providers' && pathname?.startsWith('/admin/providers/'));
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    active
                                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>

                        {/* Service Management Section */}
                        <li className="pt-2">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service Management</p>
                            </div>
                            <ul className="space-y-1">
                                {serviceManagementSubItems.map(({ href, label, icon: Icon, isCategory }) => {
                                    if (isCategory) {
                                        // Categories sub-section (still collapsible)
                                        return (
                                            <li key="categories">
                                                <button
                                                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                                    className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                        isCategoryActive
                                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                            : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Icon className={`h-4 w-4 ${isCategoryActive ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                        <span>{label}</span>
                                                    </div>
                                                    {isCategoryOpen ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </button>
                                                {isCategoryOpen && (
                                                    <ul className="mt-1 ml-7 space-y-1">
                                                        {categorySubItems.map(({ href: catHref, label: catLabel, icon: CatIcon }) => {
                                                            const active = pathname === catHref || (catHref === '/admin/categories' && pathname?.startsWith('/admin/categories/'));
                                                            return (
                                                                <li key={catHref}>
                                                                    <Link
                                                                        href={catHref}
                                                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                                            active
                                                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                                                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                                        }`}
                                                                    >
                                                                        <CatIcon className={`h-3.5 w-3.5 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                                        <span>{catLabel}</span>
                                                                    </Link>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    }
                                    const active = pathname === href || 
                                        (href === '/admin/services/approve' && pathname?.startsWith('/admin/services')) ||
                                        (href === '/admin/documents' && pathname?.startsWith('/admin/documents')) ||
                                        (href === '/admin/banners' && pathname?.startsWith('/admin/banners'));
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    active
                                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>

                        {/* System Management Section */}
                        <li className="pt-2">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Management</p>
                            </div>
                            <ul className="space-y-1">
                                {/* Finance Sub-section (still collapsible) */}
                                <li>
                                    <button
                                        onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                                        className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                            isFinanceActive
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <DollarSign className={`h-4 w-4 ${isFinanceActive ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                            <span>Finance</span>
                                        </div>
                                        {isFinanceOpen ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                                                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                                            }`}
                                                        >
                                                            <Icon className={`h-3.5 w-3.5 ${active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                                            <span>{label}</span>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>

                                {/* Global Settings */}
                                <li>
                                    <Link
                                        href="/admin/settings"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                            pathname?.startsWith('/admin/settings')
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                        }`}
                                    >
                                        <Settings className={`h-4 w-4 ${pathname?.startsWith('/admin/settings') ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                        <span>Global Settings</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/admin/contact-messages"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                            pathname === '/admin/contact-messages'
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-inset ring-sidebar-ring/40'
                                                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                        }`}
                                    >
                                        <MessageSquare className={`h-4 w-4 ${pathname === '/admin/contact-messages' ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                                        <span>Contact Messages</span>
                                    </Link>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </nav>
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-sidebar-border px-6 py-4">
                <SupabaseEnvSwitcher />
                <button
                    onClick={toggleTheme}
                    className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                >
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </button>
                <button
                    onClick={async () => { await getSupabase().auth.signOut(); location.href = '/login'; }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                >
                    <LogOut className="h-4 w-4" />
                    Sign out
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Zemen Service</p>
            </div>
        </aside>
    );
};

export default Sidebar;
