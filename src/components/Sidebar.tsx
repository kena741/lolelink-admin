"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { canAccessAdminRoute, useAdminPermissions } from '@/hooks/use-admin-permissions';
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
    Activity
} from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';
import { SupabaseEnvSwitcher, SupabaseStagingBanner } from '@/components/SupabaseEnvSwitcher';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const visibleWorksItems = useMemo(
        () => worksSubItems.filter(({ href }) => canAccessAdminRoute(href, can)),
        [can]
    );
    const visibleCustomersItems = useMemo(
        () => customersSubItems.filter(({ href }) => canAccessAdminRoute(href, can)),
        [can]
    );
    const visibleProviderItems = useMemo(
        () => providerManagementSubItems.filter(({ href }) => canAccessAdminRoute(href, can)),
        [can]
    );
    const visibleCategoryItems = useMemo(
        () => categorySubItems.filter(({ href }) => canAccessAdminRoute(href, can)),
        [can]
    );
    const visibleServiceItems = useMemo(
        () =>
            serviceManagementSubItems.filter(({ href, isCategory }) => {
                if (isCategory) return visibleCategoryItems.length > 0;
                return canAccessAdminRoute(href, can);
            }),
        [can, visibleCategoryItems.length]
    );
    const visibleFinanceItems = useMemo(
        () => financeSubItems.filter(({ href }) => canAccessAdminRoute(href, can)),
        [can]
    );
    const showSettings = canAccessAdminRoute('/admin/settings', can);
    const showAdmins = canAccessAdminRoute('/admin/admins', can);
    const showActivityLogs = canAccessAdminRoute('/admin/activity-logs', can);
    const showRoles = canAccessAdminRoute('/admin/roles', can);
    const showContactMessages = canAccessAdminRoute('/admin/contact-messages', can);
    const showSystemSection =
        visibleFinanceItems.length > 0 ||
        showSettings ||
        showAdmins ||
        showActivityLogs ||
        showRoles ||
        showContactMessages;
    
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
        <aside className="admin-shell fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
                <Image
                    src="/logo.png"
                    alt="Zemen Service logo"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-[var(--radius)] object-contain"
                    priority
                />
                <span className="font-heading text-[15px] font-semibold tracking-normal text-sidebar-foreground">
                    Zemen Service
                </span>
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
                                    'group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors',
                                    navClass(pathname === '/admin/dashboard'),
                                )}
                            >
                                <LayoutDashboard className={cn('h-4 w-4', iconClass(pathname === '/admin/dashboard'))} />
                                <span>Dashboard</span>
                            </Link>
                        </li>

                        {visibleWorksItems.length > 0 && (
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
                                                className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                        )}

                        {visibleCustomersItems.length > 0 && (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Customers</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleCustomersItems.map(({ href, label, icon: Icon }) => {
                                    const active = href === '/admin/customers'
                                        ? pathname === '/admin/customers'
                                        : pathname === href;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                        )}

                        {visibleProviderItems.length > 0 && (
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
                                                className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                        )}

                        {visibleServiceItems.length > 0 && (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">Service Management</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleServiceItems.map(({ href, label, icon: Icon, isCategory }) => {
                                    if (isCategory) {
                                        // Categories sub-section (still collapsible)
                                        return (
                                            <li key="categories">
                                                <button
                                                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                                    className={`group w-full flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                                                        {visibleCategoryItems.map(({ href: catHref, label: catLabel, icon: CatIcon }) => {
                                                            const active = pathname === catHref || (catHref === '/admin/categories' && pathname?.startsWith('/admin/categories/'));
                                                            return (
                                                                <li key={catHref}>
                                                                    <Link
                                                                        href={catHref}
                                                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                                        (href === '/admin/banners' && pathname?.startsWith('/admin/banners'));
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                        )}

                        {showSystemSection && (
                        <li className="pt-5">
                            <div className="px-3 py-1 mb-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-hint">System Management</p>
                            </div>
                            <ul className="space-y-1">
                                {visibleFinanceItems.length > 0 && (
                                <li>
                                    <button
                                        onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                                        className={`group w-full flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                                                            className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
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
                                )}

                                {showSettings && (
                                <li>
                                    <Link
                                        href="/admin/settings"
                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/settings')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Settings className={`h-4 w-4 ${pathname?.startsWith('/admin/settings') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Global Settings</span>
                                    </Link>
                                </li>
                                )}
                                {showAdmins && (
                                <li>
                                    <Link
                                        href="/admin/admins"
                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/admins')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <UserCog className={`h-4 w-4 ${pathname?.startsWith('/admin/admins') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Admins</span>
                                    </Link>
                                </li>
                                )}
                                {showActivityLogs && (
                                <li>
                                    <Link
                                        href="/admin/activity-logs"
                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/activity-logs')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Activity className={`h-4 w-4 ${pathname?.startsWith('/admin/activity-logs') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Activity Logs</span>
                                    </Link>
                                </li>
                                )}
                                {showRoles && (
                                <li>
                                    <Link
                                        href="/admin/roles"
                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname?.startsWith('/admin/roles')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <Shield className={`h-4 w-4 ${pathname?.startsWith('/admin/roles') ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Roles</span>
                                    </Link>
                                </li>
                                )}
                                {showContactMessages && (
                                <li>
                                    <Link
                                        href="/admin/contact-messages"
                                        className={`group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[15px] transition-colors ${
                                            pathname === '/admin/contact-messages'
                                                ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    >
                                        <MessageSquare className={`h-4 w-4 ${pathname === '/admin/contact-messages' ? 'text-primary' : 'text-text-hint group-hover:text-muted-foreground'}`} />
                                        <span>Contact Messages</span>
                                    </Link>
                                </li>
                                )}
                            </ul>
                        </li>
                        )}
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
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={async () => { await getSupabase().auth.signOut(); location.href = '/login'; }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                    </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-text-hint">© {new Date().getFullYear()} Zemen Service</p>
            </div>
        </aside>
    );
};

export default Sidebar;
