'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    FolderTree, 
    ArrowLeft, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    X,
    FolderKanban
} from 'lucide-react';
import Link from 'next/link';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchSubCategories, createSubCategory, updateSubCategory, deleteSubCategory } from '@/features/subcategory/subcategorySlice';

const CategoryDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { categories } = useAppSelector((state) => state.category);
    const { subCategories, loading, error } = useAppSelector((state) => state.subcategory);
    const categoryId = params.id as string;
    
    const category = categories.find(cat => cat.id === categoryId);
    const categorySubCategories = subCategories.filter(sub => sub.categoryId === categoryId);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<typeof categorySubCategories[0] | null>(null);
    const [formData, setFormData] = useState({ subCategoryName: '' });
    const [multipleSubCategories, setMultipleSubCategories] = useState<string[]>(['']);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isAddingMultiple, setIsAddingMultiple] = useState(false);

    useEffect(() => {
        dispatch(fetchCategories());
        dispatch(fetchSubCategories());
    }, [dispatch]);

    useEffect(() => {
        if (categories.length > 0 && !category) {
            router.push('/admin/categories');
        }
    }, [categories, category, router]);

    const handleOpenModal = (subCategory?: typeof categorySubCategories[0], multiple: boolean = false) => {
        if (subCategory) {
            setEditingSubCategory(subCategory);
            setFormData({
                subCategoryName: subCategory.subCategoryName,
            });
            setIsAddingMultiple(false);
        } else {
            setEditingSubCategory(null);
            setFormData({ subCategoryName: '' });
            setIsAddingMultiple(multiple);
            if (multiple) {
                setMultipleSubCategories(['']);
            }
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubCategory(null);
        setFormData({ subCategoryName: '' });
        setMultipleSubCategories(['']);
        setIsAddingMultiple(false);
    };

    const addSubCategoryField = () => {
        setMultipleSubCategories([...multipleSubCategories, '']);
    };

    const removeSubCategoryField = (index: number) => {
        if (multipleSubCategories.length > 1) {
            setMultipleSubCategories(multipleSubCategories.filter((_, i) => i !== index));
        }
    };

    const updateMultipleSubCategory = (index: number, value: string) => {
        const updated = [...multipleSubCategories];
        updated[index] = value;
        setMultipleSubCategories(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isAddingMultiple) {
            // Add multiple subcategories
            const validSubCategories = multipleSubCategories
                .map(name => name.trim())
                .filter(name => name.length > 0);
            
            if (validSubCategories.length === 0) return;

            try {
                // Create all subcategories
                const promises = validSubCategories.map(name =>
                    dispatch(createSubCategory({
                        subCategoryName: name,
                        categoryId: categoryId,
                    })).unwrap()
                );
                await Promise.all(promises);
                dispatch(fetchSubCategories());
                handleCloseModal();
            } catch (err) {
                console.error('Failed to save subcategories:', err);
            }
        } else {
            // Single subcategory (edit or create)
            if (!formData.subCategoryName.trim()) return;

            try {
                if (editingSubCategory) {
                    await dispatch(updateSubCategory({
                        id: editingSubCategory.id,
                        subCategoryName: formData.subCategoryName,
                    })).unwrap();
                } else {
                    await dispatch(createSubCategory({
                        subCategoryName: formData.subCategoryName,
                        categoryId: categoryId,
                    })).unwrap();
                }
                dispatch(fetchSubCategories());
                handleCloseModal();
            } catch (err) {
                console.error('Failed to save subcategory:', err);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this subcategory?')) return;
        
        setDeletingId(id);
        try {
            await dispatch(deleteSubCategory(id)).unwrap();
            dispatch(fetchSubCategories());
        } catch (err) {
            console.error('Failed to delete subcategory:', err);
        } finally {
            setDeletingId(null);
        }
    };

    if (!category) {
        return (
            <AuthGuard>
                <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                    <Sidebar />
                    <main className="ml-64 w-full min-h-screen flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-gray-600">Category not found</p>
                            <Link href="/admin/categories" className="text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
                                Go back to categories
                            </Link>
                        </div>
                    </main>
                </div>
            </AuthGuard>
        );
    }

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
                                            href="/admin/categories"
                                            className="p-2 bg-white/20 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-white" />
                                        </Link>
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <FolderTree className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                                {category.categoryName}
                                            </h1>
                                            <p className="text-white/80 text-sm mt-1">
                                                {categorySubCategories.length} {categorySubCategories.length === 1 ? 'subcategory' : 'subcategories'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <Link href="/admin/categories" className="hover:text-white transition-colors">
                                            Categories
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">{category.categoryName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            dispatch(fetchSubCategories());
                                            dispatch(fetchCategories());
                                        }}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpenModal(undefined, false)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/30 hover:bg-white/30 hover:ring-white/50 transition-all duration-300 hover:scale-105"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Subcategory
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(undefined, true)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/80 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/30 hover:bg-emerald-500 hover:ring-white/50 transition-all duration-300 hover:scale-105"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Multiple
                                        </button>
                                    </div>
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

                        {loading && categorySubCategories.length === 0 ? (
                            <div className="text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                <p className="text-gray-600">Loading subcategories...</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                                {categorySubCategories.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <FolderKanban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No subcategories found</p>
                                        <p className="text-sm text-gray-600 mb-4">Get started by creating your first subcategory for this category</p>
                                        <button
                                            onClick={() => handleOpenModal()}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Subcategory
                                        </button>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-gray-50/50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subcategory Name</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/50">
                                            {categorySubCategories.map((subCategory) => (
                                                <tr 
                                                    key={subCategory.id}
                                                    className="hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-gray-900">{subCategory.subCategoryName}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(subCategory)}
                                                                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(subCategory.id)}
                                                                disabled={deletingId === subCategory.id}
                                                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Delete"
                                                            >
                                                                {deletingId === subCategory.id ? (
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
                                        {editingSubCategory 
                                            ? 'Edit Subcategory' 
                                            : isAddingMultiple 
                                                ? 'Add Multiple Subcategories' 
                                                : 'Add New Subcategory'}
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
                                            Category
                                        </label>
                                        <input
                                            type="text"
                                            value={category.categoryName}
                                            disabled
                                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-500 cursor-not-allowed"
                                        />
                                    </div>

                                    {isAddingMultiple ? (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Subcategory Names *
                                            </label>
                                            {multipleSubCategories.map((name, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) => updateMultipleSubCategory(index, e.target.value)}
                                                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                        placeholder={`Subcategory ${index + 1}`}
                                                    />
                                                    {multipleSubCategories.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSubCategoryField(index)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addSubCategoryField}
                                                className="w-full mt-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-medium"
                                            >
                                                <Plus className="h-4 w-4 inline mr-2" />
                                                Add Another Field
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">
                                                {multipleSubCategories.filter(n => n.trim()).length} subcategory{multipleSubCategories.filter(n => n.trim()).length !== 1 ? 'ies' : ''} will be created
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Subcategory Name *
                                            </label>
                                            <input
                                                type="text"
                                                required={!isAddingMultiple}
                                                value={formData.subCategoryName}
                                                onChange={(e) => setFormData({ ...formData, subCategoryName: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                placeholder="Enter subcategory name"
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            type="submit"
                                            disabled={
                                                isAddingMultiple 
                                                    ? multipleSubCategories.filter(n => n.trim()).length === 0
                                                    : !formData.subCategoryName.trim()
                                            }
                                            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {editingSubCategory 
                                                ? 'Update Subcategory' 
                                                : isAddingMultiple 
                                                    ? `Create ${multipleSubCategories.filter(n => n.trim()).length} Subcategories`
                                                    : 'Create Subcategory'}
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

export default CategoryDetailPage;

