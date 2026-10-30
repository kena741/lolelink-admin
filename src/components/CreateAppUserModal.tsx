'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type UserKind = 'customer' | 'provider';

interface CreateAppUserModalProps {
    open: boolean;
    kind: UserKind;
    onClose: () => void;
    onCreated: (result: { id: string; temporaryPassword: string }) => void;
}

interface FormState {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    country_code: string;
    password: string;
}

const emptyForm: FormState = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    country_code: '+251',
    password: '',
};

function clientTempPassword(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function CreateAppUserModal({ open, kind, onClose, onCreated }: CreateAppUserModalProps) {
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [smsNote, setSmsNote] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const label = kind === 'customer' ? 'Customer' : 'Provider';
    const endpoint = kind === 'customer' ? '/api/admin/customers' : '/api/admin/providers';

    useEffect(() => {
        if (!open) return;
        setForm({ ...emptyForm, password: clientTempPassword() });
        setError(null);
        setCreatedPassword(null);
        setCreatedId(null);
        setSmsNote(null);
        setCopied(false);
    }, [open, kind]);

    function close() {
        if (saving) return;
        onClose();
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (createdPassword) {
            if (createdId) onCreated({ id: createdId, temporaryPassword: createdPassword });
            onClose();
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: form.first_name.trim(),
                    last_name: form.last_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim() || undefined,
                    country_code: form.country_code.trim() || '+251',
                    password: form.password.trim() || undefined,
                }),
            });
            const payload = (await response.json()) as {
                data?: { id?: string };
                temporaryPassword?: string;
                error?: string;
                sms?: { sent?: boolean; error?: string; recipient?: string | null };
            };
            if (!response.ok) throw new Error(payload.error || `Failed to create ${label.toLowerCase()}`);
            const id = payload.data?.id;
            const temporaryPassword = payload.temporaryPassword;
            if (!id || !temporaryPassword) throw new Error('Create succeeded but password was not returned');
            setCreatedId(id);
            setCreatedPassword(temporaryPassword);
            if (payload.sms?.sent) {
                setSmsNote(`Login SMS sent to ${payload.sms.recipient || 'phone'}.`);
            } else {
                setSmsNote(
                    payload.sms?.error
                        ? `Account created, but SMS failed: ${payload.sms.error}`
                        : 'Account created, but SMS was not sent.'
                );
            }
        } catch (submitError: unknown) {
            setError(submitError instanceof Error ? submitError.message : 'Create failed');
        } finally {
            setSaving(false);
        }
    }

    async function copyPassword() {
        if (!createdPassword) return;
        try {
            await navigator.clipboard.writeText(createdPassword);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setError('Could not copy password');
        }
    }

    return (
        <Dialog open={open} onClose={close}>
            <DialogHeader>
                <DialogTitle>{createdPassword ? `${label} created` : `Add ${label}`}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                {createdPassword
                    ? 'Copy the temporary password now — it will not be shown again.'
                    : `Creates a login for this ${label.toLowerCase()} with a temporary password.`}
            </DialogDescription>

            <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
                {!createdPassword ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="create-user-first">First name</Label>
                                <Input
                                    id="create-user-first"
                                    value={form.first_name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                                    required
                                    disabled={saving}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="create-user-last">Last name</Label>
                                <Input
                                    id="create-user-last"
                                    value={form.last_name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                                    disabled={saving}
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="create-user-email">Email</Label>
                            <Input
                                id="create-user-email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                required
                                disabled={saving}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                            <div className="grid gap-1.5">
                                <Label htmlFor="create-user-code">Code</Label>
                                <Input
                                    id="create-user-code"
                                    value={form.country_code}
                                    onChange={(e) => setForm((prev) => ({ ...prev, country_code: e.target.value }))}
                                    disabled={saving}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="create-user-phone">Phone</Label>
                                <Input
                                    id="create-user-phone"
                                    value={form.phone}
                                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                    placeholder="9xxxxxxxx"
                                    required
                                    disabled={saving}
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="create-user-password">Temporary password</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="create-user-password"
                                    value={form.password}
                                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                    required
                                    minLength={6}
                                    disabled={saving}
                                    className="font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saving}
                                    onClick={() => setForm((prev) => ({ ...prev, password: clientTempPassword() }))}
                                    aria-label="Regenerate password"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                        <p className="text-sm text-emerald-900">
                            Share this password with the {label.toLowerCase()} so they can sign in.
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md border border-emerald-100 bg-white px-3 py-2 font-mono text-sm">
                                {createdPassword}
                            </code>
                            <Button type="button" variant="outline" onClick={() => void copyPassword()}>
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        {smsNote ? (
                            <p className="text-xs text-emerald-900/80">{smsNote}</p>
                        ) : null}
                    </div>
                )}

                {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
                )}

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={close} disabled={saving}>
                        {createdPassword ? 'Close' : 'Cancel'}
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving ? 'Creating…' : createdPassword ? 'Done' : `Create ${label.toLowerCase()}`}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
