'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RegisterCustomerAuthModalProps {
    open: boolean;
    customerId: string;
    customerName: string;
    onClose: () => void;
    onRegistered: (result: { userId: string; temporaryPassword: string }) => void;
}

export function RegisterCustomerAuthModal({
    open,
    customerId,
    customerName,
    onClose,
    onRegistered,
}: RegisterCustomerAuthModalProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
    const [smsNote, setSmsNote] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSaving(false);
        setError(null);
        setTemporaryPassword(null);
        setSmsNote(null);
        setCopied(false);
    }, [open, customerId]);

    function close() {
        if (saving) return;
        onClose();
    }

    async function handleRegister() {
        if (temporaryPassword) {
            close();
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/customers/${customerId}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const payload = (await response.json()) as {
                data?: { user_id?: string | null };
                temporaryPassword?: string;
                error?: string;
                sms?: { sent?: boolean; error?: string; recipient?: string | null };
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to register customer');

            const userId = payload.data?.user_id?.trim();
            const password = payload.temporaryPassword;
            if (!userId || !password) {
                throw new Error('Register succeeded but password was not returned');
            }

            setTemporaryPassword(password);
            onRegistered({ userId, temporaryPassword: password });
            if (payload.sms?.sent) {
                setSmsNote(`Login SMS sent to ${payload.sms.recipient || 'phone'}.`);
            } else {
                setSmsNote(
                    payload.sms?.error
                        ? `Registered, but SMS failed: ${payload.sms.error}`
                        : 'Registered, but SMS was not sent.'
                );
            }
        } catch (registerError: unknown) {
            setError(registerError instanceof Error ? registerError.message : 'Register failed');
        } finally {
            setSaving(false);
        }
    }

    async function copyPassword() {
        if (!temporaryPassword) return;
        try {
            await navigator.clipboard.writeText(temporaryPassword);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setError('Could not copy password');
        }
    }

    return (
        <Dialog open={open} onClose={close}>
            <DialogHeader>
                <DialogTitle>{temporaryPassword ? 'Customer registered' : 'Register customer'}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                {temporaryPassword
                    ? 'Copy the temporary password now — it will not be shown again.'
                    : `Create a login for ${customerName}, attach Auth to this lead row, and SMS the temporary password.`}
            </DialogDescription>

            <div className="mt-4 space-y-3">
                {!temporaryPassword ? (
                    <p className="text-sm text-muted-foreground">
                        Same flow as Add customer: phone login email + temporary password SMS. Existing
                        bookings and notes stay on this customer.
                    </p>
                ) : (
                    <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                        <p className="text-sm text-emerald-900">
                            Share this password so they can sign in with their phone number.
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md border border-emerald-100 bg-white px-3 py-2 font-mono text-sm">
                                {temporaryPassword}
                            </code>
                            <Button type="button" variant="outline" onClick={() => void copyPassword()}>
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        {smsNote ? <p className="text-xs text-emerald-900">{smsNote}</p> : null}
                    </div>
                )}

                {error ? (
                    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                        {error}
                    </div>
                ) : null}
            </div>

            <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={close} disabled={saving}>
                    {temporaryPassword ? 'Done' : 'Cancel'}
                </Button>
                {!temporaryPassword ? (
                    <Button type="button" onClick={() => void handleRegister()} disabled={saving}>
                        {saving ? 'Registering…' : 'Register & send SMS'}
                    </Button>
                ) : null}
            </DialogFooter>
        </Dialog>
    );
}
