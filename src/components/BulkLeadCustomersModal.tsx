'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    CUSTOMER_LEAD_PASTE_TEMPLATE,
    parseCustomerLeadPaste,
    type ParsedCustomerLead,
} from '@/lib/customer-lead-paste';

interface BulkLeadCustomersModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (result: { createdCount: number; failedCount: number }) => void;
}

function PreviewRow({ label, value }: { label: string; value: string | null | undefined }) {
    const text = value?.trim();
    if (!text) return null;
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-sm leading-snug">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-card-foreground">{text}</dd>
        </div>
    );
}

function LeadPreviewCard({ lead }: { lead: ParsedCustomerLead }) {
    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    return (
        <li className="rounded-md border border-border bg-card px-3 py-2.5">
            <p className="text-sm font-semibold text-card-foreground">{fullName || '—'}</p>
            <dl className="mt-1.5 space-y-1">
                <PreviewRow label="Phone" value={lead.phone} />
                <PreviewRow label="Source" value={lead.signup_source} />
                <PreviewRow label="Location" value={lead.address} />
                <PreviewRow label="Note" value={lead.admin_note} />
            </dl>
        </li>
    );
}

export function BulkLeadCustomersModal({ open, onClose, onCreated }: BulkLeadCustomersModalProps) {
    const [text, setText] = useState(CUSTOMER_LEAD_PASTE_TEMPLATE);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultNote, setResultNote] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!open) return;
        setText(CUSTOMER_LEAD_PASTE_TEMPLATE);
        setError(null);
        setResultNote(null);
        setSaving(false);
        const id = window.setTimeout(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }, 0);
        return () => window.clearTimeout(id);
    }, [open]);

    const parsed = useMemo(() => parseCustomerLeadPaste(text), [text]);
    const readyCount = parsed.leads.length;
    const invalidCount = parsed.errors.length;

    function close() {
        if (saving) return;
        onClose();
    }

    function appendBlock() {
        setText((prev) => {
            const base = prev.trimEnd();
            const next = base.length === 0 ? CUSTOMER_LEAD_PASTE_TEMPLATE : `${base}\n\n${CUSTOMER_LEAD_PASTE_TEMPLATE}`;
            return next;
        });
        window.setTimeout(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }, 0);
    }

    function resetTemplate() {
        setText(CUSTOMER_LEAD_PASTE_TEMPLATE);
        setError(null);
        setResultNote(null);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
    }

    async function handleSave() {
        setError(null);
        setResultNote(null);
        if (parsed.leads.length === 0) {
            setError(
                parsed.errors[0]?.message
                    ? `Nothing to save. ${parsed.errors[0].message}`
                    : 'Nothing to save. Paste at least one lead block.'
            );
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/api/admin/customers/bulk-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: parsed.leads }),
            });
            const payload = (await response.json()) as {
                created?: unknown[];
                failed?: { index: number; phone?: string; error: string }[];
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to create leads');

            const createdCount = Array.isArray(payload.created) ? payload.created.length : 0;
            const failed = Array.isArray(payload.failed) ? payload.failed : [];
            const failedCount = failed.length + parsed.errors.length;

            if (createdCount === 0 && failedCount > 0) {
                setError(
                    failed.map((f) => `Row ${f.index + 1}: ${f.error}`).join(' · ') ||
                        'No leads created'
                );
                return;
            }

            onCreated({ createdCount, failedCount });
            if (failedCount > 0) {
                setResultNote(
                    `Created ${createdCount}. Failed ${failed.length}: ${failed
                        .map((f) => f.error)
                        .join('; ')}`
                );
            } else {
                onClose();
            }
        } catch (saveError: unknown) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to create leads');
        } finally {
            setSaving(false);
        }
    }

    const saveLabel =
        saving
            ? 'Saving…'
            : readyCount === 0
              ? 'Save leads'
              : `Save ${readyCount} lead${readyCount === 1 ? '' : 's'}`;

    return (
        <Dialog open={open} onClose={close} scrollable className="max-w-4xl p-0">
            <DialogHeader className="border-b border-border px-5 pb-3 pt-4">
                <div>
                    <DialogTitle>Add leads</DialogTitle>
                    <DialogDescription className="mt-1">
                        Paste one or more blocks below. Blank line between leads. No login or SMS —
                        they stay unregistered until signup.
                    </DialogDescription>
                </div>
            </DialogHeader>

            <DialogBody className="flex min-h-0 flex-col px-5 py-4">
                <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 md:gap-5">
                    <div className="flex min-h-0 flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="bulk-lead-paste">Paste</Label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={resetTemplate}
                                    disabled={saving}
                                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-card-foreground disabled:opacity-50"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={appendBlock}
                                    disabled={saving}
                                    className="text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                                >
                                    + Another block
                                </button>
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            id="bulk-lead-paste"
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            disabled={saving}
                            spellCheck={false}
                            placeholder={`Full name:\nPhone:\nSource/inquiry channel:\nLocation:\nDescription:`}
                            className="min-h-[240px] w-full flex-1 resize-y rounded-md border border-border bg-card px-3 py-2.5 font-mono text-[13px] leading-relaxed text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:min-h-0"
                        />
                        <p className="text-xs text-muted-foreground">
                            Fields: Full name · Phone · Source/inquiry channel · Location · Description
                        </p>
                    </div>

                    <div className="flex min-h-0 flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-card-foreground">Preview</p>
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-emerald-700">{readyCount} ready</span>
                                {invalidCount > 0 ? (
                                    <span className="font-medium text-amber-700">
                                        {' '}
                                        · {invalidCount} invalid
                                    </span>
                                ) : null}
                            </p>
                        </div>

                        <div className="min-h-[200px] flex-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-2.5 md:min-h-0">
                            {readyCount > 0 ? (
                                <ul className="space-y-2">
                                    {parsed.leads.map((lead, index) => (
                                        <LeadPreviewCard key={`${lead.phone}-${index}`} lead={lead} />
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex h-full min-h-[160px] items-center justify-center px-4 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        Fill at least Full name and Phone. Preview updates as you type.
                                    </p>
                                </div>
                            )}

                            {invalidCount > 0 ? (
                                <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-amber-800">
                                    {parsed.errors.map((err) => (
                                        <li key={`err-${err.index}`}>
                                            Block {err.index + 1}: {err.message}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                        {error}
                    </div>
                ) : null}
                {resultNote ? (
                    <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        {resultNote}
                    </div>
                ) : null}
            </DialogBody>

            <DialogFooter className="border-t border-border px-5 py-3">
                <Button type="button" variant="ghost" onClick={close} disabled={saving}>
                    {resultNote ? 'Close' : 'Cancel'}
                </Button>
                <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || readyCount === 0}
                >
                    {saveLabel}
                </Button>
            </DialogFooter>
        </Dialog>
    );
}
