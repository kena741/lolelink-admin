'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { ArrowLeft, RefreshCw, Plus, Edit, Trash2, X, Upload } from 'lucide-react';
import Link from 'next/link';
import { fetchBanners, createBanner, updateBanner, deleteBanner } from '@/features/banner/bannerSlice';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

const BannersPage = () => {
    const dispatch = useAppDispatch();
    const { banners, loading, error } = useAppSelector((state) => state.banner);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<typeof banners[0] | null>(null);
    const [formData, setFormData] = useState({
        bannerName: '',
        image: '',
    });
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchBanners());
    }, [dispatch]);

    const handleOpenModal = (banner?: typeof banners[0]) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData({
                bannerName: banner.bannerName || '',
                image: banner.image || '',
            });
            setImagePreview(banner.image || null);
        } else {
            setEditingBanner(null);
            setFormData({
                bannerName: '',
                image: '',
            });
            setImagePreview(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBanner(null);
        setFormData({
            bannerName: '',
            image: '',
        });
        setImagePreview(null);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        setUploading(true);
        try {
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `banners/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('betegnabucket')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('betegnabucket')
                .getPublicUrl(fileName);

            if (!publicUrlData?.publicUrl) {
                throw new Error('Failed to get public URL');
            }

            setFormData({ ...formData, image: publicUrlData.publicUrl });
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
                })).unwrap();
            } else {
                await dispatch(createBanner({
                    bannerName: formData.bannerName,
                    image: formData.image,
                })).unwrap();
            }
            dispatch(fetchBanners());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save banner:', err);
            alert('Failed to save banner. Please try again.');
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
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <div className="flex-1 ml-64">
                    <div className="p-8">
                        {/* Header */}
                        <div className="mb-6">
                            <Link
                                href="/admin/dashboard"
                                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span className="text-sm font-medium">Back to Dashboard</span>
                            </Link>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">Banners</h1>
                                    <p className="text-gray-600 mt-1">Manage banner images</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchBanners())}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal()}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Banner
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Table */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <input type="checkbox" className="rounded border-gray-300" />
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Banner Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Image
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created At
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading && banners.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                    Loading banners...
                                                </td>
                                            </tr>
                                        ) : banners.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                    No banners found
                                                </td>
                                            </tr>
                                        ) : (
                                            banners.map((banner) => (
                                                <tr key={banner.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                                        {banner.id}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {banner.bannerName || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {banner.image ? (
                                                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                                                <Image
                                                                    src={banner.image}
                                                                    alt={banner.bannerName || 'Banner'}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm">No image</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {formatDate(banner.createdAt)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Image *
                                    </label>
                                    <div className="space-y-3">
                                        {imagePreview && (
                                            <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                                                <Image
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                        )}
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                                <p className="mb-2 text-sm text-gray-500">
                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                disabled={uploading}
                                            />
                                        </label>
                                        {uploading && (
                                            <p className="text-sm text-indigo-600">Uploading image...</p>
                                        )}
                                        {formData.image && !imagePreview && (
                                            <p className="text-sm text-gray-600">Image URL: {formData.image.substring(0, 50)}...</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || !formData.bannerName.trim() || !formData.image.trim()}
                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

