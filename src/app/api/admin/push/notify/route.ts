import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { notifyProviderPayoutStatus, type PayoutNotifyEvent } from '@/lib/push/payoutNotify';
import {
    notifyProviderAccountPush,
    providerAccountApprovedPush,
    providerDocumentApprovedPush,
    providerDocumentRejectedPush,
} from '@/lib/push/accountNotify';
import { sendProviderPush } from '@/lib/push/sendProviderPush';
import { sendCustomerPush } from '@/lib/push/sendCustomerPush';
import type { PushDeliveryInput } from '@/lib/push/pushDelivery';
import {
    formatBroadcastSmsMessage,
    parseBroadcastChannel,
    resolveBroadcastPhone,
    sendSmsUpstream,
    wantsPush,
    wantsSms,
    type BroadcastChannel,
} from '@/lib/broadcast-notify';

export const runtime = 'nodejs';

type NotifyBody = {
    audience?: 'provider' | 'customer';
    providerId?: string;
    customerId?: string;
    event?: PayoutNotifyEvent | 'document_approved' | 'document_rejected' | 'account_approved' | 'custom';
    amount?: number;
    rejectionReason?: string;
    providerName?: string;
    documentName?: string;
    title?: string;
    body?: string;
    route?: string;
    type?: PushDeliveryInput['type'];
    channel?: BroadcastChannel | string;
};

function parseAmount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

async function loadProviderPhone(
    serviceClient: ReturnType<typeof getSupabaseAdminFromRequest>,
    providerId: string
): Promise<{ recipient: string; debug: Record<string, unknown> | null; error: string | null }> {
    const { data, error } = await serviceClient
        .from('provider')
        .select('phoneNumber, countryCode')
        .or(`id.eq.${providerId},user_id.eq.${providerId}`)
        .maybeSingle();
    if (!data) return { recipient: '', debug: null, error: error?.message ?? null };
    const row = data as Record<string, unknown>;
    return {
        recipient: resolveBroadcastPhone(row),
        debug: row,
        error: null,
    };
}

async function loadCustomerPhone(
    serviceClient: ReturnType<typeof getSupabaseAdminFromRequest>,
    customerId: string
): Promise<{ recipient: string; debug: Record<string, unknown> | null }> {
    const { data } = await serviceClient
        .from('customer')
        .select('phone, mobile_number, countryCode, country_code')
        .eq('id', customerId)
        .maybeSingle();
    if (!data) return { recipient: '', debug: null };
    const row = data as Record<string, unknown>;
    return {
        recipient: resolveBroadcastPhone(row),
        debug: row,
    };
}

async function deliverProviderNotify(params: {
    serviceClient: ReturnType<typeof getSupabaseAdminFromRequest>;
    providerId: string;
    channel: BroadcastChannel;
    input: PushDeliveryInput;
}): Promise<{ ok: true; push?: unknown; sms?: unknown }> {
    const { serviceClient, providerId, channel, input } = params;
    const result: { ok: true; push?: unknown; sms?: unknown } = { ok: true };

    if (wantsPush(channel)) {
        result.push = await sendProviderPush({
            serviceClient,
            providerId,
            input,
        });
    }

    if (wantsSms(channel)) {
        const phone = await loadProviderPhone(serviceClient, providerId);
        if (!phone.recipient) {
            result.sms = {
                ok: false,
                skipped: 'no_phone',
                debug: { providerId, phoneRow: phone.debug, phoneError: phone.error },
            };
        } else {
            result.sms = await sendSmsUpstream(
                phone.recipient,
                formatBroadcastSmsMessage(input.title, input.body)
            );
        }
    }

    return result;
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: NotifyBody;
    try {
        body = (await request.json()) as NotifyBody;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const serviceClient = getSupabaseAdminFromRequest(request);
    const event = body.event ?? 'custom';
    const audience = body.audience ?? 'provider';
    const channel = parseBroadcastChannel(body.channel) ?? 'push';
    const titleOverride = (body.title ?? '').trim();
    const bodyOverride = (body.body ?? '').trim();

    try {
        if (audience === 'customer') {
            const customerId = (body.customerId ?? '').trim();
            if (!customerId) {
                return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
            }
            if (!titleOverride || !bodyOverride) {
                return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
            }
            const input: PushDeliveryInput = {
                title: titleOverride,
                body: bodyOverride,
                route: body.route,
                type: body.type ?? 'general',
            };
            const result: { ok: true; push?: unknown; sms?: unknown } = { ok: true };
            if (wantsPush(channel)) {
                result.push = await sendCustomerPush({
                    serviceClient,
                    customerId,
                    input,
                });
            }
            if (wantsSms(channel)) {
                const phone = await loadCustomerPhone(serviceClient, customerId);
                if (!phone.recipient) {
                    result.sms = { ok: false, skipped: 'no_phone', debug: { customerId, phoneRow: phone.debug } };
                }
                else {
                    result.sms = await sendSmsUpstream(
                        phone.recipient,
                        formatBroadcastSmsMessage(input.title, input.body)
                    );
                }
            }
            return NextResponse.json(result);
        }

        const providerId = (body.providerId ?? '').trim();
        if (!providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }

        let input: PushDeliveryInput | null = null;

        if (
            event === 'approved' ||
            event === 'rejected' ||
            event === 'completed' ||
            event === 'transfer_initiated'
        ) {
            if (titleOverride && bodyOverride) {
                input = {
                    title: titleOverride,
                    body: bodyOverride,
                    route: body.route ?? '/wallet',
                    type: body.type ?? 'payout',
                };
            } else {
                // Keep legacy push-only path when no custom content/channel requested.
                if (!body.channel && !titleOverride && !bodyOverride) {
                    await notifyProviderPayoutStatus(serviceClient, {
                        providerId,
                        event,
                        amount: parseAmount(body.amount),
                        rejectionReason: body.rejectionReason,
                    });
                    return NextResponse.json({ ok: true });
                }
                await notifyProviderPayoutStatus(serviceClient, {
                    providerId,
                    event,
                    amount: parseAmount(body.amount),
                    rejectionReason: body.rejectionReason,
                });
                // If channel includes SMS but no custom body, still need message — fall through after building via second call
                // ponytail: re-fetch default by calling notify once for push when custom missing is messy; require title/body when channel set
                return NextResponse.json({
                    error: 'title and body are required when channel is set',
                }, { status: 400 });
            }
        } else if (event === 'document_approved') {
            input =
                titleOverride && bodyOverride
                    ? {
                          title: titleOverride,
                          body: bodyOverride,
                          route: body.route ?? '/profile',
                          type: body.type ?? 'account',
                      }
                    : providerDocumentApprovedPush(
                          body.providerName ?? '',
                          body.documentName ?? 'document'
                      );
        } else if (event === 'document_rejected') {
            input =
                titleOverride && bodyOverride
                    ? {
                          title: titleOverride,
                          body: bodyOverride,
                          route: body.route ?? '/profile',
                          type: body.type ?? 'account',
                      }
                    : providerDocumentRejectedPush(
                          body.providerName ?? '',
                          body.documentName ?? 'document',
                          body.rejectionReason
                      );
        } else if (event === 'account_approved') {
            input =
                titleOverride && bodyOverride
                    ? {
                          title: titleOverride,
                          body: bodyOverride,
                          route: body.route ?? '/profile',
                          type: body.type ?? 'account',
                      }
                    : providerAccountApprovedPush(body.providerName ?? '');
        } else {
            if (!titleOverride || !bodyOverride) {
                return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
            }
            input = {
                title: titleOverride,
                body: bodyOverride,
                route: body.route,
                type: body.type ?? 'general',
            };
        }

        if (!input) {
            return NextResponse.json({ error: 'Unable to build notification' }, { status: 400 });
        }

        // Legacy event paths without channel: push only via old helpers for document/account if no channel
        if (!body.channel && event !== 'custom' && !(titleOverride && bodyOverride)) {
            if (event === 'document_approved' || event === 'document_rejected' || event === 'account_approved') {
                await notifyProviderAccountPush(serviceClient, providerId, input);
                return NextResponse.json({ ok: true });
            }
        }

        const result = await deliverProviderNotify({
            serviceClient,
            providerId,
            channel,
            input,
        });
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send push';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
