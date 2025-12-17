'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { Receipt, ArrowLeft, RefreshCw, Plus, Edit, Trash2, X, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { fetchTaxes, createTax, updateTax, deleteTax } from '@/features/tax/taxSlice';

const TaxesPage = () => {
    const dispatch = useAppDispatch();
    const { taxes, loading, error } = useAppSelector((state) => state.tax);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTax, setEditingTax] = useState<typeof taxes[0] | null>(null);
    const [formData, setFormData] = useState({
        country: 'Ethiopia',
        name: '',
        value: '',
        active: false,
        type: 'percentage' as 'percentage' | 'fixed',
    });
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        dispatch(fetchTaxes());
    }, [dispatch]);

    const handleOpenModal = (tax?: typeof taxes[0]) => {
        if (tax) {
            setEditingTax(tax);
            setFormData({
                country: 'Ethiopia',
                name: tax.name || '',
                value: tax.value?.toString() || '',
                active: tax.active ?? false,
                type: (tax.type === 'fixed' || tax.isFix) ? 'fixed' : 'percentage',
            });
        } else {
            setEditingTax(null);
            setFormData({
                country: 'Ethiopia',
                name: '',
                value: '',
                active: false,
                type: 'percentage',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTax(null);
        setFormData({
            country: 'Ethiopia',
            name: '',
            value: '',
            active: false,
            type: 'percentage',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.value) return;

        try {
            if (editingTax) {
                await dispatch(updateTax({
                    id: editingTax.id,
                    country: 'Ethiopia',
                    name: formData.name,
                    value: parseFloat(formData.value),
                    active: formData.active,
                    type: formData.type,
                })).unwrap();
            } else {
                await dispatch(createTax({
                    country: 'Ethiopia',
                    name: formData.name,
                    value: parseFloat(formData.value),
                    active: formData.active,
                    type: formData.type,
                })).unwrap();
            }
            dispatch(fetchTaxes());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save tax:', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this tax?')) return;
        
        setDeletingId(id);
        try {
            await dispatch(deleteTax(id)).unwrap();
            dispatch(fetchTaxes());
        } catch (err) {
            console.error('Failed to delete tax:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const toggleActive = async (tax: typeof taxes[0]) => {
        try {
            await dispatch(updateTax({
                id: tax.id,
                active: !tax.active,
            })).unwrap();
            dispatch(fetchTaxes());
        } catch (err) {
            console.error('Failed to update tax:', err);
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
                                            <Receipt className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Tax Settings
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <Link href="/admin/finance/payout-request" className="hover:text-white transition-colors">
                                            Finance
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Taxes</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchTaxes())}
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
                                        Add Tax
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

                        {loading && taxes.length === 0 ? (
                            <div className="text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                <p className="text-gray-600">Loading taxes...</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                                {taxes.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No taxes found</p>
                                        <p className="text-sm text-gray-600 mb-4">Get started by adding your first tax</p>
                                        <button
                                            onClick={() => handleOpenModal()}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Tax
                                        </button>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-gray-50/50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    <input type="checkbox" className="rounded border-gray-300" />
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/50">
                                            {taxes.map((tax) => (
                                                <tr 
                                                    key={tax.id}
                                                    className="hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-gray-900">{tax.country || '—'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-gray-900">{tax.name || '—'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-900">
                                                            {tax.value !== undefined ? tax.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            tax.type === 'fixed' || tax.isFix
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                            {tax.type === 'fixed' || tax.isFix ? 'Fixed' : 'Percentage'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => toggleActive(tax)}
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                                                tax.active
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {tax.active ? (
                                                                <>
                                                                    <CheckCircle2 className="h-3 w-3" />
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
                                                                onClick={() => handleOpenModal(tax)}
                                                                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(tax.id)}
                                                                disabled={deletingId === tax.id}
                                                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Delete"
                                                            >
                                                                {deletingId === tax.id ? (
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
                                        {editingTax ? 'Edit Tax' : 'Add New Tax'}
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
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                                        <input
                                            type="text"
                                            value="Ethiopia"
                                            disabled
                                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-500 cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            placeholder="Tax name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Value *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={formData.value}
                                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Type</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tax-type"
                                                        checked={formData.type === 'percentage'}
                                                        onChange={() => setFormData({ ...formData, type: 'percentage' })}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Percentage</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tax-type"
                                                        checked={formData.type === 'fixed'}
                                                        onChange={() => setFormData({ ...formData, type: 'fixed' })}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Fixed</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tax-status"
                                                        checked={formData.active === true}
                                                        onChange={() => setFormData({ ...formData, active: true })}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Active</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tax-status"
                                                        checked={formData.active === false}
                                                        onChange={() => setFormData({ ...formData, active: false })}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Inactive</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            type="submit"
                                            disabled={!formData.name.trim() || !formData.value}
                                            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {editingTax ? 'Update Tax' : 'Create Tax'}
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

export default TaxesPage;
