import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'slate';
    className?: string;
}

const statusToneClasses: Record<NonNullable<AdminStatusBadgeProps['tone']>, string> = {
    neutral: 'bg-gray-100 text-gray-700 ring-gray-500/20',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    slate: 'bg-slate-50 text-slate-700 ring-slate-600/20',
};

export function AdminStatusBadge({ children, tone = 'neutral', className }: AdminStatusBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                statusToneClasses[tone],
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
            ? 'border-rose-200 text-rose-600 hover:bg-rose-50 focus:ring-rose-200'
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
