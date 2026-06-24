'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    side?: 'right' | 'left';
    widthClassName?: string;
}

export function Sheet({
    open,
    onClose,
    children,
    className,
    side = 'right',
    widthClassName = 'max-w-xl',
}: SheetProps) {
    const [mounted, setMounted] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (!open) {
            setVisible(false);
            return;
        }

        const frame = window.requestAnimationFrame(() => setVisible(true));
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.cancelAnimationFrame(frame);
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open || !mounted) return null;

    const slideFromRight = side === 'right';

    const sheet = (
        <div className="fixed inset-0 z-[100]">
            <div
                className={cn(
                    'absolute inset-0 bg-black/40 transition-opacity duration-200',
                    visible ? 'opacity-100' : 'opacity-0'
                )}
                onClick={onClose}
                aria-hidden
            />
            <div
                className={cn(
                    'absolute inset-y-0 flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl',
                    slideFromRight ? 'right-0 border-l border-gray-200' : 'left-0 border-r border-gray-200',
                    widthClassName,
                    'transition-transform duration-200 ease-out',
                    slideFromRight
                        ? visible
                            ? 'translate-x-0'
                            : 'translate-x-full'
                        : visible
                          ? 'translate-x-0'
                          : '-translate-x-full',
                    className
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );

    return createPortal(sheet, document.body);
}

export function SheetHeader({
    children,
    onClose,
    className,
}: {
    children: React.ReactNode;
    onClose?: () => void;
    className?: string;
}) {
    return (
        <div className={cn('flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-6 py-4', className)}>
            <div className="min-w-0 flex-1">{children}</div>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="truncate text-lg font-bold text-gray-900">{children}</h2>;
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
    return <p className="mt-1 text-sm text-gray-500">{children}</p>;
}

export function SheetBody({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5', className)}>
            {children}
        </div>
    );
}

export function SheetFooter({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 px-6 py-4', className)}>
            {children}
        </div>
    );
}
