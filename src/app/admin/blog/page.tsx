'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import BlogRichTextEditor from '@/components/BlogRichTextEditor';
import { StorageImage } from '@/components/StorageImage';
import { RefreshCw, Plus, Edit, Trash2, X, Upload, ExternalLink, MessageSquare, Eye, Heart } from 'lucide-react';
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

const inputClassName =
    'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const BlogPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { posts, loading, error } = useAppSelector((state) => state.blog);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<BlogPost | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [slugTouched, setSlugTouched] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [removingCover, setRemovingCover] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [commentsPost, setCommentsPost] = useState<BlogPost | null>(null);
    const [comments, setComments] = useState<Array<{
        id: string;
        full_name: string;
        phone: string;
        body: string;
        status: string;
        created_at: string;
    }>>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentBusyId, setCommentBusyId] = useState<string | null>(null);
    const [originalCover, setOriginalCover] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const hasCover = Boolean(formData.coverImage.trim());

    useEffect(() => {
        dispatch(fetchBlogPosts());
    }, [dispatch]);

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
        setRemovingCover(false);
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
        setRemovingCover(true);
        try {
            if (url && url !== originalCover) {
                await deleteStorageFilesFromUrls([url]);
            }
            setFormData((prev) => ({ ...prev, coverImage: '' }));
        } catch (err) {
            console.error(err);
            alert('Failed to remove cover image');
        } finally {
            setRemovingCover(false);
        }
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
        setSaving(true);
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
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePublished = async (post: BlogPost) => {
        if (!canWriteCatalog) return;
        setTogglingId(post.id);
        try {
            await dispatch(
                updateBlogPost({
                    id: post.id,
                    status: post.status === 'published' ? 'draft' : 'published',
                })
            ).unwrap();
        } catch (err) {
            console.error(err);
            alert('Failed to update post status');
        } finally {
            setTogglingId(null);
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

    const openComments = async (post: BlogPost) => {
        setCommentsPost(post);
        setCommentsLoading(true);
        setComments([]);
        try {
            const res = await fetch(`/api/blog-posts/${post.id}/comments`);
            const payload = (await res.json()) as {
                data?: Array<{
                    id: string;
                    full_name: string;
                    phone: string;
                    body: string;
                    status: string;
                    created_at: string;
                }>;
                error?: string;
            };
            if (!res.ok) throw new Error(payload.error || 'Failed to load comments');
            setComments(payload.data ?? []);
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to load comments');
            setCommentsPost(null);
        } finally {
            setCommentsLoading(false);
        }
    };

    const updateCommentStatus = async (commentId: string, status: 'approved' | 'hidden') => {
        if (!commentsPost) return;
        setCommentBusyId(commentId);
        try {
            const res = await fetch(`/api/blog-posts/${commentsPost.id}/comments`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId, status }),
            });
            const payload = (await res.json()) as { data?: { id: string; status: string }; error?: string };
            if (!res.ok) throw new Error(payload.error || 'Failed to update comment');
            setComments((prev) =>
                prev.map((c) => (c.id === commentId ? { ...c, status } : c))
            );
            dispatch(fetchBlogPosts());
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to update comment');
        } finally {
            setCommentBusyId(null);
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!commentsPost || !confirm('Delete this comment?')) return;
        setCommentBusyId(commentId);
        try {
            const res = await fetch(`/api/blog-posts/${commentsPost.id}/comments`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId }),
            });
            const payload = (await res.json()) as { ok?: boolean; error?: string };
            if (!res.ok || !payload.ok) throw new Error(payload.error || 'Failed to delete comment');
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            dispatch(fetchBlogPosts());
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to delete comment');
        } finally {
            setCommentBusyId(null);
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
        <>
            <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <AdminPageHeader
                    title="Blog"
                    description="Manage posts for zemenservice.com/blog"
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
                                    Add Post
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

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Cover
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Views
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Likes
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Comments
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Published
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {loading && posts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            Loading posts...
                                        </td>
                                    </tr>
                                ) : posts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            No blog posts found
                                        </td>
                                    </tr>
                                ) : (
                                    posts.map((post) => (
                                        <tr key={post.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {post.title || '—'}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs text-gray-500">
                                                        /blog/{post.slug}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                {post.coverImage ? (
                                                    <div className="relative h-12 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                                                        <StorageImage
                                                            src={post.coverImage}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">No image</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={post.status === 'published'}
                                                        disabled={!canWriteCatalog || togglingId === post.id}
                                                        onCheckedChange={() => handleTogglePublished(post)}
                                                        aria-label={
                                                            post.status === 'published'
                                                                ? 'Unpublish post'
                                                                : 'Publish post'
                                                        }
                                                    />
                                                    <span
                                                        className={`text-xs font-medium ${
                                                            post.status === 'published'
                                                                ? 'text-primary'
                                                                : 'text-gray-500'
                                                        }`}
                                                    >
                                                        {togglingId === post.id
                                                            ? 'Saving…'
                                                            : post.status === 'published'
                                                              ? 'Published'
                                                              : 'Draft'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-600">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                                                    {post.viewCount ?? 0}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-600">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Heart className="h-3.5 w-3.5 text-gray-400" />
                                                    {post.likeCount ?? 0}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-600">
                                                <button
                                                    type="button"
                                                    onClick={() => openComments(post)}
                                                    className="inline-flex items-center gap-1.5 text-gray-700 hover:text-primary"
                                                    title="View comments"
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                                    {post.commentCount ?? 0}
                                                </button>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                                {formatDate(post.publishedAt)}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openComments(post)}
                                                        className="text-gray-500 hover:text-gray-800"
                                                        title="Comments"
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </button>
                                                    {post.status === 'published' && (
                                                        <a
                                                            href={`https://www.zemenservice.com/blog/${post.slug}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-gray-500 hover:text-gray-800"
                                                            title="View live"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                    {canWriteCatalog ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenModal(post)}
                                                                className="text-primary hover:text-primary/80"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(post.id)}
                                                                disabled={deletingId === post.id}
                                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    ) : null}
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

            {commentsPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-900">Comments</h2>
                                <p className="truncate text-sm text-gray-500">{commentsPost.title}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCommentsPost(null);
                                    setComments([]);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {commentsLoading ? (
                                <p className="py-8 text-center text-sm text-gray-500">Loading comments…</p>
                            ) : comments.length === 0 ? (
                                <p className="py-8 text-center text-sm text-gray-500">No comments yet</p>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {comments.map((comment) => (
                                        <li key={comment.id} className="py-4">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {comment.full_name}
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-gray-600">
                                                        {comment.phone}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-gray-400">
                                                        {formatDate(comment.created_at)}
                                                        {' · '}
                                                        <span
                                                            className={
                                                                comment.status === 'approved'
                                                                    ? 'text-emerald-600'
                                                                    : comment.status === 'hidden'
                                                                      ? 'text-amber-600'
                                                                      : 'text-gray-500'
                                                            }
                                                        >
                                                            {comment.status}
                                                        </span>
                                                    </p>
                                                </div>
                                                {canWriteCatalog ? (
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        {comment.status !== 'hidden' ? (
                                                            <button
                                                                type="button"
                                                                disabled={commentBusyId === comment.id}
                                                                onClick={() => updateCommentStatus(comment.id, 'hidden')}
                                                                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                            >
                                                                Hide
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={commentBusyId === comment.id}
                                                                onClick={() => updateCommentStatus(comment.id, 'approved')}
                                                                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            disabled={commentBusyId === comment.id}
                                                            onClick={() => deleteComment(comment.id)}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                                {comment.body}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
                        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white p-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editing ? 'Edit Post' : 'Add Post'}
                                </h2>
                                {editing ? (
                                    <p className="mt-1 text-xs text-gray-500">
                                        {editing.viewCount ?? 0} views · {editing.likeCount ?? 0} likes ·{' '}
                                        {editing.commentCount ?? 0} comments
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Title *
                                    </label>
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
                                        className={inputClassName}
                                        placeholder="Post title"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Slug *
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="shrink-0 text-sm text-gray-500">/blog/</span>
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
                                            className={`${inputClassName} font-mono`}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.authorName}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                authorName: e.target.value,
                                            }))
                                        }
                                        className={inputClassName}
                                        placeholder="Zemen Service"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Status
                                    </label>
                                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                                        <Switch
                                            checked={formData.status === 'published'}
                                            onCheckedChange={(checked) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    status: checked ? 'published' : 'draft',
                                                }))
                                            }
                                            disabled={!canWriteCatalog}
                                            aria-label={
                                                formData.status === 'published'
                                                    ? 'Post published'
                                                    : 'Post draft'
                                            }
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {formData.status === 'published' ? 'Published' : 'Draft'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formData.status === 'published'
                                                    ? 'This post is visible on the public site.'
                                                    : 'This post is hidden until published.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Excerpt
                                    </label>
                                    <textarea
                                        value={formData.excerpt}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                excerpt: e.target.value,
                                            }))
                                        }
                                        rows={2}
                                        className={inputClassName}
                                        placeholder="Short summary"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Cover image
                                    </label>
                                    <div className="space-y-3">
                                        {hasCover ? (
                                            <div className="space-y-2">
                                                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                                    <StorageImage
                                                        src={formData.coverImage}
                                                        alt="Cover preview"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                {canWriteCatalog && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleRemoveCover()}
                                                            disabled={removingCover || uploadingCover}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            {removingCover ? 'Removing…' : 'Remove image'}
                                                        </button>
                                                        <p className="text-xs text-gray-500">
                                                            Remove the current image to upload a new one.
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        ) : canWriteCatalog ? (
                                            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:bg-gray-50">
                                                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                                                    <Upload className="mb-2 h-8 w-8 text-gray-400" />
                                                    <p className="mb-2 text-sm text-gray-500">
                                                        <span className="font-semibold">Click to upload</span>
                                                    </p>
                                                    <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleCoverUpload}
                                                    className="hidden"
                                                    disabled={uploadingCover}
                                                />
                                            </label>
                                        ) : (
                                            <p className="text-sm text-gray-400">No cover image</p>
                                        )}
                                        {uploadingCover && (
                                            <p className="text-sm text-primary">Uploading image...</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Content
                                    </label>
                                    <BlogRichTextEditor
                                        value={formData.contentHtml}
                                        onChange={(contentHtml) =>
                                            setFormData((prev) => ({ ...prev, contentHtml }))
                                        }
                                        placeholder="Write the article…"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                {canWriteCatalog && (
                                    <button
                                        type="submit"
                                        disabled={
                                            saving ||
                                            uploadingCover ||
                                            removingCover ||
                                            !formData.title.trim()
                                        }
                                        className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default BlogPage;
