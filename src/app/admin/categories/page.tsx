'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { 
    FolderTree, 
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
import { StorageImage } from '@/components/StorageImage';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '@/features/category/categorySlice';
import { fetchSubCategories } from '@/features/subcategory/subcategorySlice';
import { uploadFilesToSupabase } from '@/lib/upload';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';

const CategoriesPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { categories, loading, error } = useAppSelector((state) => state.category);
    const { subCategories } = useAppSelector((state) => state.subcategory);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<typeof categories[0] | null>(null);
    const [formData, setFormData] = useState({ categoryName: '', image: '', active: true, description: '' });
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!shouldRefetchAdminList('catalog', { hasRows: categories.length > 0 })) return;
        void Promise.all([
            dispatch(fetchCategories()),
            dispatch(fetchSubCategories()),
        ]).then(() => markAdminListFetched('catalog'));
    }, [dispatch, categories.length]);

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
                description: category.description || '',
            });
            setImagePreview(category.image || null);
        } else {
            setEditingCategory(null);
            setFormData({ categoryName: '', image: '', active: true, description: '' });
            setImagePreview(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ categoryName: '', image: '', active: true, description: '' });
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
                await dispatch(
                    updateCategory({
                        id: editingCategory.id,
                        ...formData,
                    })
                ).unwrap();
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
        <>
            
                
                    <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <AdminPageHeader
                            title="Categories"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Categories' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchCategories())}
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
                                        Add Category
                                    </button>
                                    )}
                                </>
                            }
                        />
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
                        ) : categories.length === 0 ? (
                            <div className="rounded-xl border border-white/20 bg-white/80 p-12 text-center shadow-lg backdrop-blur-xl">
                                <FolderTree className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                                <p className="mb-2 text-lg font-semibold text-gray-900">No categories found</p>
                                <p className="mb-4 text-sm text-gray-600">Get started by creating your first category</p>
                                {canWriteCatalog && (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModal()}
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Category
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 md:hidden">
                                    {categories.map((category) => (
                                        <article
                                            key={category.id}
                                            className="rounded-xl border border-border bg-card p-4 shadow-sm"
                                        >
                                            <div className="flex items-start gap-3">
                                                {category.image ? (
                                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                                        <StorageImage
                                                            src={category.image}
                                                            alt={category.categoryName}
                                                            width={48}
                                                            height={48}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                                                        <ImageIcon className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/admin/categories/${category.id}`}
                                                        className="text-sm font-semibold text-indigo-600 hover:underline"
                                                    >
                                                        {category.categoryName}
                                                    </Link>
                                                    {category.description ? (
                                                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                                                            {category.description}
                                                        </p>
                                                    ) : null}
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-xs text-gray-600">
                                                            {getSubCategoryCount(category.id)} subcategories
                                                        </span>
                                                        {canWriteCatalog ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleActive(category)}
                                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                                    category.active
                                                                        ? 'bg-emerald-100 text-emerald-700'
                                                                        : 'bg-gray-100 text-gray-700'
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
                                                        ) : (
                                                            <span
                                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                                    category.active
                                                                        ? 'bg-emerald-100 text-emerald-700'
                                                                        : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                            >
                                                                {category.active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {canWriteCatalog ? (
                                                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModal(category)}
                                                        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(category.id)}
                                                        disabled={deletingId === category.id}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        {deletingId === category.id ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>

                                <div className="hidden overflow-hidden rounded-xl border border-white/20 bg-white/80 shadow-lg backdrop-blur-xl md:block">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[720px]">
                                            <thead className="border-b border-gray-200 bg-gray-50/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Image
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Category Name
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Description
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Subcategories
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200/50">
                                                {categories.map((category) => (
                                                    <tr
                                                        key={category.id}
                                                        className="transition-colors hover:bg-gray-50/50"
                                                    >
                                                        <td className="whitespace-nowrap px-4 py-4">
                                                            {category.image ? (
                                                                <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
                                                                    <StorageImage
                                                                        src={category.image}
                                                                        alt={category.categoryName}
                                                                        width={48}
                                                                        height={48}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                                                                    <ImageIcon className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <Link
                                                                href={`/admin/categories/${category.id}`}
                                                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                                                            >
                                                                {category.categoryName}
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="text-sm text-gray-600">
                                                                {category.description || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-4">
                                                            <span className="text-sm text-gray-600">
                                                                {getSubCategoryCount(category.id)} subcategories
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-4">
                                                            {canWriteCatalog ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleActive(category)}
                                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
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
                                                            ) : (
                                                                <span
                                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                        category.active
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                    }`}
                                                                >
                                                                    {category.active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                                                            {canWriteCatalog ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenModal(category)}
                                                                        className="rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(category.id)}
                                                                        disabled={deletingId === category.id}
                                                                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                                                        title="Delete"
                                                                    >
                                                                        {deletingId === category.id ? (
                                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-4 w-4" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {isModalOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                            onClick={handleCloseModal}
                        >
                            <div
                                className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
                                    <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                                        {editingCategory ? 'Edit Category' : 'Add New Category'}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                                    >
                                        <X className="h-5 w-5 text-gray-500" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Category Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.categoryName}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, categoryName: e.target.value })
                                                }
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                placeholder="Enter category name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Description
                                            </label>
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, description: e.target.value })
                                                }
                                                rows={3}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                                placeholder="Optional description for this category"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Category Image
                                        </label>
                                        {imagePreview && (
                                            <div className="mb-3 relative">
                                                <StorageImage
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    width={800}
                                                    height={192}
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

                                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center">
                                        <button
                                            type="submit"
                                            disabled={uploading || !formData.categoryName.trim()}
                                            className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {editingCategory ? 'Update Category' : 'Create Category'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="rounded-lg bg-gray-100 px-4 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-200 sm:w-auto"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                
            
        </>
    );
};

export default CategoriesPage;

