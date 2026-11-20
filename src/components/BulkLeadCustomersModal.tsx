'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    CUSTOMER_LEAD_PASTE_TEMPLATE,
    parseCustomerLeadPaste,
} from '@/lib/customer-lead-paste';

interface BulkLeadCustomersModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (result: { createdCount: number; failedCount: number }) => void;
}

export function BulkLeadCustomersModal({ open, onClose, onCreated }: BulkLeadCustomersModalProps) {
    const [text, setText] = useState(CUSTOMER_LEAD_PASTE_TEMPLATE);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultNote, setResultNote] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setText(CUSTOMER_LEAD_PASTE_TEMPLATE);
        setError(null);
        setResultNote(null);
        setSaving(false);
    }, [open]);

    const parsed = useMemo(() => parseCustomerLeadPaste(text), [text]);

    function close() {
        if (saving) return;
        onClose();
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

    return (
        <Dialog open={open} onClose={close} scrollable className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Add leads</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                Paste one or more lead blocks. Each block becomes a customer row without login/SMS
                (not registered until they sign up). Separate blocks with a blank line.
            </DialogDescription>

            <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
                <div className="grid gap-1.5">
                    <Label htmlFor="bulk-lead-paste">Lead paste</Label>
                    <textarea
                        id="bulk-lead-paste"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        disabled={saving}
                        rows={14}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        spellCheck={false}
                    />
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Preview · {parsed.leads.length} ready
                        {parsed.errors.length ? ` · ${parsed.errors.length} invalid` : ''}
                    </p>
                    {parsed.leads.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-gray-800">
                            {parsed.leads.map((lead, index) => (
                                <li
                                    key={`${lead.phone}-${index}`}
                                    className="rounded border border-gray-200 bg-white px-3 py-2"
                                >
                                    <span className="font-semibold">
                                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
                                    </span>
                                    <span className="text-gray-500"> · {lead.phone}</span>
                                    {lead.signup_source ? (
                                        <span className="text-gray-500"> · {lead.signup_source}</span>
                                    ) : null}
                                    {lead.address ? (
                                        <span className="text-gray-500"> · {lead.address}</span>
                                    ) : null}
                                    {lead.admin_note ? (
                                        <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">
                                            {lead.admin_note}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-gray-600">No valid blocks yet.</p>
                    )}
                    {parsed.errors.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-amber-800">
                            {parsed.errors.map((err) => (
                                <li key={`err-${err.index}`}>
                                    Block {err.index + 1}: {err.message}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                {error ? (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
                ) : null}
                {resultNote ? (
                    <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                        {resultNote}
                    </div>
                ) : null}
            </div>

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={close} disabled={saving}>
                    {resultNote ? 'Close' : 'Cancel'}
                </Button>
                <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || parsed.leads.length === 0}
                >
                    {saving ? 'Saving…' : `Save ${parsed.leads.length || ''} lead${parsed.leads.length === 1 ? '' : 's'}`.trim()}
                </Button>
            </DialogFooter>
        </Dialog>
    );
}
