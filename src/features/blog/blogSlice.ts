import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export type BlogPostStatus = 'draft' | 'published';

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    contentHtml: string;
    coverImage: string;
    authorName: string;
    status: BlogPostStatus;
    publishedAt: string | null;
    createdAt?: string;
    updatedAt?: string;
}

interface BlogState {
    posts: BlogPost[];
    loading: boolean;
    error: string | null;
}

const initialState: BlogState = {
    posts: [],
    loading: false,
    error: null,
};

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

const normalizeRows = (rows: BlogPostRow[] | null | undefined): BlogPost[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        title: row.title ?? '',
        slug: row.slug ?? '',
        excerpt: row.excerpt ?? '',
        contentHtml: row.content_html ?? '',
        coverImage: row.cover_image ?? '',
        authorName: row.author_name ?? '',
        status: row.status === 'published' ? 'published' : 'draft',
        publishedAt: row.published_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));

export type BlogPostInput = {
    title: string;
    slug: string;
    excerpt?: string;
    contentHtml: string;
    coverImage?: string;
    authorName?: string;
    status: BlogPostStatus;
    publishedAt?: string | null;
};

export const fetchBlogPosts = createAsyncThunk<
    BlogPost[],
    void,
    { rejectValue: string }
>('blog/fetchBlogPosts', async (_, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/blog-posts');
        const payload = (await response.json()) as { data?: BlogPostRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Failed to fetch blog posts');
        return normalizeRows(payload.data ?? []);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch blog posts';
        return rejectWithValue(msg);
    }
});

export const createBlogPost = createAsyncThunk<
    BlogPost,
    BlogPostInput,
    { rejectValue: string }
>('blog/createBlogPost', async (input, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/blog-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const payload = (await response.json()) as { data?: BlogPostRow; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error || 'Failed to create post');
        return normalizeRows([payload.data])[0];
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create post';
        return rejectWithValue(msg);
    }
});

export const updateBlogPost = createAsyncThunk<
    BlogPost,
    { id: string } & Partial<BlogPostInput>,
    { rejectValue: string }
>('blog/updateBlogPost', async ({ id, ...updates }, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/blog-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updates }),
        });
        const payload = (await response.json()) as { data?: BlogPostRow; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error || 'Failed to update post');
        return normalizeRows([payload.data])[0];
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to update post';
        return rejectWithValue(msg);
    }
});

export const deleteBlogPost = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>('blog/deleteBlogPost', async (id, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/blog-posts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to delete post');
        return id;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to delete post';
        return rejectWithValue(msg);
    }
});

const blogSlice = createSlice({
    name: 'blog',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchBlogPosts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchBlogPosts.fulfilled, (state, action) => {
                state.loading = false;
                state.posts = action.payload;
            })
            .addCase(fetchBlogPosts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch blog posts';
            })
            .addCase(createBlogPost.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createBlogPost.fulfilled, (state, action) => {
                state.loading = false;
                state.posts.unshift(action.payload);
            })
            .addCase(createBlogPost.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to create post';
            })
            .addCase(updateBlogPost.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateBlogPost.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.posts.findIndex((p) => p.id === action.payload.id);
                if (index !== -1) state.posts[index] = action.payload;
            })
            .addCase(updateBlogPost.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to update post';
            })
            .addCase(deleteBlogPost.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteBlogPost.fulfilled, (state, action) => {
                state.loading = false;
                state.posts = state.posts.filter((p) => p.id !== action.payload);
            })
            .addCase(deleteBlogPost.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete post';
            });
    },
});

export default blogSlice.reducer;
