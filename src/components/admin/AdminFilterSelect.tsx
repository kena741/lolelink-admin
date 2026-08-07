'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AdminFilterSelectOption<T extends string> {
    value: T;
    label: string;
}

interface AdminFilterSelectProps<T extends string> {
    value: T;
    options: AdminFilterSelectOption<T>[];
    onChange: (value: T) => void;
    'aria-label'?: string;
    className?: string;
}

export function AdminFilterSelect<T extends string>({
    value,
    options,
    onChange,
    'aria-label': ariaLabel,
    className,
}: AdminFilterSelectProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value) ?? options[0];

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    return (
        <div ref={containerRef} className={cn('relative min-w-0', className)}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cn(
                    'flex h-9 min-w-42 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm text-text-primary shadow-sm transition-colors',
                    'hover:border-border hover:bg-muted',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
            >
                <span className="truncate">{selected?.label ?? 'Select'}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 text-text-hint transition-transform duration-150',
                        open ? 'rotate-180' : ''
                    )}
                />
            </button>

            {open ? (
                <ul
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-56 min-w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
                >
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <li key={option.value} role="option" aria-selected={isSelected}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                                        isSelected
                                            ? 'bg-secondary font-medium text-text-primary'
                                            : 'text-text-secondary hover:bg-muted hover:text-text-primary'
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected ? (
                                        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
