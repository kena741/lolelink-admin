import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildFieldChanges, buildChangeMetadata, buildUpdateSummary } from '@/lib/activity-log-changes';

export const runtime = 'nodejs';

type BlogPostRow = {
    id: string;
    title?: string;
    slug?: string;
    excerpt?: string | null;
    content_html?: string | null;
    cover_image?: string | null;
    author_name?: string | null;
    status?: string | null;
    published_at?: string | null;
    created_at?: string;
    updated_at?: string;
};

type BlogMutationBody = {
    id?: string;
    title?: string;
    slug?: string;
    excerpt?: string;
    contentHtml?: string;
    coverImage?: string;
    authorName?: string;
    status?: 'draft' | 'published';
    publishedAt?: string | null;
};

function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
}

function toDbPayload(body: BlogMutationBody, { forCreate }: { forCreate: boolean }) {
    const title = (body.title ?? '').trim();
    const slugRaw = (body.slug ?? '').trim() || title;
    const slug = slugify(slugRaw);
    const excerpt = (body.excerpt ?? '').trim();
    const contentHtml = body.contentHtml ?? '';
    const coverImage = (body.coverImage ?? '').trim();
    const authorName = (body.authorName ?? '').trim();
    const status = body.status === 'published' ? 'published' : 'draft';

    let publishedAt: string | null = null;
    if (status === 'published') {
        publishedAt = body.publishedAt?.trim() || new Date().toISOString();
    }

    if (forCreate) {
        if (!title || !slug) {
            return { error: 'title and slug are required' as const };
        }
        return {
            row: {
                title,
                slug,
                excerpt: excerpt || null,
                content_html: contentHtml,
                cover_image: coverImage || null,
                author_name: authorName || null,
                status,
                published_at: publishedAt,
                updated_at: new Date().toISOString(),
            },
        };
    }

    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (typeof body.title === 'string') updates.title = title;
    if (typeof body.slug === 'string' || typeof body.title === 'string') {
        if (slug) updates.slug = slug;
    }
    if (typeof body.excerpt === 'string') updates.excerpt = excerpt || null;
    if (typeof body.contentHtml === 'string') updates.content_html = contentHtml;
    if (typeof body.coverImage === 'string') updates.cover_image = coverImage || null;
    if (typeof body.authorName === 'string') updates.author_name = authorName || null;
    if (body.status === 'draft' || body.status === 'published') {
        updates.status = status;
        updates.published_at = publishedAt;
    } else if (body.publishedAt !== undefined) {
        updates.published_at = body.publishedAt;
    }

    return { updates };
}

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('blog_post')
            .select('*')
            .order('updated_at', { ascending: false });
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to fetch blog posts' }, { status: 500 });
        }
        return NextResponse.json({ data: (data as BlogPostRow[]) ?? [] });
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
        const body = (await request.json()) as BlogMutationBody;
        const prepared = toDbPayload(body, { forCreate: true });
        if ('error' in prepared && prepared.error) {
            return NextResponse.json({ error: prepared.error }, { status: 400 });
        }
        if (!('row' in prepared) || !prepared.row) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('blog_post')
            .insert(prepared.row)
            .select()
            .single();
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to create post' }, { status: 500 });
        }
        const row = data as BlogPostRow;
        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'blog_post',
            resource_id: String(row.id),
            summary: `Created blog post ${row.title}`,
            metadata: { title: row.title, slug: row.slug, status: row.status },
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
        const body = (await request.json()) as BlogMutationBody;
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const prepared = toDbPayload(body, { forCreate: false });
        if (!('updates' in prepared) || !prepared.updates) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }
        const updates = prepared.updates;
        if (Object.keys(updates).length <= 1) {
            // only updated_at
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('blog_post')
            .select('*')
            .eq('id', body.id)
            .maybeSingle();
        if (existingError) {
            return NextResponse.json({ error: existingError.message || 'Failed to fetch post' }, { status: 500 });
        }
        if (!existing) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Keep published_at when already published and staying published
        const existingRow = existing as BlogPostRow;
        if (
            updates.status === 'published' &&
            existingRow.status === 'published' &&
            existingRow.published_at &&
            !body.publishedAt
        ) {
            updates.published_at = existingRow.published_at;
        }

        const { data, error } = await supabaseAdmin
            .from('blog_post')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to update post' }, { status: 500 });
        }
        const row = data as BlogPostRow;
        const changeKeys = Object.keys(updates).filter((k) => k !== 'updated_at');
        const changes = buildFieldChanges(
            existing as Record<string, unknown>,
            row as unknown as Record<string, unknown>,
            changeKeys
        );
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'blog_post',
            resource_id: String(body.id),
            summary: buildUpdateSummary(`Updated blog post ${row.title || body.id}`, changes),
            metadata: buildChangeMetadata(
                existing as Record<string, unknown>,
                row as unknown as Record<string, unknown>,
                changeKeys
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
        const body = (await request.json()) as BlogMutationBody;
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('blog_post')
            .select('title')
            .eq('id', body.id)
            .maybeSingle();
        if (existingError) {
            return NextResponse.json({ error: existingError.message || 'Failed to fetch post' }, { status: 500 });
        }

        const { error } = await supabaseAdmin.from('blog_post').delete().eq('id', body.id);
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to delete post' }, { status: 500 });
        }
        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'blog_post',
            resource_id: String(body.id),
            summary: `Deleted blog post ${(existing as BlogPostRow | null)?.title || body.id}`,
        });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
