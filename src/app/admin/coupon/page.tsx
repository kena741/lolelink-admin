'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { ArrowLeft, RefreshCw, Plus, Edit, Trash2, X, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { fetchCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/features/coupon/couponSlice';

const CouponsPage = () => {
    const dispatch = useAppDispatch();
    const { coupons, loading, error } = useAppSelector((state) => state.coupon);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<typeof coupons[0] | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        code: '',
        amount: '',
        minAmount: '',
        active: true,
        isPrivate: false,
        isFix: false,
        expiredAt: '',
    });
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        dispatch(fetchCoupons());
    }, [dispatch]);

    const handleOpenModal = (coupon?: typeof coupons[0]) => {
        if (coupon) {
            setEditingCoupon(coupon);
            setFormData({
                title: coupon.title || '',
                code: coupon.code || '',
                amount: coupon.amount?.toString() || '',
                minAmount: coupon.minAmount?.toString() || '',
                active: coupon.active ?? true,
                isPrivate: coupon.isPrivate ?? false,
                isFix: coupon.isFix ?? false,
                expiredAt: coupon.expiredAt ? new Date(coupon.expiredAt).toISOString().slice(0, 16) : '',
            });
        } else {
            setEditingCoupon(null);
            setFormData({
                title: '',
                code: '',
                amount: '',
                minAmount: '',
                active: true,
                isPrivate: false,
                isFix: false,
                expiredAt: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCoupon(null);
        setFormData({
            title: '',
            code: '',
            amount: '',
            minAmount: '',
            active: true,
            isPrivate: false,
            isFix: false,
            expiredAt: '',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.code.trim()) {
            alert('Please fill in title and code');
            return;
        }

        try {
            const couponData = {
                title: formData.title,
                code: formData.code,
                amount: formData.amount ? parseFloat(formData.amount) : undefined,
                minAmount: formData.minAmount ? parseFloat(formData.minAmount) : undefined,
                active: formData.active,
                isPrivate: formData.isPrivate,
                isFix: formData.isFix,
                expiredAt: formData.expiredAt || undefined,
            };

            if (editingCoupon) {
                await dispatch(updateCoupon({
                    id: editingCoupon.id,
                    ...couponData,
                })).unwrap();
            } else {
                await dispatch(createCoupon(couponData)).unwrap();
            }
            dispatch(fetchCoupons());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save coupon:', err);
            alert('Failed to save coupon. Please try again.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        
        setDeletingId(id);
        try {
            await dispatch(deleteCoupon(id)).unwrap();
            dispatch(fetchCoupons());
        } catch (err) {
            console.error('Failed to delete coupon:', err);
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

    const isExpired = (expiredAt?: string) => {
        if (!expiredAt) return false;
        return new Date(expiredAt) < new Date();
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
                                    <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
                                    <p className="text-gray-600 mt-1">Manage discount coupons</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchCoupons())}
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
                                        Add Coupon
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
                                                Title
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Code
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Min Amount
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Expires At
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading && coupons.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                                    Loading coupons...
                                                </td>
                                            </tr>
                                        ) : coupons.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                                    No coupons found
                                                </td>
                                            </tr>
                                        ) : (
                                            coupons.map((coupon) => (
                                                <tr key={coupon.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                                        {coupon.id}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {coupon.title || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 text-sm font-mono font-semibold">
                                                            {coupon.code || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {coupon.amount !== undefined ? (
                                                            coupon.isFix ? (
                                                                <span>ETB {coupon.amount.toFixed(2)}</span>
                                                            ) : (
                                                                <span>{coupon.amount}%</span>
                                                            )
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {coupon.minAmount !== undefined ? `ETB ${coupon.minAmount.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                                            coupon.isFix
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                            {coupon.isFix ? 'Fixed' : 'Percentage'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                                                coupon.active
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {coupon.active ? (
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
                                                            </span>
                                                            {coupon.isPrivate && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                                    Private
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {coupon.expiredAt ? (
                                                            <span className={isExpired(coupon.expiredAt) ? 'text-red-600' : ''}>
                                                                {formatDate(coupon.expiredAt)}
                                                                {isExpired(coupon.expiredAt) && (
                                                                    <span className="ml-1 text-xs text-red-600">(Expired)</span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">No expiry</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(coupon)}
                                                                className="text-indigo-600 hover:text-indigo-900"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(coupon.id)}
                                                                disabled={deletingId === coupon.id}
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
                                {editingCoupon ? 'Edit Coupon' : 'Add Coupon'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="Coupon title"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="COUPON123"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Amount
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="10.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Minimum Amount
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.minAmount}
                                        onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        placeholder="100.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Type
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="type"
                                                checked={formData.isFix === false}
                                                onChange={() => setFormData({ ...formData, isFix: false })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Percentage</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="type"
                                                checked={formData.isFix === true}
                                                onChange={() => setFormData({ ...formData, isFix: true })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Fixed</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Expires At
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.expiredAt}
                                        onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Status
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="active"
                                                checked={formData.active === true}
                                                onChange={() => setFormData({ ...formData, active: true })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="active"
                                                checked={formData.active === false}
                                                onChange={() => setFormData({ ...formData, active: false })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Inactive</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Visibility
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="isPrivate"
                                                checked={formData.isPrivate === false}
                                                onChange={() => setFormData({ ...formData, isPrivate: false })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Public</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name="isPrivate"
                                                checked={formData.isPrivate === true}
                                                onChange={() => setFormData({ ...formData, isPrivate: true })}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Private</span>
                                        </label>
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
                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {editingCoupon ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
};

export default CouponsPage;

