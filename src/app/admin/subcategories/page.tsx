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
    ArrowUpDown,
} from 'lucide-react';
import {
    fetchSubCategories,
    createSubCategory,
    updateSubCategory,
    deleteSubCategory,
    fetchAllSubCategoryDocumentIds,
    fetchSubCategoryDocumentIds,
} from '@/features/subcategory/subcategorySlice';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchDocuments } from '@/features/document/documentSlice';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';

const SubCategoriesPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteCatalog } = useAdminPermissions();
    const { subCategories, loading, error, documentIdsBySubCategoryId } = useAppSelector(
        (state) => state.subcategory
    );
    const { categories } = useAppSelector((state) => state.category);
    const { documents } = useAppSelector((state) => state.document);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<
        (typeof subCategories)[0] | null
    >(null);
    const [formData, setFormData] = useState({
        subCategoryName: '',
        categoryId: '',
        isFree: false,
    });
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

    function documentNamesFor(subCategoryId: string): string[] {
        const ids = documentIdsBySubCategoryId[subCategoryId] ?? [];
        return ids
            .map((id) => documents.find((doc) => doc.id === id)?.name || id.slice(0, 8))
            .filter(Boolean);
    }

    const handleOpenModal = (subCategory?: (typeof subCategories)[0]) => {
        if (subCategory) {
            setEditingSubCategory(subCategory);
            setFormData({
                subCategoryName: subCategory.subCategoryName,
                categoryId: subCategory.categoryId,
                isFree: subCategory.isFree === true,
            });
            setSelectedDocumentIds(documentIdsBySubCategoryId[subCategory.id] ?? []);
            dispatch(fetchSubCategoryDocumentIds(subCategory.id));
        } else {
            setEditingSubCategory(null);
            setFormData({ subCategoryName: '', categoryId: '', isFree: false });
            setSelectedDocumentIds([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubCategory(null);
        setFormData({ subCategoryName: '', categoryId: '', isFree: false });
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
                await dispatch(
                    updateSubCategory({
                        id: editingSubCategory.id,
                        ...formData,
                        documentIds: selectedDocumentIds,
                    })
                ).unwrap();
            } else {
                await dispatch(
                    createSubCategory({
                        ...formData,
                        documentIds: selectedDocumentIds,
                    })
                ).unwrap();
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

        if (filterCategory !== 'all') {
            filtered = filtered.filter((sub) => sub.categoryId === filterCategory);
        }

        filtered = [...filtered].sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.subCategoryName.localeCompare(b.subCategoryName);
            }
            return b.subCategoryName.localeCompare(a.subCategoryName);
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

                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/20 bg-white/80 p-3 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Filter className="h-4 w-4 shrink-0 text-gray-500" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:flex-none sm:w-auto"
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
                            type="button"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50"
                        >
                            Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {loading && subCategories.length === 0 ? (
                    <div className="py-12 text-center">
                        <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
                        <p className="text-gray-600">Loading subcategories...</p>
                    </div>
                ) : filteredAndSortedSubCategories.length === 0 ? (
                    <div className="rounded-xl border border-white/20 bg-white/80 p-12 text-center shadow-lg backdrop-blur-xl">
                        <FolderKanban className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                        <p className="mb-2 text-lg font-semibold text-gray-900">No subcategories found</p>
                        <p className="mb-4 text-sm text-gray-600">
                            Get started by creating your first subcategory
                        </p>
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
                    <>
                        <div className="space-y-3 md:hidden">
                            {filteredAndSortedSubCategories.map((subCategory) => {
                                const docs = documentNamesFor(subCategory.id);
                                return (
                                    <article
                                        key={subCategory.id}
                                        className="rounded-xl border border-border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-semibold text-gray-900">
                                                    {subCategory.subCategoryName}
                                                </h3>
                                                <p className="mt-0.5 text-xs text-gray-500">
                                                    {subCategory.categoryName || 'Unknown'}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                    subCategory.isFree
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}
                                            >
                                                {subCategory.isFree ? 'Free' : 'Paid'}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                Required documents
                                            </p>
                                            {docs.length === 0 ? (
                                                <p className="mt-1 text-sm text-gray-500">None</p>
                                            ) : (
                                                <ul className="mt-1 space-y-0.5">
                                                    {docs.map((name) => (
                                                        <li key={name} className="text-sm text-gray-700">
                                                            · {name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        {canWriteCatalog ? (
                                            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenModal(subCategory)}
                                                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(subCategory.id)}
                                                    disabled={deletingId === subCategory.id}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                                    </article>
                                );
                            })}
                        </div>

                        <div className="hidden overflow-hidden rounded-xl border border-white/20 bg-white/80 shadow-lg backdrop-blur-xl md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px]">
                                    <thead className="border-b border-gray-200 bg-gray-50/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                Subcategory
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                Category
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                Listing
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                Required documents
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200/50">
                                        {filteredAndSortedSubCategories.map((subCategory) => {
                                            const docs = documentNamesFor(subCategory.id);
                                            return (
                                                <tr
                                                    key={subCategory.id}
                                                    className="transition-colors hover:bg-gray-50/50"
                                                >
                                                    <td className="px-4 py-4">
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {subCategory.subCategoryName}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-sm text-gray-600">
                                                            {subCategory.categoryName || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                                subCategory.isFree
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}
                                                        >
                                                            {subCategory.isFree ? 'Free' : 'Paid'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {docs.length === 0 ? (
                                                            <span className="text-sm text-gray-500">None</span>
                                                        ) : (
                                                            <ul className="space-y-0.5">
                                                                {docs.map((name) => (
                                                                    <li
                                                                        key={name}
                                                                        className="text-sm text-gray-700"
                                                                    >
                                                                        {name}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                                                        {canWriteCatalog ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenModal(subCategory)}
                                                                    className="rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(subCategory.id)}
                                                                    disabled={deletingId === subCategory.id}
                                                                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
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
                                            );
                                        })}
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
                                {editingSubCategory ? 'Edit Subcategory' : 'Add New Subcategory'}
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
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Subcategory Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.subCategoryName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, subCategoryName: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    placeholder="Enter subcategory name"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Category *
                                </label>
                                <select
                                    required
                                    value={formData.categoryId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, categoryId: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.categoryName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Free listing</p>
                                        <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                            When on, providers can add this service type without a paid listing
                                            plan. Paid types still need an active plan.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={formData.isFree}
                                        onClick={() =>
                                            setFormData({ ...formData, isFree: !formData.isFree })
                                        }
                                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                                            formData.isFree ? 'bg-emerald-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                                                formData.isFree ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                                <p className="mt-2 text-xs font-medium text-gray-700">
                                    Currently: {formData.isFree ? 'Free' : 'Paid'}
                                </p>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Documents required
                                </label>
                                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    {documents.filter((d) => d.active !== false).length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            No active documents. Add documents in Admin → Document types.
                                        </p>
                                    ) : (
                                        documents
                                            .filter((d) => d.active !== false)
                                            .map((doc) => (
                                                <label
                                                    key={doc.id}
                                                    className="flex cursor-pointer items-center gap-2"
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

                            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center">
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

export default SubCategoriesPage;
