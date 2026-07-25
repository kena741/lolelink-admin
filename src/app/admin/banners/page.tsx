'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { RefreshCw, Plus, Edit, Trash2, X, Upload } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
import { fetchBanners, createBanner, updateBanner, deleteBanner } from '@/features/banner/bannerSlice';
import { deleteStorageFilesFromUrls, uploadFilesToSupabase } from '@/lib/upload';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { Switch } from '@/components/ui/switch';

/** Display frame for banners — matches ~3.8:1 (1200 × 315 / 1140 × 300). */
const BANNER_ASPECT = '1200 / 315';

const BannersPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { banners, loading, error } = useAppSelector((state) => state.banner);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<typeof banners[0] | null>(null);
    const [formData, setFormData] = useState({
        bannerName: '',
        image: '',
        link: '',
        active: true,
    });
    const [uploading, setUploading] = useState(false);
    const [removingImage, setRemovingImage] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [originalImage, setOriginalImage] = useState<string | null>(null);

    const hasImage = Boolean(imagePreview || formData.image);

    useEffect(() => {
        dispatch(fetchBanners());
    }, [dispatch]);

    const handleOpenModal = (banner?: typeof banners[0]) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData({
                bannerName: banner.bannerName || '',
                image: banner.image || '',
                link: banner.link || '',
                active: banner.active !== false,
            });
            setImagePreview(banner.image || null);
            setOriginalImage(banner.image || null);
        } else {
            setEditingBanner(null);
            setFormData({
                bannerName: '',
                image: '',
                link: '',
                active: true,
            });
            setImagePreview(null);
            setOriginalImage(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBanner(null);
        setFormData({
            bannerName: '',
            image: '',
            link: '',
            active: true,
        });
        setImagePreview(null);
        setOriginalImage(null);
        setRemovingImage(false);
    };

    const handleRemoveImage = async () => {
        const url = formData.image.trim();
        setRemovingImage(true);
        try {
            // Delete unsaved uploads from storage; keep original file until replaced/saved
            if (url && url !== originalImage) {
                await deleteStorageFilesFromUrls([url]);
            }
            setImagePreview(null);
            setFormData((prev) => ({ ...prev, image: '' }));
        } catch (err) {
            console.error('Failed to remove image:', err);
            alert('Failed to remove image. Please try again.');
        } finally {
            setRemovingImage(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        setUploading(true);
        try {
            const urls = await uploadFilesToSupabase([file], 'banners');
            if (!urls[0]) {
                throw new Error('Failed to get public URL');
            }

            // Delete previous original after successful replacement upload
            if (originalImage) {
                await deleteStorageFilesFromUrls([originalImage]);
                setOriginalImage(null);
            }

            setFormData((prev) => ({ ...prev, image: urls[0] }));
            setImagePreview(urls[0]);
        } catch (err) {
            console.error('Failed to upload image:', err);
            alert('Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bannerName.trim() || !formData.image.trim()) {
            alert('Please fill in all fields');
            return;
        }

        try {
            if (editingBanner) {
                await dispatch(updateBanner({
                    id: editingBanner.id,
                    bannerName: formData.bannerName,
                    image: formData.image,
                    link: formData.link,
                    active: formData.active,
                })).unwrap();
                if (originalImage && originalImage !== formData.image) {
                    await deleteStorageFilesFromUrls([originalImage]);
                }
            } else {
                await dispatch(createBanner({
                    bannerName: formData.bannerName,
                    image: formData.image,
                    link: formData.link,
                    active: formData.active,
                })).unwrap();
            }
            dispatch(fetchBanners());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save banner:', err);
            alert('Failed to save banner. Please try again.');
        }
    };

    const handleToggleActive = async (banner: typeof banners[0]) => {
        if (!canWriteCatalog) return;
        setTogglingId(banner.id);
        try {
            await dispatch(updateBanner({
                id: banner.id,
                active: !banner.active,
            })).unwrap();
        } catch (err) {
            console.error('Failed to update banner status:', err);
            alert('Failed to update banner status. Please try again.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this banner?')) return;

        setDeletingId(id);
        try {
            await dispatch(deleteBanner(id)).unwrap();
            dispatch(fetchBanners());
        } catch (err) {
            console.error('Failed to delete banner:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Banners"
                            description="Manage banner images · recommended 1200×315 (3.8:1)"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Banners' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchBanners())}
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
                                        Add Banner
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
                                                <input type="checkbox" className="rounded border-gray-300" />
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Banner Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Image
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Link
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Created At
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {loading && banners.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                                    Loading banners...
                                                </td>
                                            </tr>
                                        ) : banners.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                                    No banners found
                                                </td>
                                            </tr>
                                        ) : (
                                            banners.map((banner) => (
                                                <tr key={banner.id} className="hover:bg-gray-50">
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-600">
                                                        {banner.id}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                        {banner.bannerName || '-'}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        {banner.image ? (
                                                            <div
                                                                className="relative w-44 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                                                                style={{ aspectRatio: BANNER_ASPECT }}
                                                            >
                                                                <StorageImage
                                                                    src={banner.image}
                                                                    alt={banner.bannerName || 'Banner'}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">No image</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {banner.link ? (
                                                            <a
                                                                href={banner.link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="break-all text-indigo-600 hover:text-indigo-900"
                                                            >
                                                                {banner.link}
                                                            </a>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                checked={banner.active}
                                                                disabled={!canWriteCatalog || togglingId === banner.id}
                                                                onCheckedChange={() => handleToggleActive(banner)}
                                                                aria-label={banner.active ? 'Deactivate banner' : 'Activate banner'}
                                                            />
                                                            <span className={`text-xs font-medium ${banner.active ? 'text-primary' : 'text-gray-500'}`}>
                                                                {togglingId === banner.id
                                                                    ? 'Saving…'
                                                                    : banner.active
                                                                      ? 'Active'
                                                                      : 'Inactive'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                                        {formatDate(banner.createdAt)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                        {canWriteCatalog ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(banner)}
                                                                className="text-indigo-600 hover:text-indigo-900"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(banner.id)}
                                                                disabled={deletingId === banner.id}
                                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        ) : null}
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
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
                        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingBanner ? 'Edit Banner' : 'Add Banner'}
                            </h2>
                            <button
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
                                        Banner Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bannerName}
                                        onChange={(e) => setFormData({ ...formData, bannerName: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="Banner name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Image *
                                    </label>
                                    <p className="mb-2 text-xs text-gray-500">
                                        Best size: 1200 × 315 (or 1140 × 300) · about 3.8:1 wide.
                                    </p>
                                    <div className="space-y-3">
                                        {hasImage ? (
                                            <div className="space-y-2">
                                                <div
                                                    className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                                                    style={{ aspectRatio: BANNER_ASPECT }}
                                                >
                                                    <StorageImage
                                                        src={imagePreview || formData.image}
                                                        alt="Preview"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    disabled={removingImage || uploading}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    {removingImage ? 'Removing…' : 'Remove image'}
                                                </button>
                                                <p className="text-xs text-gray-500">
                                                    Remove the current image to upload a new one.
                                                </p>
                                            </div>
                                        ) : (
                                            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:bg-gray-50">
                                                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                                                    <Upload className="mb-2 h-8 w-8 text-gray-400" />
                                                    <p className="mb-2 text-sm text-gray-500">
                                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-500">PNG, JPG up to 5MB · 1200×315 recommended</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    disabled={uploading}
                                                />
                                            </label>
                                        )}
                                        {uploading && (
                                            <p className="text-sm text-indigo-600">Uploading image...</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Status
                                    </label>
                                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                                        <Switch
                                            checked={formData.active}
                                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                                            aria-label={formData.active ? 'Banner active' : 'Banner inactive'}
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {formData.active ? 'Active' : 'Inactive'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formData.active
                                                    ? 'This banner will be shown in the app.'
                                                    : 'This banner is hidden until activated.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Link
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.link}
                                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="https://example.com"
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
                                <button
                                    type="submit"
                                    disabled={uploading || removingImage || !formData.bannerName.trim() || !formData.image.trim()}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {editingBanner ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
};

export default BannersPage;
