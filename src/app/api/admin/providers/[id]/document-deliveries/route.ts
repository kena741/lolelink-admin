import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { sendProviderPush } from '@/lib/push/sendProviderPush';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { createSupabaseServerClientFromRequest } from '@/lib/supabase-server';

export const runtime = 'nodejs';

type RouteParams = { id: string };

type DeliveryRow = {
    id: string;
    document_id: string;
    recipient_type: string;
    recipient_id: string;
    sent_by: string | null;
    sent_at: string;
    acknowledged_at: string | null;
    admin_documents:
        | { title: string; category: string; file_name: string }
        | { title: string; category: string; file_name: string }[]
        | null;
};

async function getProviderIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

async function resolveAuthUserId(request: Request): Promise<string | null> {
    const supabase = await createSupabaseServerClientFromRequest(request);
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'providers:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const providerId = await getProviderIdFromParams(context.params);
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const client = getSupabaseAdminFromRequest(request);
        const { data, error } = await client
            .from('document_deliveries')
            .select(
                'id, document_id, recipient_type, recipient_id, sent_by, sent_at, acknowledged_at, admin_documents(title, category, file_name)'
            )
            .eq('recipient_type', 'provider')
            .eq('recipient_id', providerId)
            .order('sent_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const deliveries = ((data as DeliveryRow[] | null) ?? []).map((row) => {
            const doc = Array.isArray(row.admin_documents)
                ? row.admin_documents[0]
                : row.admin_documents;
            return {
                id: row.id,
                document_id: row.document_id,
                recipient_type: row.recipient_type,
                recipient_id: row.recipient_id,
                sent_by: row.sent_by,
                sent_at: row.sent_at,
                acknowledged_at: row.acknowledged_at,
                document_title: doc?.title ?? null,
                document_category: doc?.category ?? null,
                file_name: doc?.file_name ?? null,
            };
        });

        return NextResponse.json({ deliveries });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const providerId = await getProviderIdFromParams(context.params);
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    let body: { documentId?: string; note?: string } = {};
    try {
        body = (await request.json()) as { documentId?: string; note?: string };
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const documentId = body.documentId?.trim();
    if (!documentId) {
        return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    try {
        const client = getSupabaseAdminFromRequest(request);

        const { data: provider, error: providerError } = await client
            .from('provider')
            .select('id, firstName')
            .eq('id', providerId)
            .maybeSingle();

        if (providerError) throw new Error(providerError.message);
        if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const { data: document, error: documentError } = await client
            .from('admin_documents')
            .select('id, title')
            .eq('id', documentId)
            .maybeSingle();

        if (documentError) throw new Error(documentError.message);
        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const sentBy = await resolveAuthUserId(request);

        const { data: delivery, error: deliveryError } = await client
            .from('document_deliveries')
            .insert({
                document_id: documentId,
                recipient_type: 'provider',
                recipient_id: providerId,
                sent_by: sentBy,
            })
            .select('id, document_id, recipient_type, recipient_id, sent_by, sent_at, acknowledged_at')
            .single();

        if (deliveryError) throw new Error(deliveryError.message);

        const providerName =
            typeof provider.firstName === 'string' && provider.firstName.trim()
                ? provider.firstName.trim()
                : 'Provider';
        const note = body.note?.trim();
        const pushTitle = 'New document to review';
        const pushBody =
            note ||
            `Dear ${providerName}, please review and acknowledge "${document.title}" in the Zemen Service provider app.`;

        const pushResult = await sendProviderPush({
            serviceClient: client,
            providerId,
            input: {
                title: pushTitle,
                body: pushBody,
                route: '/document-delivery',
                type: 'document',
                delivery_id: delivery.id,
                document_id: document.id,
            },
        });

        await client.from('notification').insert({
            title: pushTitle,
            description: pushBody,
            type: 'document',
            provider_id: providerId,
            is_read: false,
            action_url: `/document-delivery?deliveryId=${delivery.id}`,
        });

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'document_delivery',
            resource_id: delivery.id,
            summary: `Sent document "${document.title}" to provider ${providerId}`,
            metadata: {
                document_id: documentId,
                provider_id: providerId,
                push: pushResult,
            },
        });

        return NextResponse.json({
            delivery,
            push: pushResult,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
