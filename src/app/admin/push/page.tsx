'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader from '@/components/AdminPageHeader';
import { AdminShell } from '@/components/admin/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BroadcastChannel } from '@/lib/broadcast-notify';

type ChannelCounts = {
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
};

type Result = {
    ok: boolean;
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
    channel?: BroadcastChannel;
    push?: ChannelCounts;
    sms?: ChannelCounts;
    error?: string;
};

const CHANNEL_OPTIONS: Array<{ value: BroadcastChannel; label: string; hint: string }> = [
    { value: 'push', label: 'Push', hint: 'Firebase only' },
    { value: 'sms', label: 'SMS', hint: 'Phone SMS only' },
    { value: 'both', label: 'Both', hint: 'Push and SMS' },
];

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
    const [channel, setChannel] = useState<BroadcastChannel>('push');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const channelLabel = CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel;
    const needsRoute = channel === 'push' || channel === 'both';

    async function handleSend() {
        setResult(null);
        if (!pushTitle.trim() || !pushBody.trim()) return;
        if (
            !window.confirm(
                `Send ${channelLabel.toLowerCase()} notification to ${title.toLowerCase()}?`
            )
        ) {
            return;
        }

        setSending(true);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    route: needsRoute ? route.trim() || undefined : undefined,
                    channel,
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
                    error: data.error ?? 'Could not send broadcast',
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

            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Send method</p>
                <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((option) => {
                        const selected = channel === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                disabled={sending}
                                onClick={() => setChannel(option.value)}
                                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    selected
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <span className="block font-medium">{option.label}</span>
                                <span className="block text-xs opacity-80">{option.hint}</span>
                            </button>
                        );
                    })}
                </div>
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
                {needsRoute ? (
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                            Deep link route (push)
                        </label>
                        <Input
                            value={route}
                            onChange={(event) => setRoute(event.target.value)}
                            placeholder="/"
                            maxLength={200}
                            disabled={sending}
                        />
                    </div>
                ) : null}
                <div className={`space-y-1.5 ${needsRoute ? 'sm:col-span-2' : 'sm:col-span-2'}`}>
                    <label className="text-xs font-medium text-muted-foreground">Body</label>
                    <textarea
                        value={pushBody}
                        onChange={(event) => setPushBody(event.target.value)}
                        rows={3}
                        maxLength={500}
                        disabled={sending}
                        className="flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {channel !== 'push' ? (
                        <p className="text-xs text-muted-foreground">
                            SMS sends title + body as one message.
                        </p>
                    ) : null}
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
                        <div className="space-y-1">
                            <p>
                                Done. Total sent {result.sent}, skipped {result.skipped}, failed{' '}
                                {result.failed}.
                            </p>
                            {result.push ? (
                                <p>
                                    Push — attempted {result.push.attempted}, sent {result.push.sent},
                                    skipped {result.push.skipped}, failed {result.push.failed}.
                                </p>
                            ) : null}
                            {result.sms ? (
                                <p>
                                    SMS — attempted {result.sms.attempted}, sent {result.sms.sent},
                                    skipped {result.sms.skipped}, failed {result.sms.failed}.
                                </p>
                            ) : null}
                        </div>
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
                {sending ? 'Sending…' : `Send ${channelLabel.toLowerCase()}`}
            </Button>
        </section>
    );
}

export default function PushNotificationsPage() {
    return (
        <AuthGuard>
            <AdminShell>
                <AdminPageHeader
                    title="Notifications"
                    description="Broadcast push and/or SMS to providers or customers. Set title, body, and send method."
                    breadcrumbs={[
                        { label: 'Admin', href: '/admin/dashboard' },
                        { label: 'Notifications' },
                    ]}
                />

                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Megaphone className="h-4 w-4" />
                    Active accounts only · Push uses FCM · SMS uses profile phone numbers
                </div>

                <div className="space-y-6">
                    <BroadcastForm
                        title="Broadcast to providers"
                        description="Sends to active providers (FCM token and/or phone number depending on method)."
                        endpoint="/api/admin/push/providers"
                    />
                    <BroadcastForm
                        title="Broadcast to customers"
                        description="Sends to active customers (FCM token and/or phone number depending on method)."
                        endpoint="/api/admin/push/customers"
                    />
                </div>
            </AdminShell>
        </AuthGuard>
    );
}
