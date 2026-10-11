-- Blog engagement: views, likes, comments (name + phone).
-- Run after blog_posts.sql. Safe to re-run.

ALTER TABLE public.blog_post
    ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.blog_post
    ADD COLUMN IF NOT EXISTS like_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.blog_post.view_count IS 'Denormalized public view counter';
COMMENT ON COLUMN public.blog_post.like_count IS 'Denormalized public like counter';

CREATE TABLE IF NOT EXISTS public.blog_like (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.blog_post (id) ON DELETE CASCADE,
    visitor_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_like_post_visitor_unique UNIQUE (post_id, visitor_key),
    CONSTRAINT blog_like_visitor_key_len CHECK (
        char_length(visitor_key) >= 8 AND char_length(visitor_key) <= 80
    )
);

CREATE INDEX IF NOT EXISTS blog_like_post_id_idx ON public.blog_like (post_id);

CREATE TABLE IF NOT EXISTS public.blog_comment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.blog_post (id) ON DELETE CASCADE,
    full_name text NOT NULL,
    phone text NOT NULL,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'approved'
        CHECK (status IN ('pending', 'approved', 'hidden')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_comment_full_name_len CHECK (
        char_length(trim(full_name)) >= 2 AND char_length(full_name) <= 80
    ),
    CONSTRAINT blog_comment_phone_len CHECK (
        char_length(phone) >= 9 AND char_length(phone) <= 20
    ),
    CONSTRAINT blog_comment_body_len CHECK (
        char_length(trim(body)) >= 2 AND char_length(body) <= 2000
    )
);

CREATE INDEX IF NOT EXISTS blog_comment_post_created_idx
    ON public.blog_comment (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS blog_comment_status_idx
    ON public.blog_comment (status);

COMMENT ON TABLE public.blog_comment IS 'Public blog comments; phone stored for follow-up, not shown publicly';

ALTER TABLE public.blog_like ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comment ENABLE ROW LEVEL SECURITY;

-- Likes are managed via RPC only (no direct client table access).
DROP POLICY IF EXISTS "No direct public blog_like access" ON public.blog_like;

DROP POLICY IF EXISTS "Public read approved blog comments" ON public.blog_comment;
CREATE POLICY "Public read approved blog comments"
    ON public.blog_comment
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'approved'
        AND EXISTS (
            SELECT 1
            FROM public.blog_post p
            WHERE p.id = post_id AND p.status = 'published'
        )
    );

-- Inserts go through SECURITY DEFINER RPC for validation + published check.
DROP POLICY IF EXISTS "No direct public blog_comment insert" ON public.blog_comment;

CREATE OR REPLACE FUNCTION public.increment_blog_view(p_post_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_count bigint;
BEGIN
    UPDATE public.blog_post
    SET view_count = view_count + 1
    WHERE id = p_post_id AND status = 'published'
    RETURNING view_count INTO new_count;

    IF new_count IS NULL THEN
        RAISE EXCEPTION 'Post not found';
    END IF;

    RETURN new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_blog_like(
    p_post_id uuid,
    p_visitor_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_liked boolean;
    v_count bigint;
BEGIN
    IF p_visitor_key IS NULL
        OR char_length(p_visitor_key) < 8
        OR char_length(p_visitor_key) > 80 THEN
        RAISE EXCEPTION 'Invalid visitor key';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.blog_post
        WHERE id = p_post_id AND status = 'published'
    ) THEN
        RAISE EXCEPTION 'Post not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.blog_like
        WHERE post_id = p_post_id AND visitor_key = p_visitor_key
    ) THEN
        DELETE FROM public.blog_like
        WHERE post_id = p_post_id AND visitor_key = p_visitor_key;

        UPDATE public.blog_post
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = p_post_id
        RETURNING like_count INTO v_count;

        v_liked := false;
    ELSE
        INSERT INTO public.blog_like (post_id, visitor_key)
        VALUES (p_post_id, p_visitor_key);

        UPDATE public.blog_post
        SET like_count = like_count + 1
        WHERE id = p_post_id
        RETURNING like_count INTO v_count;

        v_liked := true;
    END IF;

    RETURN jsonb_build_object('liked', v_liked, 'likeCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_blog_comment(
    p_post_id uuid,
    p_full_name text,
    p_phone text,
    p_body text
)
RETURNS public.blog_comment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text := trim(p_full_name);
    v_phone text := trim(p_phone);
    v_body text := trim(p_body);
    v_row public.blog_comment;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.blog_post
        WHERE id = p_post_id AND status = 'published'
    ) THEN
        RAISE EXCEPTION 'Post not found';
    END IF;

    IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
        RAISE EXCEPTION 'Invalid name';
    END IF;
    IF char_length(v_phone) < 9 OR char_length(v_phone) > 20 THEN
        RAISE EXCEPTION 'Invalid phone';
    END IF;
    IF char_length(v_body) < 2 OR char_length(v_body) > 2000 THEN
        RAISE EXCEPTION 'Invalid comment';
    END IF;

    INSERT INTO public.blog_comment (post_id, full_name, phone, body, status)
    VALUES (p_post_id, v_name, v_phone, v_body, 'approved')
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_blog_like(
    p_post_id uuid,
    p_visitor_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.blog_like
        WHERE post_id = p_post_id AND visitor_key = p_visitor_key
    );
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_blog_like(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_blog_comment(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_blog_like(uuid, text) TO anon, authenticated;
