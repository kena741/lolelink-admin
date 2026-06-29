import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

export const adminPageMainClassName =
    'ml-64 min-h-screen min-w-0 flex-1 overflow-x-hidden';

export const adminPageContentClassName = 'mx-auto min-w-0 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8';

export const adminPageContentWideClassName = 'box-border w-full min-w-0 max-w-none px-4 py-8 sm:px-6 lg:px-8 xl:px-10';

interface AdminPageLayoutProps {
    children: ReactNode;
}

export function AdminPageLayout({ children }: AdminPageLayoutProps) {
    return <div className="flex min-h-screen w-full overflow-x-hidden">{children}</div>;
}

interface AdminShellProps {
    children: ReactNode;
    wide?: boolean;
}

export function AdminShell({ children, wide = false }: AdminShellProps) {
    return (
        <AdminPageLayout>
            <Sidebar />
            <AdminPageMain>
                <AdminPageContent className={wide ? adminPageContentWideClassName : undefined}>
                    {children}
                </AdminPageContent>
            </AdminPageMain>
        </AdminPageLayout>
    );
}

interface AdminPageMainProps {
    children: ReactNode;
    className?: string;
}

export function AdminPageMain({ children, className }: AdminPageMainProps) {
    return <main className={cn(adminPageMainClassName, className)}>{children}</main>;
}

interface AdminPageContentProps {
    children: ReactNode;
    className?: string;
}

export function AdminPageContent({ children, className }: AdminPageContentProps) {
    return <div className={cn(className ?? adminPageContentClassName)}>{children}</div>;
}

interface AdminStatCardProps {
    title: string;
    value: string;
    titleClassName?: string;
    valueClassName?: string;
}

export function AdminStatCard({ title, value, titleClassName, valueClassName }: AdminStatCardProps) {
    return (
        <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <p className={cn('mb-1 text-sm font-semibold text-gray-500', titleClassName)}>{title}</p>
            <p className={cn('truncate text-2xl font-bold tabular-nums text-gray-900', valueClassName)}>{value}</p>
        </div>
    );
}

interface AdminFilterPanelProps {
    children: ReactNode;
    className?: string;
}

export function AdminFilterPanel({ children, className }: AdminFilterPanelProps) {
    return (
        <div className={cn('mb-6 min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm', className)}>
            {children}
        </div>
    );
}

interface AdminSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}

export function AdminSearchInput({ value, onChange, placeholder, className }: AdminSearchInputProps) {
    return (
        <div className={cn('relative', className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-10 w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
        </div>
    );
}

export function AdminLoadingRow({ label }: { label: string }) {
    return (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            {label}
        </div>
    );
}

export function AdminErrorAlert({ message }: { message: string }) {
    return (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {message}
        </div>
    );
}

interface AdminSelectProps {
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
    className?: string;
}

export function AdminSelect({ value, onChange, children, className }: AdminSelectProps) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
                'h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200',
                className
            )}
        >
            {children}
        </select>
    );
}
