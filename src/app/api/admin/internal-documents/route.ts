import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { signedAdminDocumentUrl, uploadAdminDocument } from '@/lib/admin-documents/storage';
import type { AdminDocument, AdminDocumentCategory } from '@/lib/admin-documents/types';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { createSupabaseServerClientFromRequest } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const CATEGORIES = new Set<AdminDocumentCategory>(['agreement', 'policy', 'other']);

function parseCategory(value: FormDataEntryValue | null): AdminDocumentCategory {
    const raw = typeof value === 'string' ? value.trim() : '';
    return CATEGORIES.has(raw as AdminDocumentCategory) ? (raw as AdminDocumentCategory) : 'other';
}

async function resolveAuthUserId(request: Request): Promise<string | null> {
    const supabase = await createSupabaseServerClientFromRequest(request);
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'documents:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const client = getSupabaseAdminFromRequest(request);
        const { data, error } = await client
            .from('admin_documents')
            .select(
                'id, title, category, storage_path, file_name, mime_type, uploaded_by, created_at, updated_at'
            )
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const includePreview = auth.context.permissions.includes('*') || auth.context.role === 'super_admin';

        const documents = await Promise.all(
            ((data as AdminDocument[] | null) ?? []).map(async (document) => ({
                ...document,
                preview_url: includePreview
                    ? await signedAdminDocumentUrl(client, document.storage_path)
                    : null,
            }))
        );

        return NextResponse.json({ documents });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'documents:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    }

    const titleRaw = formData.get('title');
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
    const file = formData.get('file');
    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    const category = parseCategory(formData.get('category'));

    try {
        const client = getSupabaseAdminFromRequest(request);
        const { storagePath, mimeType } = await uploadAdminDocument(client, file);
        const uploadedBy = await resolveAuthUserId(request);

        const { data, error } = await client
            .from('admin_documents')
            .insert({
                title,
                category,
                storage_path: storagePath,
                file_name: file.name,
                mime_type: mimeType,
                uploaded_by: uploadedBy,
            })
            .select(
                'id, title, category, storage_path, file_name, mime_type, uploaded_by, created_at, updated_at'
            )
            .single();

        if (error) throw new Error(error.message);

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'admin_document',
            resource_id: data.id,
            summary: `Uploaded internal document: ${title}`,
        });

        return NextResponse.json({
            document: {
                ...(data as AdminDocument),
                preview_url: await signedAdminDocumentUrl(client, data.storage_path),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
