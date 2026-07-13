'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SendProviderPushFormProps {
    providerId: string;
}

type Status = {
    fcmRegistered: boolean;
    canSend: boolean;
    reason: string | null;
};

export function SendProviderPushForm({ providerId }: SendProviderPushFormProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [route, setRoute] = useState('/');
    const [status, setStatus] = useState<Status | null>(null);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void (async () => {
            try {
                const response = await fetch(`/api/admin/push/providers/${providerId}`);
                const data = (await response.json()) as Status & { error?: string };
                if (!cancelled && response.ok) {
                    setStatus({
                        fcmRegistered: data.fcmRegistered,
                        canSend: data.canSend,
                        reason: data.reason,
                    });
                }
            } catch {
                if (!cancelled) setStatus(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [providerId, open]);

    function handleClose() {
        setOpen(false);
        setTitle('');
        setBody('');
        setRoute('/');
        setMessage(null);
    }

    async function handleSend() {
        setMessage(null);
        if (!title.trim() || !body.trim()) return;
        setSending(true);
        try {
            const response = await fetch(`/api/admin/push/providers/${providerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, route }),
            });
            const data = (await response.json()) as {
                ok?: boolean;
                skipped?: string;
                error?: string;
                messageId?: string;
            };
            if (!response.ok || data.ok === false) {
                setMessage(data.error || 'Failed to send push');
                return;
            }
            if (data.skipped) {
                setMessage(data.skipped);
                return;
            }
            setMessage('Push sent.');
            setTitle('');
            setBody('');
        } catch {
            setMessage('Network error. Try again.');
        } finally {
            setSending(false);
        }
    }

    if (!open) {
        return (
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                <Megaphone className="mr-2 h-4 w-4" />
                Send push notification
            </Button>
        );
    }

    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Send push notification</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {status
                            ? status.fcmRegistered
                                ? 'Device token registered'
                                : status.reason || 'No device token'
                            : 'Checking device token…'}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Close push form"
                    onClick={handleClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                maxLength={120}
                disabled={sending}
            />
            <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Message"
                disabled={sending}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
            />
            <Input
                value={route}
                onChange={(event) => setRoute(event.target.value)}
                placeholder="Deep link route"
                maxLength={200}
                disabled={sending}
            />
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !title.trim() || !body.trim() || status?.canSend === false}
                >
                    {sending ? 'Sending…' : 'Send push'}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose} disabled={sending}>
                    Cancel
                </Button>
            </div>
        </section>
    );
}
