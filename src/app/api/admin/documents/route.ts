import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

interface DocumentRow {
    id: string;
    name?: string;
    active?: boolean;
    description?: string;
}

interface DocumentMutationBody {
    id?: string;
    name?: string;
    active?: boolean;
    description?: string;
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('documents')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message || 'Failed to fetch documents' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: (data as DocumentRow[]) ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as DocumentMutationBody;
        const name = (body.name ?? '').trim();
        if (!name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('documents')
            .insert({
                name,
                active: typeof body.active === 'boolean' ? body.active : true,
                description: body.description?.trim() || null,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message || 'Failed to create document' },
                { status: 500 }
            );
        }

        const row = data as DocumentRow;
        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'document',
            resource_id: row.id,
            summary: `Created document type ${name}`,
            metadata: { active: row.active, description: row.description },
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as DocumentMutationBody;
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const updates: DocumentMutationBody = {};
        if (typeof body.name === 'string') updates.name = body.name.trim();
        if (typeof body.active === 'boolean') updates.active = body.active;
        if (typeof body.description === 'string') updates.description = body.description.trim();

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('documents')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message || 'Failed to update document' },
                { status: 500 }
            );
        }

        const row = data as DocumentRow;
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'document',
            resource_id: body.id,
            summary: `Updated document type ${row.name || body.id}`,
            metadata: { ...updates },
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as DocumentMutationBody;
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('documents')
            .delete()
            .eq('id', body.id);

        if (error) {
            return NextResponse.json(
                { error: error.message || 'Failed to delete document' },
                { status: 500 }
            );
        }

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'document',
            resource_id: body.id,
            summary: `Deleted document type ${body.id}`,
        });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
