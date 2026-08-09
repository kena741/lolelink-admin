'use client';

import Link from 'next/link';
import { ArrowLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/NotificationBell';
import { useAdminNav } from '@/lib/admin-nav-context';
import { cn } from '@/lib/utils';

type Breadcrumb = {
    label: string;
    href?: string;
};

type AdminPageHeaderProps = {
    title: string;
    description?: string;
    actions?: ReactNode;
    breadcrumbs?: Breadcrumb[];
    backHref?: string;
    className?: string;
};

export default function AdminPageHeader({
    title,
    description,
    actions,
    breadcrumbs,
    backHref,
    className,
}: AdminPageHeaderProps) {
    const { open, toggle } = useAdminNav();

    return (
        <header
            className={cn(
                'sticky top-0 z-30 -mx-4 -mt-8 mb-6 flex min-h-14 items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-0 lg:-mx-8 lg:px-8',
                className
            )}
        >
            <button
                type="button"
                onClick={toggle}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-text-primary transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
                aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={open}
                aria-controls="admin-sidebar"
            >
                <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                {backHref ? (
                    <Link
                        href={backHref}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-muted hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                ) : null}
                <div className="min-w-0">
                    {breadcrumbs && breadcrumbs.length > 0 ? (
                        <nav className="mb-0.5 hidden flex-wrap items-center gap-1.5 text-xs text-text-secondary sm:flex">
                            {breadcrumbs.map((crumb, index) => (
                                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                                    {index > 0 ? <span>/</span> : null}
                                    {crumb.href ? (
                                        <Link
                                            href={crumb.href}
                                            className="transition-colors hover:text-text-primary"
                                        >
                                            {crumb.label}
                                        </Link>
                                    ) : (
                                        <span className="font-medium text-text-primary">{crumb.label}</span>
                                    )}
                                </span>
                            ))}
                        </nav>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                        <h1 className="truncate font-heading text-[15px] font-semibold tracking-normal text-text-primary">
                            {title}
                        </h1>
                        {description ? (
                            <p className="hidden min-w-0 truncate text-sm text-text-secondary md:block">
                                {description}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {actions ? (
                    <div className="flex max-w-[50vw] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
                        {actions}
                    </div>
                ) : null}
                <NotificationBell />
            </div>
        </header>
    );
}

export function adminHeaderButtonClassName(extra?: string) {
    return [
        'inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-2.5 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm',
        extra,
    ]
        .filter(Boolean)
        .join(' ');
}
