'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
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
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            Loading posts...
                                        </td>
                                    </tr>
                                ) : posts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                                {formatDate(post.publishedAt)}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
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

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
                        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editing ? 'Edit Post' : 'Add Post'}
                            </h2>
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
