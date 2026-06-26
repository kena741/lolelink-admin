'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
    filterWalletSearchColumnSuggestions,
    resolveWalletSearchColumnFromDraft,
    walletSearchColumnById,
    type WalletSearchColumnId,
} from '@/lib/wallet-transaction-search';

interface WalletTransactionSearchProps {
    query: string;
    activeColumnIds: WalletSearchColumnId[];
    onQueryChange: (value: string) => void;
    onActiveColumnIdsChange: (columnIds: WalletSearchColumnId[]) => void;
}

function addColumnTag(
    activeColumnIds: WalletSearchColumnId[],
    columnId: WalletSearchColumnId
): WalletSearchColumnId[] {
    if (activeColumnIds.includes(columnId)) return activeColumnIds;
    return [...activeColumnIds, columnId];
}

function removeColumnTag(
    activeColumnIds: WalletSearchColumnId[],
    columnId: WalletSearchColumnId
): WalletSearchColumnId[] {
    return activeColumnIds.filter((id) => id !== columnId);
}

export function WalletTransactionSearch({
    query,
    activeColumnIds,
    onQueryChange,
    onActiveColumnIdsChange,
}: WalletTransactionSearchProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState(query);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);

    const suggestions = useMemo(
        () => filterWalletSearchColumnSuggestions(inputValue, activeColumnIds),
        [inputValue, activeColumnIds]
    );

    const isSelectingTag = inputValue.trim().length > 0 && suggestions.length > 0;
    const showSuggestions = isFocused && isSelectingTag;

    useEffect(() => {
        setHighlightedIndex(0);
    }, [inputValue, suggestions.length]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsFocused(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    function commitTag(columnId: WalletSearchColumnId) {
        onActiveColumnIdsChange(addColumnTag(activeColumnIds, columnId));
        setInputValue('');
        setHighlightedIndex(0);
        inputRef.current?.focus();
    }

    function commitHighlightedTag() {
        const column = resolveWalletSearchColumnFromDraft(inputValue, activeColumnIds);
        if (!column) return;
        commitTag(column.id);
    }

    function handleInputChange(value: string) {
        setInputValue(value);

        const nextSuggestions = filterWalletSearchColumnSuggestions(value, activeColumnIds);
        const nextIsSelectingTag = value.trim().length > 0 && nextSuggestions.length > 0;
        if (nextIsSelectingTag) {
            onQueryChange('');
            return;
        }
        onQueryChange(value);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (showSuggestions) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightedIndex((index) => Math.max(index - 1, 0));
                return;
            }

            if (event.key === 'Tab' || event.key === 'Enter') {
                event.preventDefault();
                commitHighlightedTag();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                setIsFocused(false);
                return;
            }
        }

        if (event.key === 'Backspace' && inputValue === '' && activeColumnIds.length > 0) {
            event.preventDefault();
            const lastTag = activeColumnIds[activeColumnIds.length - 1];
            onActiveColumnIdsChange(removeColumnTag(activeColumnIds, lastTag));
        }
    }

    function clearAll() {
        setInputValue('');
        onQueryChange('');
        onActiveColumnIdsChange([]);
        inputRef.current?.focus();
    }

    const placeholder =
        activeColumnIds.length > 0
            ? `Search ${activeColumnIds.map((id) => walletSearchColumnById(id).label).join(', ')}…`
            : 'Tag a column (Tab), then search…';

    const hasValue = activeColumnIds.length > 0 || inputValue.length > 0;
    const showHint = isFocused || isSelectingTag || activeColumnIds.length > 0;

    return (
        <div ref={containerRef} className="relative min-w-0">
            <div
                className={`flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border bg-white py-1.5 pl-10 pr-3 text-sm transition-colors ${
                    isFocused
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-gray-200'
                }`}
                onClick={() => inputRef.current?.focus()}
            >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                {activeColumnIds.map((columnId) => {
                    const column = walletSearchColumnById(columnId);
                    return (
                        <span
                            key={columnId}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800"
                        >
                            {column.label}
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onActiveColumnIdsChange(removeColumnTag(activeColumnIds, columnId));
                                    inputRef.current?.focus();
                                }}
                                className="rounded-full p-0.5 hover:bg-indigo-200"
                                aria-label={`Remove ${column.label} tag`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    );
                })}

                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    placeholder={activeColumnIds.length === 0 ? placeholder : 'Search…'}
                    className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                />

                {hasValue ? (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            clearAll();
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Clear search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : null}
            </div>

            {showSuggestions ? (
                <ul
                    className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                    role="listbox"
                >
                    {suggestions.map((column, index) => (
                        <li key={column.id} role="option" aria-selected={index === highlightedIndex}>
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => commitTag(column.id)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                                    index === highlightedIndex
                                        ? 'bg-indigo-50 text-indigo-900'
                                        : 'text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <span className="font-semibold">{column.label}</span>
                                <span className="text-xs text-gray-500">{column.placeholder}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}

            {showHint ? (
                isSelectingTag ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        Press Tab to tag{' '}
                        <span className="font-semibold text-gray-700">
                            {suggestions[highlightedIndex]?.label ?? 'column'}
                        </span>
                    </p>
                ) : activeColumnIds.length > 0 ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        Scoped to {activeColumnIds.map((id) => walletSearchColumnById(id).label).join(', ')}.
                    </p>
                ) : (
                    <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        Type a column name (customer, note, auth…) and press Tab.
                    </p>
                )
            ) : null}
        </div>
    );
}
