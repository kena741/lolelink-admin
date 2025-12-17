'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    FolderTree, 
    ArrowLeft, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    Upload,
    X,
    Check,
    XCircle,
    Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '@/features/category/categorySlice';
import { fetchSubCategories } from '@/features/subcategory/subcategorySlice';
import { uploadFilesToSupabase } from '@/lib/upload';

const CategoriesPage = () => {
    const dispatch = useAppDispatch();
    const { categories, loading, error } = useAppSelector((state) => state.category);
    const { subCategories } = useAppSelector((state) => state.subcategory);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<typeof categories[0] | null>(null);
    const [formData, setFormData] = useState({ categoryName: '', image: '', active: true });
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchCategories());
        dispatch(fetchSubCategories());
    }, [dispatch]);

    // Calculate subcategory counts for each category
    const getSubCategoryCount = (categoryId: string) => {
        return subCategories.filter(sub => sub.categoryId === categoryId).length;
    };

    const handleOpenModal = (category?: typeof categories[0]) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                categoryName: category.categoryName,
                image: category.image || '',
                active: category.active,
            });
            setImagePreview(category.image || null);
        } else {
            setEditingCategory(null);
            setFormData({ categoryName: '', image: '', active: true });
            setImagePreview(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ categoryName: '', image: '', active: true });
        setImagePreview(null);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const urls = await uploadFilesToSupabase([file], 'categories');
            if (urls[0]) {
                setFormData({ ...formData, image: urls[0] });
                setImagePreview(urls[0]);
            }
        } catch (err) {
            console.error('Failed to upload image:', err);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.categoryName.trim()) return;

        try {
            if (editingCategory) {
                await dispatch(updateCategory({
                    id: editingCategory.id,
                    ...formData,
                })).unwrap();
            } else {
                await dispatch(createCategory(formData)).unwrap();
            }
            dispatch(fetchCategories());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save category:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        
        setDeletingId(id);
        try {
            await dispatch(deleteCategory(id)).unwrap();
            dispatch(fetchCategories());
        } catch (err) {
            console.error('Failed to delete category:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const toggleActive = async (category: typeof categories[0]) => {
        try {
            await dispatch(updateCategory({
                id: category.id,
                active: !category.active,
            })).unwrap();
            dispatch(fetchCategories());
        } catch (err) {
            console.error('Failed to update category:', err);
        }
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Header */}
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Link 
                                            href="/admin/dashboard"
                                            className="p-2 bg-white/20 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-white" />
                                        </Link>
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <FolderTree className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Categories
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Categories</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchCategories())}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal()}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/30 hover:bg-white/30 hover:ring-white/50 transition-all duration-300 hover:scale-105"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Category
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {error && (
                            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {loading && categories.length === 0 ? (
                            <div className="text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                <p className="text-gray-600">Loading categories...</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                                {categories.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <FolderTree className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No categories found</p>
                                        <p className="text-sm text-gray-600 mb-4">Get started by creating your first category</p>
                                        <button
                                            onClick={() => handleOpenModal()}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Category
                                        </button>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-gray-50/50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Image</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subcategories</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/50">
                                            {categories.map((category) => (
                                                <tr 
                                                    key={category.id}
                                                    className="hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {category.image ? (
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                                                                <img
                                                                    src={category.image}
                                                                    alt={category.categoryName}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                                                <ImageIcon className="h-5 w-5 text-gray-400" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Link 
                                                            href={`/admin/categories/${category.id}`}
                                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                                                        >
                                                            {category.categoryName}
                                                        </Link>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm text-gray-600">
                                                            {getSubCategoryCount(category.id)} subcategories
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => toggleActive(category)}
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                                                category.active
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {category.active ? (
                                                                <>
                                                                    <Check className="h-3 w-3" />
                                                                    Active
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="h-3 w-3" />
                                                                    Inactive
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(category)}
                                                                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(category.id)}
                                                                disabled={deletingId === category.id}
                                                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Delete"
                                                            >
                                                                {deletingId === category.id ? (
                                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Add/Edit Modal */}
                    {isModalOpen && (
                        <div 
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={handleCloseModal}
                        >
                            <div 
                                className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {editingCategory ? 'Edit Category' : 'Add New Category'}
                                    </h2>
                                    <button
                                        onClick={handleCloseModal}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X className="h-5 w-5 text-gray-500" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Category Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.categoryName}
                                            onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            placeholder="Enter category name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Category Image
                                        </label>
                                        {imagePreview && (
                                            <div className="mb-3 relative">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setImagePreview(null);
                                                        setFormData({ ...formData, image: '' });
                                                    }}
                                                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-600">
                                                    {uploading ? 'Uploading...' : 'Click to upload image'}
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={uploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.active}
                                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            type="submit"
                                            disabled={uploading || !formData.categoryName.trim()}
                                            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {editingCategory ? 'Update Category' : 'Create Category'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
};

export default CategoriesPage;

