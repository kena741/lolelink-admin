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
};

function parseAmount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
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

    try {
        if (audience === 'customer') {
            const customerId = (body.customerId ?? '').trim();
            if (!customerId) {
                return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
            }
            const title = (body.title ?? '').trim();
            const messageBody = (body.body ?? '').trim();
            if (!title || !messageBody) {
                return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
            }
            const result = await sendCustomerPush({
                serviceClient,
                customerId,
                input: {
                    title,
                    body: messageBody,
                    route: body.route,
                    type: body.type ?? 'general',
                },
            });
            return NextResponse.json(result);
        }

        const providerId = (body.providerId ?? '').trim();
        if (!providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }

        if (
            event === 'approved' ||
            event === 'rejected' ||
            event === 'completed' ||
            event === 'transfer_initiated'
        ) {
            await notifyProviderPayoutStatus(serviceClient, {
                providerId,
                event,
                amount: parseAmount(body.amount),
                rejectionReason: body.rejectionReason,
            });
            return NextResponse.json({ ok: true });
        }

        if (event === 'document_approved') {
            await notifyProviderAccountPush(
                serviceClient,
                providerId,
                providerDocumentApprovedPush(
                    body.providerName ?? '',
                    body.documentName ?? 'document'
                )
            );
            return NextResponse.json({ ok: true });
        }

        if (event === 'document_rejected') {
            await notifyProviderAccountPush(
                serviceClient,
                providerId,
                providerDocumentRejectedPush(
                    body.providerName ?? '',
                    body.documentName ?? 'document',
                    body.rejectionReason
                )
            );
            return NextResponse.json({ ok: true });
        }

        if (event === 'account_approved') {
            await notifyProviderAccountPush(
                serviceClient,
                providerId,
                providerAccountApprovedPush(body.providerName ?? '')
            );
            return NextResponse.json({ ok: true });
        }

        const title = (body.title ?? '').trim();
        const messageBody = (body.body ?? '').trim();
        if (!title || !messageBody) {
            return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
        }

        const result = await sendProviderPush({
            serviceClient,
            providerId,
            input: {
                title,
                body: messageBody,
                route: body.route,
                type: body.type ?? 'general',
            },
        });
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send push';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
