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
    Sun,
    Shield,
    UserCog,
    Activity,
    Smartphone,
    Table2,
    X,
} from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';
import { SupabaseEnvSwitcher, SupabaseStagingBanner } from '@/components/SupabaseEnvSwitcher';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { canAccessAdminRoute, useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useAdminNav } from '@/lib/admin-nav-context';

function navClass(active: boolean) {
    return active
        ? 'bg-primary/10 text-primary font-medium'
        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground';
}

function iconClass(active: boolean) {
    return active
        ? 'text-primary'
        : 'text-text-hint group-hover:text-muted-foreground';
}

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
    { href: '/admin/marketing-tracker', label: 'Marketing Tracker', icon: Table2 },
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
    const { can } = useAdminPermissions();
    const { open, setOpen } = useAdminNav();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const isCategoryActive = pathname?.startsWith('/admin/categories') || pathname?.startsWith('/admin/subcategories');
    const [isCategoryOpen, setIsCategoryOpen] = useState(isCategoryActive);

    const isFinanceActive = pathname?.startsWith('/admin/finance');
    const [isFinanceOpen, setIsFinanceOpen] = useState(isFinanceActive);

    const canReadAdmins = can('admins:read');
    const canReadRoles = can('roles:read');
    const canReadLogs = can('logs:read');
    const canReadSettings = can('settings:read');
    const showMobileAppConfig = canAccessAdminRoute('/admin/mobile-app-config', can);
    const showFinance = canAccessAdminRoute('/admin/finance', can);
    const showContactMessages = canAccessAdminRoute('/admin/contact-messages', can);

    const visibleWorksItems = worksSubItems.filter((item) => canAccessAdminRoute(item.href, can));
    const visibleCustomerItems = customersSubItems.filter((item) =>
        canAccessAdminRoute(item.href, can)
    );
    const visibleProviderItems = providerManagementSubItems.filter((item) =>
        canAccessAdminRoute(item.href, can)
    );
    const visibleServiceItems = serviceManagementSubItems.filter((item) => {
        if (item.isCategory) return canAccessAdminRoute('/admin/categories', can);
        return canAccessAdminRoute(item.href, can);
    });
    const visibleFinanceItems = financeSubItems.filter((item) =>
        canAccessAdminRoute(item.href, can)
    );

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
            : 'light';
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
        setTheme(initialTheme);
    }, []);

    const toggleTheme = () => {
        setTheme((prev) => {
            const nextTheme = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.classList.toggle('dark', nextTheme === 'dark');
            localStorage.setItem('theme', nextTheme);
            return nextTheme;
        });
    };

    return (
        <>
            {/* Mobile backdrop */}
            <button
                type="button"
                aria-label="Close navigation"
                className={cn(
                    'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
            />

            <aside
                id="admin-sidebar"
                className={cn(
                    'admin-shell fixed left-0 top-0 z-50 flex h-dvh w-64 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
                    'transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none',
                    'lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 sm:h-16 sm:px-5">
                <Image
                    src="/logo.png"
                    alt="Zemen Service logo"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-lg object-contain"
                    priority
                />
                <span className="min-w-0 flex-1 font-heading text-[15px] font-semibold tracking-normal text-sidebar-foreground">
                    Zemen Service
                </span>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
                    aria-label="Close navigation"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
                <SupabaseStagingBanner />
                <nav>
                    <ul className="space-y-0.5">
                        {/* Dashboard */}
                        <li>
                            <Link
                                href="/admin/dashboard"
                                className={cn(
                                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
                                    navClass(pathname === '/admin/dashboard'),
                                )}
                            >
                                <LayoutDashboard className={cn('h-4 w-4', iconClass(pathname === '/admin/dashboard'))} />
                                <span>Dashboard</span>
                            </Link>
                        </li>

                        {/* Works Section */}
                        {visibleWorksItems.length > 0 ? (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Works</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleWorksItems.map(({ href, label, icon: Icon }) => {
                                    const active = pathname === href;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                    active
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                        ) : null}

                        {/* Customers Section */}
                        {visibleCustomerItems.length > 0 ? (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Customers</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleCustomerItems.map(({ href, label, icon: Icon }) => {
                                    const active = href === '/admin/customers'
                                        ? pathname === '/admin/customers'
                                        : pathname === href;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                    active
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                        ) : null}

                        {/* Provider Management Section */}
                        {visibleProviderItems.length > 0 ? (
                            <li className="pt-5">
                                <div className="px-3 py-1 mb-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Provider Management</p>
                                </div>
                                <ul className="space-y-1">
                                    {visibleProviderItems.map(({ href, label, icon: Icon }) => {
                                        const active = pathname === href || (href === '/admin/providers' && pathname?.startsWith('/admin/providers/'));
                                        return (
                                            <li key={href}>
                                                <Link
                                                    href={href}
                                                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                        active
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                    }`}
                                                >
                                                    <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                    <span>{label}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ) : null}

                        {/* Service Management Section */}
                        {visibleServiceItems.length > 0 ? (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Service Management</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleServiceItems.map(({ href, label, icon: Icon, isCategory }) => {
                                    if (isCategory) {
                                        return (
                                            <li key="categories">
                                                <button
                                                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                                    className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                        isCategoryActive
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Icon className={`h-4 w-4 ${isCategoryActive ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                        <span>{label}</span>
                                                    </div>
                                                    {isCategoryOpen ? (
                                                        <ChevronDown className="h-4 w-4 text-text-hint" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-text-hint" />
                                                    )}
                                                </button>
                                                {isCategoryOpen && (
                                                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                                                        {categorySubItems.map(({ href: catHref, label: catLabel, icon: CatIcon }) => {
                                                            const active = pathname === catHref || (catHref === '/admin/categories' && pathname?.startsWith('/admin/categories/'));
                                                            return (
                                                                <li key={catHref}>
                                                                    <Link
                                                                        href={catHref}
                                                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                                            active
                                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                                        }`}
                                                                    >
                                                                        <CatIcon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
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
                                        (href === '/admin/banners' && pathname?.startsWith('/admin/banners')) ||
                                        (href === '/admin/marketing-tracker' && pathname?.startsWith('/admin/marketing-tracker'));
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                    active
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                        ) : null}

                        {/* System Management Section */}
                        {(showFinance || canReadSettings || showMobileAppConfig || canReadAdmins || canReadLogs || canReadRoles || showContactMessages) ? (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">System Management</p>
                            </div>
                            <ul className="space-y-1">
                                {showFinance ? (
                                <li>
                                    <button
                                        onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                                        className={`group w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                            isFinanceActive
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <DollarSign className={`h-4 w-4 ${isFinanceActive ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                            <span>Finance</span>
                                        </div>
                                        {isFinanceOpen ? (
                                            <ChevronDown className="h-4 w-4 text-text-hint" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-text-hint" />
                                        )}
                                    </button>
                                    {isFinanceOpen && (
                                        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                                            {visibleFinanceItems.map(({ href, label, icon: Icon }) => {
                                                const active = pathname === href;
                                                return (
                                                    <li key={href}>
                                                        <Link
                                                            href={href}
                                                            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                                active
                                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                                            }`}
                                                        >
                                                            <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                                            <span>{label}</span>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                                ) : null}

                                {canReadSettings ? (
                                <li>
                                    <Link
                                        href="/admin/settings"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/settings')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Settings className={`h-4 w-4 ${pathname?.startsWith('/admin/settings') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Global Settings</span>
                                    </Link>
                                </li>
                                ) : null}
                                {showMobileAppConfig ? (
                                <li>
                                    <Link
                                        href="/admin/mobile-app-config"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/mobile-app-config')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Smartphone className={`h-4 w-4 ${pathname?.startsWith('/admin/mobile-app-config') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Mobile App Config</span>
                                    </Link>
                                </li>
                                ) : null}
                                {canReadAdmins ? (
                                    <li>
                                        <Link
                                            href="/admin/admins"
                                            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                pathname?.startsWith('/admin/admins')
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                            }`}
                                        >
                                            <UserCog className={`h-4 w-4 ${pathname?.startsWith('/admin/admins') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                            <span>Admins</span>
                                        </Link>
                                    </li>
                                ) : null}
                                {canReadLogs ? (
                                <li>
                                    <Link
                                        href="/admin/activity-logs"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/activity-logs')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Activity className={`h-4 w-4 ${pathname?.startsWith('/admin/activity-logs') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Activity Logs</span>
                                    </Link>
                                </li>
                                ) : null}
                                {canReadRoles ? (
                                    <li>
                                        <Link
                                            href="/admin/roles"
                                            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                                pathname?.startsWith('/admin/roles')
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                            }`}
                                        >
                                            <Shield className={`h-4 w-4 ${pathname?.startsWith('/admin/roles') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                            <span>Roles</span>
                                        </Link>
                                    </li>
                                ) : null}
                                {showContactMessages ? (
                                <li>
                                    <Link
                                        href="/admin/contact-messages"
                                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname === '/admin/contact-messages'
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <MessageSquare className={`h-4 w-4 ${pathname === '/admin/contact-messages' ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Contact Messages</span>
                                    </Link>
                                </li>
                                ) : null}
                            </ul>
                        </li>
                        ) : null}
                    </ul>
                </nav>
            </div>

            <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
                <SupabaseEnvSwitcher compact />
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={async () => { await getSupabase().auth.signOut(); location.href = '/login'; }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                    </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-text-hint">© {new Date().getFullYear()} Zemen Service</p>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
