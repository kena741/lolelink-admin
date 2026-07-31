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
                className="flex h-9 min-w-[10.5rem] items-center justify-between gap-2 rounded-lg border border-gray-200/80 bg-white px-3 text-sm text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            >
                <span className="truncate">{selected?.label ?? 'Select'}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150',
                        open ? 'rotate-180' : ''
                    )}
                />
            </button>

            {open ? (
                <ul
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-56 min-w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
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
                                            ? 'bg-indigo-50 font-medium text-indigo-900'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
