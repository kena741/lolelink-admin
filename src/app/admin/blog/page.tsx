'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import BlogRichTextEditor from '@/components/BlogRichTextEditor';
import { StorageImage } from '@/components/StorageImage';
import { RefreshCw, Plus, Edit, Trash2, X, Upload, ExternalLink } from 'lucide-react';
import {
    fetchBlogPosts,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
    type BlogPost,
    type BlogPostStatus,
} from '@/features/blog/blogSlice';
import { deleteStorageFilesFromUrls, uploadFilesToSupabase } from '@/lib/upload';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { Switch } from '@/components/ui/switch';

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

const emptyForm = {
    title: '',
    slug: '',
    excerpt: '',
    contentHtml: '',
    coverImage: '',
    authorName: '',
    status: 'draft' as BlogPostStatus,
};

const BlogPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { posts, loading, error } = useAppSelector((state) => state.blog);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<BlogPost | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [slugTouched, setSlugTouched] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [originalCover, setOriginalCover] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchBlogPosts());
    }, [dispatch]);

    const sorted = useMemo(() => posts, [posts]);

    const handleOpenModal = (post?: BlogPost) => {
        if (post) {
            setEditing(post);
            setFormData({
                title: post.title,
                slug: post.slug,
                excerpt: post.excerpt,
                contentHtml: post.contentHtml,
                coverImage: post.coverImage,
                authorName: post.authorName,
                status: post.status,
            });
            setOriginalCover(post.coverImage || null);
            setSlugTouched(true);
        } else {
            setEditing(null);
            setFormData(emptyForm);
            setOriginalCover(null);
            setSlugTouched(false);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditing(null);
        setFormData(emptyForm);
        setOriginalCover(null);
        setSlugTouched(false);
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }
        setUploadingCover(true);
        try {
            const urls = await uploadFilesToSupabase([file], 'blog');
            if (!urls[0]) throw new Error('Failed to get public URL');
            if (originalCover && formData.coverImage && formData.coverImage !== originalCover) {
                await deleteStorageFilesFromUrls([formData.coverImage]);
            }
            setFormData((prev) => ({ ...prev, coverImage: urls[0] }));
        } catch (err) {
            console.error(err);
            alert('Failed to upload cover image');
        } finally {
            setUploadingCover(false);
        }
    };

    const handleRemoveCover = async () => {
        const url = formData.coverImage.trim();
        if (url && url !== originalCover) {
            await deleteStorageFilesFromUrls([url]);
        }
        setFormData((prev) => ({ ...prev, coverImage: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Title is required');
            return;
        }
        const slug = formData.slug.trim() || slugify(formData.title);
        if (!slug) {
            alert('Slug is required');
            return;
        }
        try {
            if (editing) {
                await dispatch(
                    updateBlogPost({
                        id: editing.id,
                        title: formData.title.trim(),
                        slug,
                        excerpt: formData.excerpt.trim(),
                        contentHtml: formData.contentHtml,
                        coverImage: formData.coverImage.trim(),
                        authorName: formData.authorName.trim(),
                        status: formData.status,
                    })
                ).unwrap();
                if (originalCover && originalCover !== formData.coverImage) {
                    await deleteStorageFilesFromUrls([originalCover]);
                }
            } else {
                await dispatch(
                    createBlogPost({
                        title: formData.title.trim(),
                        slug,
                        excerpt: formData.excerpt.trim(),
                        contentHtml: formData.contentHtml,
                        coverImage: formData.coverImage.trim(),
                        authorName: formData.authorName.trim(),
                        status: formData.status,
                    })
                ).unwrap();
            }
            dispatch(fetchBlogPosts());
            handleCloseModal();
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to save post');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this blog post?')) return;
        setDeletingId(id);
        try {
            await dispatch(deleteBlogPost(id)).unwrap();
        } catch (err) {
            console.error(err);
            alert('Failed to delete post');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Blog"
                            description="Write and publish articles for zemenservice.com/blog"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Blog' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchBlogPosts())}
                                        disabled={loading}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    {canWriteCatalog && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModal()}
                                            className={adminHeaderButtonClassName()}
                                        >
                                            <Plus className="h-4 w-4" />
                                            New post
                                        </button>
                                    )}
                                </>
                            }
                        />

                        {error && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-border bg-muted/40">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Post
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Published
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {loading && sorted.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                                                    Loading posts…
                                                </td>
                                            </tr>
                                        ) : sorted.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                                                    No blog posts yet
                                                </td>
                                            </tr>
                                        ) : (
                                            sorted.map((post) => (
                                                <tr key={post.id} className="hover:bg-muted/30">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-start gap-4">
                                                            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                                                                {post.coverImage ? (
                                                                    <StorageImage
                                                                        src={post.coverImage}
                                                                        alt=""
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                ) : null}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-medium text-foreground">
                                                                    {post.title}
                                                                </p>
                                                                <p className="truncate text-xs text-muted-foreground">
                                                                    /blog/{post.slug}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                                post.status === 'published'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}
                                                        >
                                                            {post.status}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                                        {formatDate(post.publishedAt)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {post.status === 'published' && (
                                                                <a
                                                                    href={`https://www.zemenservice.com/blog/${post.slug}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    title="View live"
                                                                >
                                                                    <ExternalLink className="h-4 w-4" />
                                                                </a>
                                                            )}
                                                            {canWriteCatalog && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenModal(post)}
                                                                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(post.id)}
                                                                        disabled={deletingId === post.id}
                                                                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>

                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
                        <div className="my-6 w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
                                <h2 className="text-lg font-semibold text-card-foreground">
                                    {editing ? 'Edit post' : 'New post'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="rounded-lg p-2 hover:bg-muted"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">Title</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => {
                                            const title = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                title,
                                                slug: slugTouched ? prev.slug : slugify(title),
                                            }));
                                        }}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">Slug</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">/blog/</span>
                                        <input
                                            type="text"
                                            value={formData.slug}
                                            onChange={(e) => {
                                                setSlugTouched(true);
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    slug: slugify(e.target.value),
                                                }));
                                            }}
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium">Author</label>
                                        <input
                                            type="text"
                                            value={formData.authorName}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    authorName: e.target.value,
                                                }))
                                            }
                                            placeholder="Zemen Service"
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div className="flex items-end justify-between gap-3 rounded-lg border border-input px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">Published</p>
                                            <p className="text-xs text-muted-foreground">
                                                Visible on the public site
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.status === 'published'}
                                            onCheckedChange={(checked) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    status: checked ? 'published' : 'draft',
                                                }))
                                            }
                                            disabled={!canWriteCatalog}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">Excerpt</label>
                                    <textarea
                                        value={formData.excerpt}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                excerpt: e.target.value,
                                            }))
                                        }
                                        rows={2}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Short summary for cards and SEO"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">Cover image</label>
                                    {formData.coverImage ? (
                                        <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-lg border border-border bg-muted">
                                            <StorageImage
                                                src={formData.coverImage}
                                                alt=""
                                                fill
                                                className="object-cover"
                                            />
                                            {canWriteCatalog && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleRemoveCover()}
                                                    className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                    {canWriteCatalog && (
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40">
                                            <Upload className="h-4 w-4" />
                                            {uploadingCover ? 'Uploading…' : 'Upload cover'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleCoverUpload}
                                                disabled={uploadingCover}
                                            />
                                        </label>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">Content</label>
                                    <BlogRichTextEditor
                                        value={formData.contentHtml}
                                        onChange={(contentHtml) =>
                                            setFormData((prev) => ({ ...prev, contentHtml }))
                                        }
                                        placeholder="Write the article…"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        Cancel
                                    </button>
                                    {canWriteCatalog && (
                                        <button
                                            type="submit"
                                            disabled={loading || uploadingCover}
                                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                        >
                                            {editing ? 'Save changes' : 'Create post'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AuthGuard>
    );
};

export default BlogPage;
