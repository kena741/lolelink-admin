'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    FolderKanban, 
    ArrowLeft, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    X,
    Filter,
    ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import { fetchSubCategories, createSubCategory, updateSubCategory, deleteSubCategory } from '@/features/subcategory/subcategorySlice';
import { fetchCategories } from '@/features/category/categorySlice';

const SubCategoriesPage = () => {
    const dispatch = useAppDispatch();
    const { subCategories, loading, error } = useAppSelector((state) => state.subcategory);
    const { categories } = useAppSelector((state) => state.category);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<typeof subCategories[0] | null>(null);
    const [formData, setFormData] = useState({ subCategoryName: '', categoryId: '' });
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        dispatch(fetchSubCategories());
        dispatch(fetchCategories());
    }, [dispatch]);

    const handleOpenModal = (subCategory?: typeof subCategories[0]) => {
        if (subCategory) {
            setEditingSubCategory(subCategory);
            setFormData({
                subCategoryName: subCategory.subCategoryName,
                categoryId: subCategory.categoryId,
            });
        } else {
            setEditingSubCategory(null);
            setFormData({ subCategoryName: '', categoryId: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubCategory(null);
        setFormData({ subCategoryName: '', categoryId: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subCategoryName.trim() || !formData.categoryId) return;

        try {
            if (editingSubCategory) {
                await dispatch(updateSubCategory({
                    id: editingSubCategory.id,
                    ...formData,
                })).unwrap();
            } else {
                await dispatch(createSubCategory(formData)).unwrap();
            }
            dispatch(fetchSubCategories());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save subcategory:', err);
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

    const filteredAndSortedSubCategories = React.useMemo(() => {
        let filtered = subCategories;
        
        // Filter by category
        if (filterCategory !== 'all') {
            filtered = filtered.filter(sub => sub.categoryId === filterCategory);
        }
        
        // Sort by name
        filtered = [...filtered].sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.subCategoryName.localeCompare(b.subCategoryName);
            } else {
                return b.subCategoryName.localeCompare(a.subCategoryName);
            }
        });
        
        return filtered;
    }, [subCategories, filterCategory, sortOrder]);

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
                                            <FolderKanban className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Subcategories
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Subcategories</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchSubCategories())}
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
                                        Insert
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Filter and Sort Bar */}
                        <div className="mb-6 flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-xl p-3 border border-white/20 shadow-lg">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-gray-500" />
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.categoryName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
                                >
                                    Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {loading && subCategories.length === 0 ? (
                            <div className="text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                <p className="text-gray-600">Loading subcategories...</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                                {filteredAndSortedSubCategories.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <FolderKanban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No subcategories found</p>
                                        <p className="text-sm text-gray-600 mb-4">Get started by creating your first subcategory</p>
                                        <button
                                            onClick={() => handleOpenModal()}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Insert
                                        </button>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-gray-50/50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    <input type="checkbox" className="rounded border-gray-300" />
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subcategory Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/50">
                                            {filteredAndSortedSubCategories.map((subCategory) => (
                                                <tr 
                                                    key={subCategory.id}
                                                    className="hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-xs font-mono text-gray-500">{subCategory.id.substring(0, 8)}...</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-gray-900">{subCategory.subCategoryName}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-600">{subCategory.categoryName || 'Unknown'}</span>
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
                                        {editingSubCategory ? 'Edit Subcategory' : 'Add New Subcategory'}
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
                                            Subcategory Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.subCategoryName}
                                            onChange={(e) => setFormData({ ...formData, subCategoryName: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            placeholder="Enter subcategory name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Category *
                                        </label>
                                        <select
                                            required
                                            value={formData.categoryId}
                                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        >
                                            <option value="">Select a category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.categoryName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            type="submit"
                                            disabled={!formData.subCategoryName.trim() || !formData.categoryId}
                                            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {editingSubCategory ? 'Update Subcategory' : 'Create Subcategory'}
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

export default SubCategoriesPage;

