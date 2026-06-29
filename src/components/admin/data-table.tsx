import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { adminStatusToneClasses, type AdminStatusTone } from '@/lib/admin-status-badge';

export type { AdminStatusTone };

interface AdminTableShellProps {
    children: ReactNode;
    className?: string;
}

export function AdminTableShell({ children, className }: AdminTableShellProps) {
    return (
        <div className={cn('min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
            {children}
        </div>
    );
}

interface AdminDataTableEmptyProps {
    title: string;
    description: string;
    action?: ReactNode;
}

export function AdminDataTableEmpty({ title, description, action }: AdminDataTableEmptyProps) {
    return (
        <div className="px-6 py-16 text-center">
            <p className="text-base font-medium text-gray-900">{title}</p>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

interface AdminStatusBadgeProps {
    children: ReactNode;
    tone?: AdminStatusTone;
    className?: string;
}

export function AdminStatusBadge({ children, tone = 'neutral', className }: AdminStatusBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                adminStatusToneClasses[tone],
                className
            )}
        >
            {children}
        </span>
    );
}

interface AdminPersonCellProps {
    name: string;
    meta?: string;
    secondaryMeta?: string;
    className?: string;
}

export function AdminPersonCell({ name, meta, secondaryMeta, className }: AdminPersonCellProps) {
    return (
        <div className={cn('min-w-0 max-w-[188px]', className)} title={[name, meta, secondaryMeta].filter(Boolean).join(' · ')}>
            <div className="truncate text-sm font-medium text-gray-900">{name}</div>
            {meta ? (
                <div className="mt-0.5 truncate text-xs text-gray-600" title={meta}>
                    {meta}
                </div>
            ) : null}
            {secondaryMeta ? (
                <div className="mt-0.5 truncate text-xs text-gray-500" title={secondaryMeta}>
                    {secondaryMeta}
                </div>
            ) : null}
        </div>
    );
}

interface AdminIconActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    tone?: 'neutral' | 'danger' | 'info';
}

export function AdminIconActionButton({
    tone = 'neutral',
    className,
    children,
    ...props
}: AdminIconActionButtonProps) {
    const toneClasses =
        tone === 'danger'
            ? 'border-destructive/30 text-destructive hover:bg-destructive/10 focus:ring-destructive/20'
            : tone === 'info'
              ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-200'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 focus:ring-indigo-200';

    return (
        <button
            type="button"
            className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md border focus:outline-none focus:ring-2',
                toneClasses,
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
