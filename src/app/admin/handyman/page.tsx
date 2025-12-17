'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    Wrench, 
    ArrowLeft, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    X,
    User,
    Mail,
    Phone,
    MapPin
} from 'lucide-react';
import Link from 'next/link';
import { fetchHandymen, createHandyman, updateHandyman, deleteHandyman } from '@/features/handyman/handymanSlice';

const HandymanPage = () => {
    const dispatch = useAppDispatch();
    const { handymen, loading, error } = useAppSelector((state) => state.handyman);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHandyman, setEditingHandyman] = useState<typeof handymen[0] | null>(null);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        userName: '',
        userType: '',
        category: '',
        subCategory: '',
        address: '',
        countryCode: '',
        active: true,
        isActive: true,
    });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchHandymen());
    }, [dispatch]);

    const handleOpenModal = (handyman?: typeof handymen[0]) => {
        if (handyman) {
            setEditingHandyman(handyman);
            setFormData({
                firstName: handyman.firstName || '',
                lastName: handyman.lastName || '',
                email: handyman.email || '',
                phoneNumber: handyman.phoneNumber || '',
                userName: handyman.userName || '',
                userType: handyman.userType || '',
                category: handyman.category || '',
                subCategory: handyman.subCategory || '',
                address: handyman.address || '',
                countryCode: handyman.countryCode || '',
                active: handyman.active ?? true,
                isActive: handyman.isActive ?? true,
            });
        } else {
            setEditingHandyman(null);
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phoneNumber: '',
                userName: '',
                userType: '',
                category: '',
                subCategory: '',
                address: '',
                countryCode: '',
                active: true,
                isActive: true,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingHandyman(null);
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phoneNumber: '',
            userName: '',
            userType: '',
            category: '',
            subCategory: '',
            address: '',
            countryCode: '',
            active: true,
            isActive: true,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            if (editingHandyman) {
                await dispatch(updateHandyman({
                    id: editingHandyman.id,
                    ...formData,
                })).unwrap();
            } else {
                await dispatch(createHandyman(formData)).unwrap();
            }
            dispatch(fetchHandymen());
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save handyman:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this handyman?')) return;
        
        setDeletingId(id);
        try {
            await dispatch(deleteHandyman(id)).unwrap();
            dispatch(fetchHandymen());
        } catch (err) {
            console.error('Failed to delete handyman:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const toggleActive = async (handyman: typeof handymen[0]) => {
        try {
            await dispatch(updateHandyman({
                id: handyman.id,
                active: !handyman.active,
                isActive: !handyman.isActive,
            })).unwrap();
            dispatch(fetchHandymen());
        } catch (err) {
            console.error('Failed to update handyman:', err);
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
                                            <Wrench className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Handyman
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Handyman</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchHandymen())}
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
                                        Add Handyman
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

                        {loading && handymen.length === 0 ? (
                            <div className="text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                                <p className="text-gray-600">Loading handymen...</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg overflow-hidden">
                                {handymen.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Wrench className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No handymen found</p>
                                        <p className="text-sm text-gray-600 mb-4">Get started by adding your first handyman</p>
                                        <button
                                            onClick={() => handleOpenModal()}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Handyman
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50/50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                        <input type="checkbox" className="rounded border-gray-300" />
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User Type</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subcategory</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Address</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200/50">
                                                {handymen.map((handyman) => (
                                                    <tr 
                                                        key={handyman.id}
                                                        className="hover:bg-gray-50/50 transition-colors"
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input type="checkbox" className="rounded border-gray-300" />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                {handyman.profileImage ? (
                                                                    <img 
                                                                        src={handyman.profileImage} 
                                                                        alt={`${handyman.firstName} ${handyman.lastName}`}
                                                                        className="w-8 h-8 rounded-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                                        <User className="h-4 w-4 text-indigo-600" />
                                                                    </div>
                                                                )}
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {[handyman.firstName, handyman.lastName].filter(Boolean).join(' ') || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                                <Mail className="h-3 w-3" />
                                                                {handyman.email || 'N/A'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                                <Phone className="h-3 w-3" />
                                                                {handyman.countryCode && handyman.phoneNumber 
                                                                    ? `${handyman.countryCode} ${handyman.phoneNumber}`
                                                                    : handyman.phoneNumber || 'N/A'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-900">{handyman.userName || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-600">{handyman.userType || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-600">{handyman.category || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-600">{handyman.subCategory || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1 text-sm text-gray-600 max-w-xs truncate">
                                                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                                                {handyman.address || 'N/A'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <button
                                                                onClick={() => toggleActive(handyman)}
                                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                                                    handyman.active && handyman.isActive
                                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {handyman.active && handyman.isActive ? 'Active' : 'Inactive'}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleOpenModal(handyman)}
                                                                    className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(handyman.id)}
                                                                    disabled={deletingId === handyman.id}
                                                                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Delete"
                                                                >
                                                                    {deletingId === handyman.id ? (
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
                                    </div>
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
                                className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {editingHandyman ? 'Edit Handyman' : 'Add New Handyman'}
                                    </h2>
                                    <button
                                        onClick={handleCloseModal}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X className="h-5 w-5 text-gray-500" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                            <input
                                                type="text"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                            <input
                                                type="text"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                            <input
                                                type="text"
                                                value={formData.phoneNumber}
                                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Country Code</label>
                                            <input
                                                type="text"
                                                value={formData.countryCode}
                                                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                placeholder="+251"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                                            <input
                                                type="text"
                                                value={formData.userName}
                                                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                                            <input
                                                type="text"
                                                value={formData.userType}
                                                onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                            <input
                                                type="text"
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                                            <input
                                                type="text"
                                                value={formData.subCategory}
                                                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
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
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Is Active</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-6 border-t border-gray-200 mt-6">
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                                        >
                                            {editingHandyman ? 'Update Handyman' : 'Create Handyman'}
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

export default HandymanPage;

