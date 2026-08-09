'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { 
    FolderKanban, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    X,
    Filter,
    ArrowUpDown
} from 'lucide-react';
import { fetchSubCategories, createSubCategory, updateSubCategory, deleteSubCategory, fetchAllSubCategoryDocumentIds, fetchSubCategoryDocumentIds } from '@/features/subcategory/subcategorySlice';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchDocuments } from '@/features/document/documentSlice';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';

const SubCategoriesPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { subCategories, loading, error, documentIdsBySubCategoryId } = useAppSelector((state) => state.subcategory);
    const { categories } = useAppSelector((state) => state.category);
    const { documents } = useAppSelector((state) => state.document);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<typeof subCategories[0] | null>(null);
    const [formData, setFormData] = useState({ subCategoryName: '', categoryId: '' });
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        if (!shouldRefetchAdminList('catalog', { hasRows: subCategories.length > 0 })) return;
        void Promise.all([
            dispatch(fetchSubCategories()),
            dispatch(fetchCategories()),
            dispatch(fetchDocuments()),
            dispatch(fetchAllSubCategoryDocumentIds()),
        ]).then(() => {
            markAdminListFetched('catalog');
            markAdminListFetched('documents');
        });
    }, [dispatch, subCategories.length]);

    useEffect(() => {
        if (editingSubCategory && documentIdsBySubCategoryId[editingSubCategory.id]) {
            setSelectedDocumentIds(documentIdsBySubCategoryId[editingSubCategory.id]);
        }
    }, [editingSubCategory, documentIdsBySubCategoryId]);

    const handleOpenModal = (subCategory?: typeof subCategories[0]) => {
        if (subCategory) {
            setEditingSubCategory(subCategory);
            setFormData({
                subCategoryName: subCategory.subCategoryName,
                categoryId: subCategory.categoryId,
            });
            setSelectedDocumentIds(documentIdsBySubCategoryId[subCategory.id] ?? []);
            dispatch(fetchSubCategoryDocumentIds(subCategory.id));
        } else {
            setEditingSubCategory(null);
            setFormData({ subCategoryName: '', categoryId: '' });
            setSelectedDocumentIds([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubCategory(null);
        setFormData({ subCategoryName: '', categoryId: '' });
        setSelectedDocumentIds([]);
    };

    const toggleDocument = (documentId: string) => {
        setSelectedDocumentIds((prev) =>
            prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subCategoryName.trim() || !formData.categoryId) return;

        try {
            if (editingSubCategory) {
                await dispatch(updateSubCategory({
                    id: editingSubCategory.id,
                    ...formData,
                    documentIds: selectedDocumentIds,
                })).unwrap();
            } else {
                await dispatch(createSubCategory({
                    ...formData,
                    documentIds: selectedDocumentIds,
                })).unwrap();
            }
            dispatch(fetchSubCategories());
            dispatch(fetchAllSubCategoryDocumentIds());
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
        <>
            
                
                    <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <AdminPageHeader
                            title="Subcategories"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Subcategories' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchSubCategories())}
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
                                        Insert
                                    </button>
                                    )}
                                </>
                            }
                        />
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
                                        {canWriteCatalog && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenModal()}
                                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Insert
                                            </button>
                                        )}
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
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Documents</th>
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
                                                    <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                        {documentIdsBySubCategoryId[subCategory.id]?.length ?? 0} required
                    </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        {canWriteCatalog ? (
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
                                                        ) : null}
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

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Documents required
                                        </label>
                                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                            {documents.filter((d) => d.active !== false).length === 0 ? (
                                                <p className="text-sm text-gray-500">
                                                    No active documents. Add documents in Admin → Documents.
                                                </p>
                                            ) : (
                                                documents
                                                    .filter((d) => d.active !== false)
                                                    .map((doc) => (
                                                        <label
                                                            key={doc.id}
                                                            className="flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDocumentIds.includes(doc.id)}
                                                                onChange={() => toggleDocument(doc.id)}
                                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-sm text-gray-900">
                                                                {doc.name || doc.id}
                                                            </span>
                                                        </label>
                                                    ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            type="submit"
                                            disabled={!formData.subCategoryName.trim() || !formData.categoryId}
                                            className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
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
                
            
        </>
    );
};

export default SubCategoriesPage;

