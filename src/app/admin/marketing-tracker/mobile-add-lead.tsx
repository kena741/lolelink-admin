'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MessageCircle, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketingTrackerCellValue, MarketingTrackerColumn } from '@/lib/marketing-tracker';
import { cn } from '@/lib/utils';

export type MobileAddLeadMode = 'classic' | 'quick' | 'stepper' | 'compose';

export const MOBILE_ADD_LEAD_MODE_OPTIONS: Array<{
    id: MobileAddLeadMode;
    label: string;
    hint: string;
}> = [
    { id: 'classic', label: 'Full card', hint: 'Current' },
    { id: 'quick', label: 'Quick', hint: '3 fields' },
    { id: 'stepper', label: 'Steps', hint: 'One by one' },
    { id: 'compose', label: 'Call-first', hint: 'Phone + call' },
];

const STORAGE_KEY = 'marketing-tracker-mobile-add-mode';

const DEFAULT_BUSINESS_TYPES = ['Salon', 'Gym', 'Clinic', 'Spa', 'Other'];

export function readMobileAddLeadMode(): MobileAddLeadMode {
    if (typeof window === 'undefined') return 'classic';
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === 'classic' || raw === 'quick' || raw === 'stepper' || raw === 'compose') {
            return raw;
        }
    } catch {
        // ignore
    }
    return 'classic';
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

function columnExists(columns: MarketingTrackerColumn[], key: string): boolean {
    return columns.some((column) => column.key === key);
}

function withTrackerDefaults(
    columns: MarketingTrackerColumn[],
    values: Record<string, MarketingTrackerCellValue>
): Record<string, MarketingTrackerCellValue> {
    const next = { ...values };
    if (columnExists(columns, 'contact_date') && (next.contact_date == null || next.contact_date === '')) {
        next.contact_date = todayDate();
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

export function suggestBusinessTypes(rows: Array<{ values: Record<string, MarketingTrackerCellValue> }>): string[] {
    const seen = new Set<string>();
    const fromRows: string[] = [];
    for (const row of rows) {
        const raw = row.values.business_type;
        if (typeof raw !== 'string') continue;
        const value = raw.trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        fromRows.push(value);
        if (fromRows.length >= 8) break;
    }
    for (const fallback of DEFAULT_BUSINESS_TYPES) {
        const key = fallback.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        fromRows.push(fallback);
    }
    return fromRows;
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
                Add lead experience
            </p>
            <div
                className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted/40 p-1"
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
                                'min-h-11 rounded-lg px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <span className="block text-[11px] font-semibold leading-tight">{option.label}</span>
                            <span className="mt-0.5 block text-[10px] leading-tight opacity-80">{option.hint}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function BottomSheet({
    open,
    title,
    onClose,
    children,
    footer,
}: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    if (!open || !mounted) return null;

    return (
        <div className="fixed inset-0 z-[100] md:hidden">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={onClose}
            />
            <div
                className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
                {footer ? <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
            </div>
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

function TypeChips({
    value,
    options,
    onChange,
}: {
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
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
                            'min-h-11 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

function YesNo({
    value,
    onChange,
}: {
    value: boolean | null;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {[
                { label: 'Yes', next: true },
                { label: 'No', next: false },
            ].map((option) => {
                const selected = value === option.next;
                return (
                    <button
                        key={option.label}
                        type="button"
                        onClick={() => onChange(option.next)}
                        className={cn(
                            'min-h-14 rounded-xl border text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

type Draft = {
    phone: string;
    business_name: string;
    business_type: string;
    are_trainers: boolean | null;
    address: string;
    note: string;
};

const EMPTY_DRAFT: Draft = {
    phone: '',
    business_name: '',
    business_type: '',
    are_trainers: null,
    address: '',
    note: '',
};

function draftToValues(
    columns: MarketingTrackerColumn[],
    draft: Draft,
    extras?: Record<string, MarketingTrackerCellValue>
): Record<string, MarketingTrackerCellValue> {
    const values: Record<string, MarketingTrackerCellValue> = { ...(extras ?? {}) };
    const put = (key: keyof Draft | string, value: MarketingTrackerCellValue) => {
        if (!columnExists(columns, key)) return;
        if (value === null || value === '') return;
        values[key] = value;
    };

    put('phone', draft.phone.trim());
    put('business_name', draft.business_name.trim());
    put('business_type', draft.business_type.trim());
    if (draft.are_trainers !== null) put('are_trainers', draft.are_trainers);
    put('address', draft.address.trim());
    put('note', draft.note.trim());

    return withTrackerDefaults(columns, values);
}

export function MobileAddLeadFlow({
    mode,
    open,
    onClose,
    columns,
    typeSuggestions,
    onCreate,
}: {
    mode: Exclude<MobileAddLeadMode, 'classic'>;
    open: boolean;
    onClose: () => void;
    columns: MarketingTrackerColumn[];
    typeSuggestions: string[];
    onCreate: (
        values: Record<string, MarketingTrackerCellValue>,
        options?: { expandAfter?: boolean }
    ) => void;
}) {
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [step, setStep] = useState(0);
    const [showMore, setShowMore] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDraft(EMPTY_DRAFT);
        setStep(0);
        setShowMore(false);
    }, [open, mode]);

    const canSaveBasics = draft.phone.trim().length > 0 || draft.business_name.trim().length > 0;

    const stepperSteps = useMemo(() => {
        const steps: Array<{ id: string; title: string; optional?: boolean }> = [
            { id: 'phone', title: 'Phone number' },
            { id: 'business_name', title: 'Business name' },
            { id: 'business_type', title: 'Business type' },
        ];
        if (columnExists(columns, 'are_trainers')) {
            steps.push({ id: 'are_trainers', title: 'Are trainers?' });
        }
        if (columnExists(columns, 'address')) {
            steps.push({ id: 'address', title: 'Address', optional: true });
        }
        if (columnExists(columns, 'note')) {
            steps.push({ id: 'note', title: 'Quick note', optional: true });
        }
        return steps;
    }, [columns]);

    function save(options?: {
        expandAfter?: boolean;
        contacted?: boolean;
        extras?: Record<string, MarketingTrackerCellValue>;
    }) {
        if (!canSaveBasics) return;
        const extras: Record<string, MarketingTrackerCellValue> = { ...(options?.extras ?? {}) };
        if (options?.contacted === true && columnExists(columns, 'contacted')) {
            extras.contacted = true;
        }
        onCreate(draftToValues(columns, draft, extras), {
            expandAfter: options?.expandAfter === true,
        });
        onClose();
    }

    if (mode === 'quick') {
        return (
            <BottomSheet
                open={open}
                title="Quick capture"
                onClose={onClose}
                footer={
                    <div className="flex flex-col gap-2">
                        <Button
                            type="button"
                            className="h-12 w-full text-base"
                            disabled={!canSaveBasics}
                            onClick={() => save()}
                        >
                            Save lead
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-full"
                            disabled={!canSaveBasics}
                            onClick={() => save({ expandAfter: true })}
                        >
                            Save & add details
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Field label="Phone">
                        <Input
                            type="tel"
                            inputMode="tel"
                            autoFocus
                            autoComplete="tel"
                            value={draft.phone}
                            onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                            className="h-12 text-base"
                            placeholder="09…"
                        />
                    </Field>
                    <Field label="Business name">
                        <Input
                            value={draft.business_name}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, business_name: event.target.value }))
                            }
                            className="h-12 text-base"
                            placeholder="Business name"
                        />
                    </Field>
                    <Field label="Business type">
                        <TypeChips
                            value={draft.business_type}
                            options={typeSuggestions}
                            onChange={(business_type) => setDraft((current) => ({ ...current, business_type }))}
                        />
                        <Input
                            value={draft.business_type}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, business_type: event.target.value }))
                            }
                            className="mt-2 h-11"
                            placeholder="Or type custom…"
                        />
                    </Field>
                    {showMore ? (
                        <div className="space-y-4 border-t border-border pt-4">
                            {columnExists(columns, 'address') ? (
                                <Field label="Address">
                                    <Input
                                        value={draft.address}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, address: event.target.value }))
                                        }
                                        className="h-11"
                                    />
                                </Field>
                            ) : null}
                            {columnExists(columns, 'note') ? (
                                <Field label="Note">
                                    <textarea
                                        value={draft.note}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, note: event.target.value }))
                                        }
                                        rows={3}
                                        className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                    />
                                </Field>
                            ) : null}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="text-sm font-medium text-primary"
                            onClick={() => setShowMore(true)}
                        >
                            More fields
                        </button>
                    )}
                </div>
            </BottomSheet>
        );
    }

    if (mode === 'compose') {
        const wa = whatsappHref(draft.phone);
        return (
            <BottomSheet
                open={open}
                title="Call-first lead"
                onClose={onClose}
                footer={
                    <Button
                        type="button"
                        className="h-12 w-full text-base"
                        disabled={!canSaveBasics}
                        onClick={() => save({ contacted: true })}
                    >
                        Save lead
                    </Button>
                }
            >
                <div className="space-y-4">
                    <Field label="Phone">
                        <Input
                            type="tel"
                            inputMode="tel"
                            autoFocus
                            autoComplete="tel"
                            value={draft.phone}
                            onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                            className="h-12 text-base"
                            placeholder="09…"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-12"
                            disabled={digitsOnly(draft.phone).length < 8}
                            onClick={() => {
                                window.location.href = `tel:${draft.phone.trim()}`;
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
                    <Field label="Business name">
                        <Input
                            value={draft.business_name}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, business_name: event.target.value }))
                            }
                            className="h-12 text-base"
                        />
                    </Field>
                    <Field label="Business type">
                        <TypeChips
                            value={draft.business_type}
                            options={typeSuggestions}
                            onChange={(business_type) => setDraft((current) => ({ ...current, business_type }))}
                        />
                    </Field>
                    {columnExists(columns, 'note') ? (
                        <Field label="Add note?">
                            <textarea
                                value={draft.note}
                                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                                rows={2}
                                placeholder="Optional after the call"
                                className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            />
                        </Field>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                        Saving marks Contacted and stamps today&apos;s contact date when those columns exist.
                    </p>
                </div>
            </BottomSheet>
        );
    }

    // stepper — full-screen focused flow
    const current = stepperSteps[step];
    const isLast = step >= stepperSteps.length - 1;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-card md:hidden">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                        if (step === 0) onClose();
                        else setStep((value) => value - 1);
                    }}
                    aria-label={step === 0 ? 'Close' : 'Back'}
                >
                    {step === 0 ? <X className="h-4 w-4" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {step + 1} of {stepperSteps.length}
                    </p>
                    <h2 className="truncate text-base font-semibold text-foreground">{current?.title}</h2>
                </div>
            </div>

            <div className="flex gap-1 px-4 pt-3" aria-hidden>
                {stepperSteps.map((item, index) => (
                    <div
                        key={item.id}
                        className={cn(
                            'h-1 flex-1 rounded-full',
                            index <= step ? 'bg-primary' : 'bg-muted'
                        )}
                    />
                ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
                <div className="flex-1">
                    {current?.id === 'phone' ? (
                        <Input
                            type="tel"
                            inputMode="tel"
                            autoFocus
                            autoComplete="tel"
                            value={draft.phone}
                            onChange={(event) => setDraft((d) => ({ ...d, phone: event.target.value }))}
                            className="h-14 text-xl"
                            placeholder="09…"
                        />
                    ) : null}
                    {current?.id === 'business_name' ? (
                        <Input
                            autoFocus
                            value={draft.business_name}
                            onChange={(event) => setDraft((d) => ({ ...d, business_name: event.target.value }))}
                            className="h-14 text-xl"
                            placeholder="Business name"
                        />
                    ) : null}
                    {current?.id === 'business_type' ? (
                        <div className="space-y-4">
                            <TypeChips
                                value={draft.business_type}
                                options={typeSuggestions}
                                onChange={(business_type) => setDraft((d) => ({ ...d, business_type }))}
                            />
                            <Input
                                value={draft.business_type}
                                onChange={(event) => setDraft((d) => ({ ...d, business_type: event.target.value }))}
                                className="h-12"
                                placeholder="Or type custom…"
                            />
                        </div>
                    ) : null}
                    {current?.id === 'are_trainers' ? (
                        <YesNo
                            value={draft.are_trainers}
                            onChange={(are_trainers) => setDraft((d) => ({ ...d, are_trainers }))}
                        />
                    ) : null}
                    {current?.id === 'address' ? (
                        <Input
                            autoFocus
                            value={draft.address}
                            onChange={(event) => setDraft((d) => ({ ...d, address: event.target.value }))}
                            className="h-14 text-lg"
                            placeholder="Optional"
                        />
                    ) : null}
                    {current?.id === 'note' ? (
                        <textarea
                            autoFocus
                            value={draft.note}
                            onChange={(event) => setDraft((d) => ({ ...d, note: event.target.value }))}
                            rows={5}
                            placeholder="Optional"
                            className="min-h-40 w-full rounded-xl border border-input bg-card px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        />
                    ) : null}
                </div>

                <div className="flex flex-col gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {current?.optional ? (
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11"
                            onClick={() => {
                                if (isLast) save();
                                else setStep((value) => value + 1);
                            }}
                        >
                            Skip
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        className="h-12 text-base"
                        disabled={
                            (current?.id === 'phone' || current?.id === 'business_name') &&
                            !draft.phone.trim() &&
                            !draft.business_name.trim() &&
                            step === 0
                        }
                        onClick={() => {
                            if (isLast) save();
                            else setStep((value) => value + 1);
                        }}
                    >
                        {isLast ? 'Save lead' : 'Next'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
