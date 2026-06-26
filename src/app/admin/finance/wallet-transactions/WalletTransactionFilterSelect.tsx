'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface WalletFilterSelectOption<T extends string> {
    value: T;
    label: string;
}

interface WalletTransactionFilterSelectProps<T extends string> {
    label: string;
    value: T;
    options: WalletFilterSelectOption<T>[];
    onChange: (value: T) => void;
}

export function WalletTransactionFilterSelect<T extends string>({
    label,
    value,
    options,
    onChange,
}: WalletTransactionFilterSelectProps<T>) {
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
        <div ref={containerRef} className="relative min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex h-9 w-full min-w-38 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                <span className="truncate">{selected.label}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open ? (
                <ul
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-56 w-full min-w-38 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
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
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                        isSelected
                                            ? 'bg-indigo-50 font-medium text-indigo-900'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
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
