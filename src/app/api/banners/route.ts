import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface BannerRow {
    id: number;
    bannerName?: string;
    image?: string;
    link?: string;
    created_at?: string;
}

interface BannerMutationBody {
    id?: number;
    bannerName?: string;
    image?: string;
    link?: string;
}

export async function GET() {
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
    try {
        const body = (await request.json()) as BannerMutationBody;
        const bannerName = (body.bannerName ?? '').trim();
        const image = (body.image ?? '').trim();
        const link = (body.link ?? '').trim();
        if (!bannerName || !image)
            return NextResponse.json({ error: 'bannerName and image are required' }, { status: 400 });
        const { data, error } = await supabaseAdmin
            .from('banner')
            .insert({ bannerName, image, link })
            .select()
            .single();
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to create banner' }, { status: 500 });
        return NextResponse.json({ data: data as BannerRow });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
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
        const { data, error } = await supabaseAdmin
            .from('banner')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to update banner' }, { status: 500 });
        return NextResponse.json({ data: data as BannerRow });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = (await request.json()) as BannerMutationBody;
        if (!body.id)
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const { error } = await supabaseAdmin
            .from('banner')
            .delete()
            .eq('id', body.id);
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to delete banner' }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
