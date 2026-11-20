'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const MIN_MENU_WIDTH = 320;
const MAX_MENU_WIDTH = 440;
const MENU_HEIGHT = 340;
const LIST_MAX_HEIGHT = 268;

export interface SearchSelectOption {
    value: string;
    label: string;
    description?: string;
    searchText?: string;
    /** When false, only listed after the user types a search query. Default true. */
    showWhenEmpty?: boolean;
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
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
        null
    );
    const listboxId = `${id}-listbox`;

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value]
    );

    const filteredOptions = useMemo(() => {
        const q = query.trim();
        return options.filter((option) => {
            if (!matchesQuery(option, query)) return false;
            if (q) return true;
            if (option.value && option.value === value) return true;
            return option.showWhenEmpty !== false;
        });
    }, [options, query, value]);

    const isDisabled = disabled || loading;

    useLayoutEffect(() => {
        if (!open) {
            setMenuBox(null);
            return;
        }

        function placeMenu() {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            const width = Math.min(
                Math.max(rect.width, MIN_MENU_WIDTH),
                MAX_MENU_WIDTH,
                window.innerWidth - 16
            );
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < MENU_HEIGHT + 8 && rect.top > spaceBelow;
            let left = rect.left;
            if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
            if (left < 8) left = 8;
            setMenuBox({
                top: openUp ? Math.max(8, rect.top - MENU_HEIGHT - 4) : rect.bottom + 4,
                left,
                width,
            });
        }

        placeMenu();
        window.addEventListener('resize', placeMenu);
        window.addEventListener('scroll', placeMenu, true);
        return () => {
            window.removeEventListener('resize', placeMenu);
            window.removeEventListener('scroll', placeMenu, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (containerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setActiveIndex(0);
            return;
        }
        searchInputRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (query.trim()) {
            setActiveIndex(0);
            return;
        }
        const selectedIdx = optionsRef.current.findIndex((option) => option.value === value);
        setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }, [open, query, value]);

    useEffect(() => {
        if (!open) return;
        const active = menuRef.current?.querySelector<HTMLElement>(`[data-active="true"]`);
        active?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

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

    function moveActive(delta: number) {
        if (filteredOptions.length === 0) return;
        setActiveIndex((current) => {
            const next = (current + delta + filteredOptions.length) % filteredOptions.length;
            return next;
        });
    }

    function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActive(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActive(-1);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const option = filteredOptions[activeIndex];
            if (option) handleSelect(option.value);
        }
    }

    const menu =
        open && !isDisabled && menuBox
            ? createPortal(
                  <div
                      ref={menuRef}
                      id={listboxId}
                      role="presentation"
                      className={cn(
                          'fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)]',
                          'ring-1 ring-black/5'
                      )}
                      style={{
                          top: menuBox.top,
                          left: menuBox.left,
                          width: menuBox.width,
                          maxHeight: MENU_HEIGHT,
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                  >
                      <div className="shrink-0 border-b border-gray-100 bg-gray-50/90 p-2.5">
                          <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <input
                                  ref={searchInputRef}
                                  value={query}
                                  onChange={(event) => setQuery(event.target.value)}
                                  onKeyDown={handleSearchKeyDown}
                                  placeholder={searchPlaceholder}
                                  className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
                              />
                          </div>
                      </div>

                      <ul
                          role="listbox"
                          aria-label={label || 'Options'}
                          className="overflow-y-auto overscroll-contain py-1"
                          style={{ maxHeight: LIST_MAX_HEIGHT }}
                      >
                          {filteredOptions.length === 0 ? (
                              <li className="flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-gray-500">
                                  {emptyMessage}
                              </li>
                          ) : (
                              filteredOptions.map((option, index) => {
                                  const isSelected = option.value === value;
                                  const isActive = index === activeIndex;
                                  return (
                                      <li
                                          key={option.value || '__empty'}
                                          role="option"
                                          aria-selected={isSelected}
                                          data-active={isActive ? 'true' : undefined}
                                      >
                                          <button
                                              type="button"
                                              onMouseEnter={() => setActiveIndex(index)}
                                              onClick={() => handleSelect(option.value)}
                                              className={cn(
                                                  'flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                                                  isActive && 'bg-indigo-50',
                                                  isSelected && !isActive && 'bg-gray-50',
                                                  !isActive && !isSelected && 'hover:bg-gray-50'
                                              )}
                                          >
                                              <Check
                                                  className={cn(
                                                      'mt-0.5 h-4 w-4 shrink-0 text-indigo-600',
                                                      isSelected ? 'opacity-100' : 'opacity-0'
                                                  )}
                                              />
                                              <span className="min-w-0 flex-1">
                                                  <span className="block truncate font-medium text-gray-900">
                                                      {option.label}
                                                  </span>
                                                  {option.description ? (
                                                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                                                          {option.description}
                                                      </span>
                                                  ) : null}
                                              </span>
                                          </button>
                                      </li>
                                  );
                              })
                          )}
                      </ul>

                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/80 px-3 py-1.5 text-[11px] text-gray-500">
                          <span>
                              {filteredOptions.length}
                              {!query.trim() && options.some((o) => o.showWhenEmpty === false)
                                  ? ` showing · type to search all ${options.length}`
                                  : ` of ${options.length}`}
                          </span>
                          <span className="hidden sm:inline">↑↓ · Enter · Esc</span>
                      </div>
                  </div>,
                  document.body
              )
            : null;

    return (
        <div ref={containerRef} className="relative grid gap-1.5">
            {label ? <Label htmlFor={id}>{label}</Label> : null}

            <div
                ref={triggerRef}
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
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className={cn(
                    'flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    open && 'border-indigo-300 ring-2 ring-indigo-200',
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
                            aria-label={`Clear ${label.toLowerCase() || 'selection'}`}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            open && 'rotate-180'
                        )}
                    />
                </span>
            </div>

            {menu}
        </div>
    );
}
