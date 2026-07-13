'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader from '@/components/AdminPageHeader';
import { AdminShell } from '@/components/admin/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Result = {
    ok: boolean;
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
    error?: string;
};

function BroadcastForm({
    title,
    description,
    endpoint,
}: {
    title: string;
    description: string;
    endpoint: string;
}) {
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [route, setRoute] = useState('/');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    async function handleSend() {
        setResult(null);
        if (!pushTitle.trim() || !pushBody.trim()) return;
        if (!window.confirm(`Send this push notification to ${title.toLowerCase()}?`)) return;

        setSending(true);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    route: route.trim() || undefined,
                    activeOnly: true,
                }),
            });
            const data = (await response.json()) as Result & { error?: string };
            if (!response.ok) {
                setResult({
                    ok: false,
                    attempted: 0,
                    sent: 0,
                    skipped: 0,
                    failed: 0,
                    error: data.error ?? 'Could not send broadcast push',
                });
                return;
            }
            setResult(data);
            setPushTitle('');
            setPushBody('');
        } catch {
            setResult({
                ok: false,
                attempted: 0,
                sent: 0,
                skipped: 0,
                failed: 0,
                error: 'Network error. Try again.',
            });
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                        value={pushTitle}
                        onChange={(event) => setPushTitle(event.target.value)}
                        placeholder="Announcement"
                        maxLength={120}
                        disabled={sending}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Deep link route</label>
                    <Input
                        value={route}
                        onChange={(event) => setRoute(event.target.value)}
                        placeholder="/"
                        maxLength={200}
                        disabled={sending}
                    />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Message</label>
                    <textarea
                        value={pushBody}
                        onChange={(event) => setPushBody(event.target.value)}
                        rows={3}
                        maxLength={500}
                        disabled={sending}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            {result ? (
                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        result.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                >
                    {result.ok ? (
                        <span>
                            Attempted {result.attempted}. Sent {result.sent}. Skipped {result.skipped}. Failed{' '}
                            {result.failed}.
                        </span>
                    ) : (
                        <span>{result.error ?? 'Broadcast failed'}</span>
                    )}
                </div>
            ) : null}

            <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !pushTitle.trim() || !pushBody.trim()}
            >
                {sending ? 'Sending…' : 'Send broadcast'}
            </Button>
        </section>
    );
}

export default function PushNotificationsPage() {
    return (
        <AuthGuard>
            <AdminShell>
                <AdminPageHeader
                    title="Push notifications"
                    description="Broadcast Firebase push notifications to providers or customers with registered device tokens."
                    breadcrumbs={[
                        { label: 'Admin', href: '/admin/dashboard' },
                        { label: 'Push notifications' },
                    ]}
                />

                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Megaphone className="h-4 w-4" />
                    Project: zemen-service-dd9b7
                </div>

                <div className="space-y-6">
                    <BroadcastForm
                        title="Broadcast to providers"
                        description="Sends to active providers who have an FCM token on their profile."
                        endpoint="/api/admin/push/providers"
                    />
                    <BroadcastForm
                        title="Broadcast to customers"
                        description="Sends to active customers who have an FCM token on their profile."
                        endpoint="/api/admin/push/customers"
                    />
                </div>
            </AdminShell>
        </AuthGuard>
    );
}
