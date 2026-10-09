-- Blog posts for marketing site (managed from lolelink-admin).
-- Public anon can SELECT published rows only; admin writes via service role.

CREATE TABLE IF NOT EXISTS public.blog_post (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content_html text NOT NULL DEFAULT '',
    cover_image text,
    author_name text,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_post_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS blog_post_status_published_at_idx
    ON public.blog_post (status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS blog_post_slug_idx
    ON public.blog_post (slug);

COMMENT ON TABLE public.blog_post IS 'Marketing blog posts shown on zemen-web /blog';
COMMENT ON COLUMN public.blog_post.content_html IS 'Sanitized HTML body from admin rich text editor';
COMMENT ON COLUMN public.blog_post.status IS 'draft | published — only published is public';

ALTER TABLE public.blog_post ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published blog posts" ON public.blog_post;
CREATE POLICY "Public read published blog posts"
    ON public.blog_post
    FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

-- Service-role (admin API) bypasses RLS for full CRUD.
