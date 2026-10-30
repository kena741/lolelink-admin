import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface UploadBody {
    documentId?: string;
    documentImage?: string;
}

function providerDisplayName(row: Record<string, unknown>): string {
    const first = String(row.firstName ?? row.first_name ?? '').trim();
    const last = String(row.lastName ?? row.last_name ?? '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    return String(row.name ?? row.email ?? 'Provider').trim() || 'Provider';
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: providerId } = await context.params;
    if (!providerId) {
        return NextResponse.json({ error: 'provider id is required' }, { status: 400 });
    }

    const admin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as UploadBody;
        const documentId = String(body.documentId ?? '').trim();
        const documentImage = String(body.documentImage ?? '').trim();

        if (!documentId) {
            return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
        }
        if (!documentImage) {
            return NextResponse.json({ error: 'documentImage is required' }, { status: 400 });
        }

        const { data: providerRaw, error: providerError } = await admin
            .from('provider')
            .select('id, email, firstName, lastName, first_name, last_name, name, user_id')
            .eq('id', providerId)
            .maybeSingle();

        if (providerError || !providerRaw) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const provider = providerRaw as Record<string, unknown>;
        const providerName = providerDisplayName(provider);
        const providerEmail = String(provider.email ?? '').trim();

        const { data: docMeta } = await admin
            .from('documents')
            .select('id, name')
            .eq('id', documentId)
            .maybeSingle();

        // Match mobile: replace any existing row for this provider + document type.
        const { error: deleteError } = await admin
            .from('verify_documents')
            .delete()
            .eq('providerId', providerId)
            .eq('documentId', documentId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        const now = new Date().toISOString();
        const { data: inserted, error: insertError } = await admin
            .from('verify_documents')
            .insert({
                providerId,
                providerName,
                providerEmail,
                documentId,
                documentImage,
                isVerify: null,
                createdAt: now,
            })
            .select('*')
            .single();

        if (insertError || !inserted) {
            return NextResponse.json(
                { error: insertError?.message || 'Failed to save verification document' },
                { status: 500 }
            );
        }

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'verify_document',
            resource_id: String((inserted as { id?: string }).id ?? documentId),
            summary: `Admin uploaded verification document for provider ${providerId}`,
            metadata: {
                provider_id: providerId,
                document_id: documentId,
                document_name: (docMeta as { name?: string } | null)?.name ?? null,
                source: 'admin',
            },
        });

        return NextResponse.json({
            data: {
                ...(inserted as Record<string, unknown>),
                documentName: (docMeta as { name?: string } | null)?.name ?? null,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
