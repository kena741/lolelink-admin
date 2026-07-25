import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildFieldChanges, buildChangeMetadata, buildUpdateSummary } from '@/lib/activity-log-changes';

export const runtime = 'nodejs';

interface BannerRow {
    id: number;
    bannerName?: string;
    image?: string;
    link?: string;
    active?: boolean | null;
    created_at?: string;
}

interface BannerMutationBody {
    id?: number;
    bannerName?: string;
    image?: string;
    link?: string;
    active?: boolean;
}

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('banner')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to fetch banners' }, { status: 500 });
        return NextResponse.json({ data: (data as BannerRow[]) ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as BannerMutationBody;
        const bannerName = (body.bannerName ?? '').trim();
        const image = (body.image ?? '').trim();
        const link = (body.link ?? '').trim();
        const active = body.active !== false;
        if (!bannerName || !image)
            return NextResponse.json({ error: 'bannerName and image are required' }, { status: 400 });
        const { data, error } = await supabaseAdmin
            .from('banner')
            .insert({ bannerName, image, link, active })
            .select()
            .single();
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to create banner' }, { status: 500 });
        const row = data as BannerRow;
        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'banner',
            resource_id: String(row.id),
            summary: `Created banner ${bannerName}`,
            metadata: { bannerName, image, link, active },
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as BannerMutationBody;
        if (!body.id)
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const updates: BannerMutationBody = {};
        if (typeof body.bannerName === 'string')
            updates.bannerName = body.bannerName.trim();
        if (typeof body.image === 'string')
            updates.image = body.image.trim();
        if (typeof body.link === 'string')
            updates.link = body.link.trim();
        if (typeof body.active === 'boolean')
            updates.active = body.active;
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('banner')
            .select('*')
            .eq('id', body.id)
            .maybeSingle();
        if (existingError)
            return NextResponse.json({ error: existingError.message || 'Failed to fetch banner' }, { status: 500 });
        if (!existing)
            return NextResponse.json({ error: 'Banner not found' }, { status: 404 });

        const { data, error } = await supabaseAdmin
            .from('banner')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to update banner' }, { status: 500 });
        const row = data as BannerRow;
        const changes = buildFieldChanges(
            existing as Record<string, unknown>,
            row as unknown as Record<string, unknown>,
            Object.keys(updates)
        );
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'banner',
            resource_id: String(body.id),
            summary: buildUpdateSummary(`Updated banner ${row.bannerName || body.id}`, changes),
            metadata: buildChangeMetadata(
                existing as Record<string, unknown>,
                row as unknown as Record<string, unknown>,
                Object.keys(updates)
            ),
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as BannerMutationBody;
        if (!body.id)
            return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('banner')
            .select('bannerName')
            .eq('id', body.id)
            .maybeSingle();
        if (existingError)
            return NextResponse.json({ error: existingError.message || 'Failed to fetch banner' }, { status: 500 });

        const { error } = await supabaseAdmin
            .from('banner')
            .delete()
            .eq('id', body.id);
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to delete banner' }, { status: 500 });
        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'banner',
            resource_id: String(body.id),
            summary: `Deleted banner ${(existing as BannerRow | null)?.bannerName || body.id}`,
        });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
