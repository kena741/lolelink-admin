import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const adminPageMainClassName =
    'admin-page-main min-h-screen min-w-0 w-full flex-1 overflow-x-hidden lg:ml-64';

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

/** Content rail only. Sidebar + auth live in `app/admin/layout.tsx`. */
export function AdminShell({ children, wide = false }: AdminShellProps) {
    return (
        <AdminPageContent className={wide ? adminPageContentWideClassName : undefined}>
            {children}
        </AdminPageContent>
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
    const hasValue = value.trim().length > 0;
    return (
        <div className={cn('relative', className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={cn(
                    'h-10 w-full rounded-md border border-border bg-card py-2 pl-10 text-sm text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] placeholder:text-muted-foreground transition-colors',
                    'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
                    hasValue ? 'pr-10' : 'pr-3'
                )}
            />
            {hasValue ? (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onChange('')}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <X className="h-4 w-4" />
                </button>
            ) : null}
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
                'h-9 rounded-lg border border-gray-200/80 bg-white px-3 text-sm text-gray-800 shadow-sm transition-colors hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200',
                className
            )}
        >
            {children}
        </select>
    );
}

interface AdminSegmentedControlProps {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    'aria-label'?: string;
    className?: string;
}

export function AdminSegmentedControl({
    value,
    options,
    onChange,
    'aria-label': ariaLabel,
    className,
}: AdminSegmentedControlProps) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn(
                'inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg bg-gray-100 p-0.5',
                className
            )}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        aria-pressed={isActive}
                        className={cn(
                            'h-8 shrink-0 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200',
                            isActive
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-800'
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
