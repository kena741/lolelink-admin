'use client';

import { Input } from '@/components/ui/input';
import type { AdminNotifyChannel, AdminNotifyDraft } from '@/lib/admin-notify';
import { cn } from '@/lib/utils';

const CHANNEL_OPTIONS: Array<{ value: AdminNotifyChannel; label: string; hint: string }> = [
    { value: 'sms', label: 'SMS', hint: 'Phone only' },
    { value: 'push', label: 'Push', hint: 'App only' },
    { value: 'both', label: 'Both', hint: 'SMS + push' },
];

interface AdminNotifyComposerProps {
    value: AdminNotifyDraft;
    onChange: (next: AdminNotifyDraft) => void;
    disabled?: boolean;
    className?: string;
    showRoute?: boolean;
    route?: string;
    onRouteChange?: (route: string) => void;
}

export function AdminNotifyComposer({
    value,
    onChange,
    disabled = false,
    className,
    showRoute = false,
    route = '/',
    onRouteChange,
}: AdminNotifyComposerProps) {
    return (
        <div className={cn('space-y-3 rounded-lg border border-border bg-background p-3', className)}>
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notification
                </p>
                <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((option) => {
                        const selected = value.channel === option.value;
                        return (
                            <label
                                key={option.value}
                                className={cn(
                                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                    selected
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                    disabled && 'cursor-not-allowed opacity-60'
                                )}
                            >
                                <input
                                    type="radio"
                                    name="admin-notify-channel"
                                    className="h-4 w-4"
                                    checked={selected}
                                    disabled={disabled}
                                    onChange={() => onChange({ ...value, channel: option.value })}
                                />
                                <span>
                                    <span className="block font-medium">{option.label}</span>
                                    <span className="block text-xs opacity-80">{option.hint}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                        value={value.title}
                        onChange={(event) => onChange({ ...value, title: event.target.value })}
                        maxLength={120}
                        disabled={disabled}
                        placeholder="Notification title"
                    />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Body</label>
                    <textarea
                        value={value.body}
                        onChange={(event) => onChange({ ...value, body: event.target.value })}
                        rows={3}
                        maxLength={800}
                        disabled={disabled}
                        placeholder="Notification body"
                        className="flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
                {showRoute && (value.channel === 'push' || value.channel === 'both') ? (
                    <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Deep link route (push)
                        </label>
                        <Input
                            value={route}
                            onChange={(event) => onRouteChange?.(event.target.value)}
                            maxLength={200}
                            disabled={disabled}
                            placeholder="/"
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
