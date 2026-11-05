'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    MarketingTrackerCellValue,
    MarketingTrackerColumn,
    MarketingTrackerRow,
} from '@/lib/marketing-tracker';
import { cn } from '@/lib/utils';

export type MobileAddLeadMode = 'classic' | 'cold_call';

export const MOBILE_ADD_LEAD_MODE_OPTIONS: Array<{
    id: MobileAddLeadMode;
    label: string;
    hint: string;
}> = [
    { id: 'cold_call', label: 'Cold call', hint: 'Skip last 2' },
    { id: 'classic', label: 'Full card', hint: 'All fields' },
];

const STORAGE_KEY = 'marketing-tracker-mobile-add-mode';

type DraftValues = Record<string, MarketingTrackerCellValue>;

export function readMobileAddLeadMode(): MobileAddLeadMode {
    if (typeof window === 'undefined') return 'cold_call';
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === 'quick' || raw === 'stepper' || raw === 'compose' || raw === 'cold_call') {
            return 'cold_call';
        }
        if (raw === 'classic') return 'classic';
    } catch {
        // ignore
    }
    return 'cold_call';
}

export function writeMobileAddLeadMode(mode: MobileAddLeadMode): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // ignore
    }
}

function todayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function haystack(column: MarketingTrackerColumn): string {
    return `${column.key} ${column.label}`.toLowerCase();
}

function orderedColumns(columns: MarketingTrackerColumn[]): MarketingTrackerColumn[] {
    return [...columns].sort((left, right) => left.position - right.position);
}

/** All sheet columns except the last two (by position). */
export function coldCallColumns(columns: MarketingTrackerColumn[]): MarketingTrackerColumn[] {
    const ordered = orderedColumns(columns);
    if (ordered.length <= 2) return ordered;
    return ordered.slice(0, -2);
}

function findColumn(
    columns: MarketingTrackerColumn[],
    patterns: RegExp[],
    type?: MarketingTrackerColumn['column_type']
): MarketingTrackerColumn | undefined {
    return columns.find((column) => {
        if (type && column.column_type !== type) return false;
        return patterns.some((pattern) => pattern.test(haystack(column)));
    });
}

function suggestValues(rows: MarketingTrackerRow[], columnKey: string, limit = 8): string[] {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const row of rows) {
        const raw = row.values[columnKey];
        if (typeof raw !== 'string') continue;
        const value = raw.trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        values.push(value);
        if (values.length >= limit) break;
    }
    return values;
}

function isFilled(value: MarketingTrackerCellValue | undefined): boolean {
    return !(value === null || value === undefined || value === '');
}

function compact(values: DraftValues): DraftValues {
    const next: DraftValues = {};
    for (const [key, value] of Object.entries(values)) {
        if (!isFilled(value) && value !== false) continue;
        next[key] = value;
    }
    return next;
}

function digitsOnly(phone: string): string {
    return phone.replace(/\D/g, '');
}

function whatsappHref(phone: string): string | null {
    const digits = digitsOnly(phone);
    if (digits.length < 8) return null;
    return `https://wa.me/${digits}`;
}

function looksLikePhone(column: MarketingTrackerColumn): boolean {
    return /phone|mobile|whatsapp|\btel\b|ስልክ/i.test(haystack(column));
}

function looksLikeLongText(column: MarketingTrackerColumn): boolean {
    return /note|comment|remark|address|ማስታወሻ|አድራሻ/i.test(haystack(column));
}

function looksLikeChipText(column: MarketingTrackerColumn): boolean {
    return /type|category|industry|assignee|owner|አይነት/i.test(haystack(column));
}

export function MobileAddLeadModePicker({
    mode,
    onChange,
}: {
    mode: MobileAddLeadMode;
    onChange: (mode: MobileAddLeadMode) => void;
}) {
    return (
        <div className="md:hidden">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Add lead
            </p>
            <div
                className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
                role="radiogroup"
                aria-label="Add lead experience"
            >
                {MOBILE_ADD_LEAD_MODE_OPTIONS.map((option) => {
                    const selected = mode === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(option.id)}
                            className={cn(
                                'min-h-11 rounded-lg px-2 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <span className="block text-xs font-semibold leading-tight">{option.label}</span>
                            <span className="mt-0.5 block text-[10px] leading-tight opacity-80">{option.hint}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

function Chips({
    value,
    options,
    onChange,
}: {
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    if (options.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => {
                const selected = value.trim().toLowerCase() === option.toLowerCase();
                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className={cn(
                            'min-h-10 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-foreground hover:bg-muted'
                        )}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}

function ColumnEditor({
    column,
    value,
    rows,
    autoFocus,
    onChange,
}: {
    column: MarketingTrackerColumn;
    value: MarketingTrackerCellValue;
    rows: MarketingTrackerRow[];
    autoFocus?: boolean;
    onChange: (value: MarketingTrackerCellValue) => void;
}) {
    if (column.column_type === 'boolean') {
        return (
            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: 'Yes', next: true as const },
                    { label: 'No', next: false as const },
                ].map((option) => {
                    const selected = value === option.next;
                    return (
                        <button
                            key={option.label}
                            type="button"
                            onClick={() => onChange(option.next)}
                            className={cn(
                                'min-h-12 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-card text-foreground hover:bg-muted'
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        );
    }

    if (column.column_type === 'date') {
        const dateValue = typeof value === 'string' ? value : '';
        return (
            <Input
                type="date"
                autoFocus={autoFocus}
                value={dateValue}
                onChange={(event) => onChange(event.target.value || null)}
                className="h-12"
            />
        );
    }

    const textValue = typeof value === 'string' ? value : '';
    const phoneLike = looksLikePhone(column);
    const longText = looksLikeLongText(column);
    const chips = looksLikeChipText(column) ? suggestValues(rows, column.key) : [];

    if (longText) {
        return (
            <textarea
                autoFocus={autoFocus}
                value={textValue}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                placeholder={column.label}
                className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
        );
    }

    return (
        <div className="space-y-2">
            <Chips value={textValue} options={chips} onChange={onChange} />
            <Input
                type={phoneLike ? 'tel' : 'text'}
                inputMode={phoneLike ? 'tel' : undefined}
                autoComplete={phoneLike ? 'tel' : undefined}
                autoFocus={autoFocus}
                value={textValue}
                onChange={(event) => onChange(event.target.value)}
                className="h-12 text-base"
                placeholder={column.label}
            />
        </div>
    );
}

/** Cold-call sheet: every column except the last two on this sheet. */
export function MobileColdCallLeadFlow({
    open,
    onClose,
    columns,
    rows,
    onCreate,
}: {
    open: boolean;
    onClose: () => void;
    columns: MarketingTrackerColumn[];
    rows: MarketingTrackerRow[];
    onCreate: (values: Record<string, MarketingTrackerCellValue>) => void;
}) {
    const fields = useMemo(() => coldCallColumns(columns), [columns]);
    const phoneColumn = useMemo(
        () => findColumn(fields, [/phone/, /mobile/, /whatsapp/, /\btel\b/, /ስልክ/], 'text'),
        [fields]
    );
    const contactDate = useMemo(
        () => findColumn(columns, [/contact_?date/, /contacted_?at/], 'date'),
        [columns]
    );
    const contacted = useMemo(
        () => findColumn(columns, [/contacted/, /ተገናኝ/], 'boolean'),
        [columns]
    );

    const [draft, setDraft] = useState<DraftValues>({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        // Pre-fill only when those columns are part of the form (not in the skipped last two).
        const seed: DraftValues = {};
        const fieldKeys = new Set(fields.map((column) => column.key));
        if (contactDate && fieldKeys.has(contactDate.key)) {
            seed[contactDate.key] = todayDate();
        }
        if (contacted && fieldKeys.has(contacted.key)) {
            seed[contacted.key] = true;
        }
        setDraft(seed);
    }, [open, columns, fields, contactDate, contacted]);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    const phoneValue =
        phoneColumn && typeof draft[phoneColumn.key] === 'string' ? String(draft[phoneColumn.key]) : '';
    const canSave = fields.some((column) => isFilled(draft[column.key]));
    const wa = phoneValue ? whatsappHref(phoneValue) : null;
    const skipped = Math.max(0, orderedColumns(columns).length - fields.length);

    function save() {
        if (!canSave) return;
        const values: DraftValues = { ...draft };
        // keep contact defaults even if those cols are in the skipped last-two
        if (contactDate && !isFilled(values[contactDate.key])) {
            values[contactDate.key] = todayDate();
        }
        if (contacted && values[contacted.key] !== false) {
            values[contacted.key] = true;
        }
        onCreate(compact(values));
        onClose();
    }

    if (!open || !mounted) return null;

    return (
        <div className="fixed inset-0 z-[100] md:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
            <div
                className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Cold call lead"
            >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Cold call</h2>
                        <p className="text-[11px] text-muted-foreground">
                            {skipped > 0
                                ? `Fills this sheet’s columns except the last ${skipped}`
                                : 'Fills this sheet’s columns'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    {fields.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add columns to this sheet first.</p>
                    ) : (
                        fields.map((column, index) => (
                            <React.Fragment key={column.id}>
                                <Field label={column.label}>
                                    <ColumnEditor
                                        column={column}
                                        value={draft[column.key] ?? null}
                                        rows={rows}
                                        autoFocus={index === 0}
                                        onChange={(value) =>
                                            setDraft((current) => ({ ...current, [column.key]: value }))
                                        }
                                    />
                                </Field>
                                {phoneColumn?.key === column.key ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12"
                                            disabled={digitsOnly(phoneValue).length < 8}
                                            onClick={() => {
                                                window.location.href = `tel:${phoneValue.trim()}`;
                                            }}
                                        >
                                            <Phone className="mr-2 h-4 w-4" />
                                            Call
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12"
                                            disabled={!wa}
                                            onClick={() => {
                                                if (wa) window.open(wa, '_blank', 'noopener,noreferrer');
                                            }}
                                        >
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            WhatsApp
                                        </Button>
                                    </div>
                                ) : null}
                            </React.Fragment>
                        ))
                    )}
                </div>

                <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <Button type="button" className="h-12 w-full text-base" disabled={!canSave} onClick={save}>
                        Save lead
                    </Button>
                </div>
            </div>
        </div>
    );
}
