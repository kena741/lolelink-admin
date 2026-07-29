import type { BroadcastChannel } from '@/lib/broadcast-notify';

export type AdminNotifyChannel = BroadcastChannel;

export interface AdminNotifyDraft {
    title: string;
    body: string;
    channel: AdminNotifyChannel;
}

interface AdminNotifyResultDetails {
    ok?: boolean;
    skipped?: string;
    error?: string;
}

export interface AdminNotifyResult {
    ok: boolean;
    error?: string;
    push?: AdminNotifyResultDetails;
    sms?: AdminNotifyResultDetails;
}

export function createAdminNotifyDraft(
    defaults: { title: string; body: string },
    channel: AdminNotifyChannel = 'both'
): AdminNotifyDraft {
    return {
        title: defaults.title,
        body: defaults.body,
        channel,
    };
}

export function adminNotifySmsText(draft: AdminNotifyDraft): string {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (title && body) return `${title}\n${body}`;
    return title || body;
}

export async function sendAdminProviderNotify(params: {
    providerId: string;
    draft: AdminNotifyDraft;
    route?: string;
    type?: string;
}): Promise<AdminNotifyResult> {
    const title = params.draft.title.trim();
    const body = params.draft.body.trim();
    if (!title || !body) return { ok: false, error: 'Title and body are required' };
    if (!params.providerId.trim()) return { ok: false, error: 'providerId is required' };

    try {
        const response = await fetch('/api/admin/push/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audience: 'provider',
                providerId: params.providerId,
                event: 'custom',
                channel: params.draft.channel,
                title,
                body,
                route: params.route,
                type: params.type ?? 'general',
            }),
        });
        const data = (await response.json()) as AdminNotifyResult;
        if (!response.ok) return { ok: false, error: data.error ?? 'Failed to send notification' };
        return {
            ok: true,
            push: data.push,
            sms: data.sms,
        };
    } catch (error: unknown) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to send notification',
        };
    }
}

export async function sendAdminCustomerNotify(params: {
    customerId: string;
    draft: AdminNotifyDraft;
    route?: string;
    type?: string;
}): Promise<AdminNotifyResult> {
    const title = params.draft.title.trim();
    const body = params.draft.body.trim();
    if (!title || !body) return { ok: false, error: 'Title and body are required' };
    if (!params.customerId.trim()) return { ok: false, error: 'customerId is required' };

    try {
        const response = await fetch('/api/admin/push/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audience: 'customer',
                customerId: params.customerId,
                event: 'custom',
                channel: params.draft.channel,
                title,
                body,
                route: params.route,
                type: params.type ?? 'general',
            }),
        });
        const data = (await response.json()) as AdminNotifyResult;
        if (!response.ok) return { ok: false, error: data.error ?? 'Failed to send notification' };
        return {
            ok: true,
            push: data.push,
            sms: data.sms,
        };
    } catch (error: unknown) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to send notification',
        };
    }
}
