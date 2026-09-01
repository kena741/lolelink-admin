import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { signedAdminDocumentUrl } from '@/lib/admin-documents/storage';
import type { AdminDocument } from '@/lib/admin-documents/types';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'documents:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = await getIdFromParams(context.params);
    if (!id) {
        return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    }

    try {
        const client = getSupabaseAdminFromRequest(request);
        const { data, error } = await client
            .from('admin_documents')
            .select(
                'id, title, category, storage_path, file_name, mime_type, uploaded_by, created_at, updated_at'
            )
            .eq('id', id)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        return NextResponse.json({
            document: {
                ...(data as AdminDocument),
                preview_url: await signedAdminDocumentUrl(client, data.storage_path),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
