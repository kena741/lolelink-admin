import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

interface LanguageUpsertRow {
    id: string;
    code: string;
    name: string;
    active: boolean;
}

interface LanguageInsertRow {
    code: string;
    name: string;
    active: boolean;
}

interface LanguagesBody {
    upserts?: LanguageUpsertRow[];
    inserts?: LanguageInsertRow[];
    deleteIds?: string[];
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as LanguagesBody;

        if (body.upserts && body.upserts.length > 0) {
            const { error } = await supabaseAdmin
                .from('languages')
                .upsert(body.upserts, { onConflict: 'id' });
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to upsert languages' }, { status: 500 });
        }

        if (body.inserts && body.inserts.length > 0) {
            const { error } = await supabaseAdmin.from('languages').insert(body.inserts);
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to insert languages' }, { status: 500 });
        }

        if (body.deleteIds && body.deleteIds.length > 0) {
            const ids = body.deleteIds.filter((id) => id.trim().length > 0);
            if (ids.length > 0) {
                const { error } = await supabaseAdmin.from('languages').delete().in('id', ids);
                if (error)
                    return NextResponse.json({ error: error.message || 'Failed to delete languages' }, { status: 500 });
            }
        }

        const upsertCount = body.upserts?.length ?? 0;
        const insertCount = body.inserts?.length ?? 0;
        const deleteCount = body.deleteIds?.filter((id) => id.trim().length > 0).length ?? 0;
        if (upsertCount > 0 || insertCount > 0 || deleteCount > 0) {
            const parts: string[] = [];
            if (upsertCount > 0) parts.push(`${upsertCount} updated`);
            if (insertCount > 0) parts.push(`${insertCount} created`);
            if (deleteCount > 0) parts.push(`${deleteCount} deleted`);
            await logAdminActivity({
                request,
                action: 'update',
                resource_type: 'settings',
                resource_id: 'languages',
                summary: `Updated languages (${parts.join(', ')})`,
                metadata: {
                    upserts: body.upserts,
                    inserts: body.inserts,
                    deleteIds: body.deleteIds,
                },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
