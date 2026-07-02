'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DROPDOWN_HEIGHT = 280;
const LIST_HEIGHT = 220;

export interface SearchSelectOption {
    value: string;
    label: string;
    description?: string;
    searchText?: string;
}

interface SearchSelectProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: SearchSelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    loading?: boolean;
    loadingMessage?: string;
    disabled?: boolean;
}

function optionHaystack(option: SearchSelectOption): string {
    return [option.label, option.description, option.searchText, option.value]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function matchesQuery(option: SearchSelectOption, query: string): boolean {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;
    const haystack = optionHaystack(option);
    return tokens.every((token) => haystack.includes(token));
}

export function SearchSelect({
    id,
    label,
    value,
    onChange,
    options,
    placeholder = 'Search and select',
    searchPlaceholder = 'Search...',
    emptyMessage = 'No results found',
    loading = false,
    loadingMessage = 'Loading...',
    disabled = false,
}: SearchSelectProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const listboxId = `${id}-listbox`;

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value]
    );

    const filteredOptions = useMemo(
        () => options.filter((option) => matchesQuery(option, query)),
        [options, query]
    );

    const isDisabled = disabled || loading;

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    useEffect(() => {
        if (open) {
            searchInputRef.current?.focus();
        } else {
            setQuery('');
        }
    }, [open]);

    function handleSelect(nextValue: string) {
        onChange(nextValue);
        setOpen(false);
    }

    function handleClear(event: React.MouseEvent) {
        event.stopPropagation();
        onChange('');
        setOpen(false);
    }

    function handleToggle() {
        if (!isDisabled) setOpen((current) => !current);
    }

    return (
        <div ref={containerRef} className={cn('relative grid gap-1.5', open && 'z-110')}>
            <Label htmlFor={id}>{label}</Label>

            <div
                id={id}
                role="combobox"
                aria-controls={listboxId}
                aria-expanded={open}
                aria-haspopup="listbox"
                tabIndex={isDisabled ? -1 : 0}
                onClick={handleToggle}
                onKeyDown={(event) => {
                    if (isDisabled) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleToggle();
                    }
                }}
                className={cn(
                    'flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    isDisabled && 'cursor-not-allowed opacity-50'
                )}
            >
                <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
                    {loading ? loadingMessage : selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="ml-2 flex items-center gap-1">
                    {selectedOption && !isDisabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Clear ${label.toLowerCase()}`}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </span>
            </div>

            {open && !isDisabled && (
                <div
                    id={listboxId}
                    className="absolute top-full z-120 mt-1 flex w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-lg"
                    style={{ height: DROPDOWN_HEIGHT }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div className="shrink-0 border-b border-border p-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        setOpen(false);
                                    }
                                }}
                                placeholder={searchPlaceholder}
                                className="h-9 w-full rounded-md border border-input bg-card py-1 pl-8 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                            />
                        </div>
                    </div>

                    <ul role="listbox" className="overflow-y-auto py-1" style={{ height: LIST_HEIGHT }}>
                        {filteredOptions.length === 0 && (
                            <li className="flex h-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </li>
                        )}
                        {filteredOptions.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <li key={option.value} role="option" aria-selected={isSelected}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={cn(
                                            'flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60',
                                            isSelected && 'bg-muted/80'
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                'mt-0.5 h-4 w-4 shrink-0 text-primary',
                                                isSelected ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-medium text-card-foreground">
                                                {option.label}
                                            </span>
                                            {option.description && (
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
