
'use client';
import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProviderById, fetchProviderServices, clearSelected, clearServices, updateProvider } from '@/features/provider/providerSlice';
import { addService, openAddServiceModal, closeAddServiceModal } from '@/features/service/addServiceSlice';
import { openEditModal } from '@/features/service/editServiceSlice';
import EditServiceModal from './EditServiceModal';
import { deleteService as deleteServiceThunk } from '@/features/service/deleteServiceSlice';
import { approveServicesByProvider } from '@/features/service/approveServicesSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import { fetchPayoutRequests } from '@/features/payout/payoutSlice';
import { fetchHandymen, updateHandyman, deleteHandyman, type Handyman } from '@/features/handyman/handymanSlice';
import { Pencil, Trash2, FileText, DollarSign, Wrench, Clock, Briefcase, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RootState } from '@/store/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProviderDetailPage() {
    const params = useParams();
    const id = (params?.id as string) || '';

    const dispatch = useAppDispatch();
    const { selected: provider, selectedLoading, error, services, servicesLoading } = useAppSelector((s) => s.provider);
    const { loading: deleteLoading, error: deleteError } = useAppSelector((s: RootState) => s.deleteService ?? { loading: false, error: null, success: false });

    const { documents } = useAppSelector((state) => state.verifyDocuments);
    const { requests: payoutRequests } = useAppSelector((state) => state.payout);
    const { handymen } = useAppSelector((state) => state.handyman);
    
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [editingHandyman, setEditingHandyman] = useState<Handyman | null>(null);
    const [handymanForm, setHandymanForm] = useState({
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
    const [deletingHandymanId, setDeletingHandymanId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'services' | 'documents' | 'withdrawals' | 'handyman'>('services');

    useEffect(() => {
        if (!id) return;
        dispatch(fetchProviderById(id));
        dispatch(fetchProviderServices(id));
        dispatch(fetchVerifyDocuments());
        dispatch(fetchPayoutRequests());
        dispatch(fetchHandymen());
        return () => {
            dispatch(clearSelected());
            dispatch(clearServices());
        };
    }, [dispatch, id]);

    // Filter data for this provider
    const providerDocuments = documents.filter(doc => doc.providerId === id);
    const providerWithdrawals = payoutRequests.filter(req => req.providerId === id);
    const providerHandymen = handymen.filter(h => h.providerId === id);
    
    // Calculate total earnings (sum of approved/completed withdrawals)
    const totalEarnings = providerWithdrawals
        .filter(req => req.paymentStatus === 'approved' || req.paymentStatus === 'completed')
        .reduce((sum, req) => sum + (typeof req.amount === 'string' ? parseFloat(req.amount) || 0 : req.amount || 0), 0);
    
    const totalPending = providerWithdrawals
        .filter(req => req.paymentStatus === 'pending')
        .reduce((sum, req) => sum + (typeof req.amount === 'string' ? parseFloat(req.amount) || 0 : req.amount || 0), 0);

    const bannerSrc = provider?.banner || undefined;
    const profileSrc = provider?.profileImage || provider?.profile_image || provider?.avatar_url || undefined;
    const displayName = (() => {
        const first = provider?.firstName ?? provider?.first_name;
        const last = provider?.lastName ?? provider?.last_name;
        const full = [first, last].filter(Boolean).join(' ');
        return full || provider?.name || '—';
    })();

    // Edit modal state
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        banner: '',
        avatar: '',
    });
    useEffect(() => {
        if (!provider) return;
        setForm({
            name: (provider.name || `${provider.firstName ?? provider.first_name ?? ''} ${provider.lastName ?? provider.last_name ?? ''}`.trim()).trim(),
            phone: provider.phoneNumber || provider.phone || '',
            address: provider.address || '',
            banner: provider.banner || '',
            avatar: provider.profileImage || provider.profile_image || provider.avatar_url || '',
        });
    }, [provider]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const onSave = async () => {
        if (!provider) return;
        const updates: Partial<import('@/features/provider/providerSlice').Provider> = {};
        const nameVal = form.name.trim();
        const phoneVal = form.phone.trim();
        const addressVal = form.address.trim();
        const bannerVal = form.banner.trim();
        const avatarVal = form.avatar.trim();

        if (nameVal) updates.name = nameVal;
        if (phoneVal) updates.phone = phoneVal;
        if (addressVal) updates.address = addressVal;
        if (bannerVal) updates.banner = bannerVal;
        if (avatarVal) updates.profile_image = avatarVal;

        await dispatch(updateProvider({ id: provider.id, updates }));
        setOpen(false);
    };

    // Service add/edit modal state
    const { open: addOpen, loading: addLoading, error: addError } = useAppSelector((s) => s.addServiceModal);
    const [serviceForm, setServiceForm] = useState({
        name: '',
        description: '',
        imageUrl: '',
        price: '',
        address: '',
        categoryName: '',
        subCategoryName: '',
        discount: '',
        duration: '',
        prePayment: false,
        feature: false,
        status: true,
        active: true,
        type: '',
        serviceLocationMode: 'onsite',
    });
    // removed: local uploading state (handled within modals/slices)
    const [addImages, setAddImages] = useState<File[]>([]);
    const [addVideo, setAddVideo] = useState<File | undefined>(undefined);
    // removed: local editVideo state (handled by EditServiceModal)

    const resetServiceForm = () => setServiceForm({
        name: '', description: '', imageUrl: '', price: '', address: '', categoryName: '', subCategoryName: '', discount: '', duration: '', prePayment: false, feature: false, status: true, active: true, type: '', serviceLocationMode: 'onsite'
    });

    const openAddService = () => {
        resetServiceForm();
        setAddImages([]);
        setAddVideo(undefined);
        dispatch(openAddServiceModal());
    };
    const openEditService = (svcId: string) => {
        const svc = services.find(s => s.id === svcId);
        if (!svc) return;
        const imgs: string[] | undefined = svc.images
            ?? (Array.isArray(svc.serviceImage)
                ? svc.serviceImage
                : (svc.serviceImage ? [svc.serviceImage] : (svc.image ? [svc.image] : undefined)));
        const maybeVideo = (svc as unknown as { video?: string | null }).video;
        const mapped: import('@/features/service/editServiceSlice').ServiceModel = {
            id: svc.id,
            serviceName: svc.serviceName ?? svc.name ?? '',
            description: svc.description ?? '',
            price: svc.price,
            duration: svc.duration,
            serviceImage: imgs ?? [],
            discount: svc.discount,
            type: svc.type,
            status: svc.status,
            prePayment: svc.prePayment,
            feature: svc.feature,
            serviceLocationMode: undefined,
            video: maybeVideo ?? null,
        };
        dispatch(openEditModal(mapped));
    };
    const onServiceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            setServiceForm(f => ({ ...f, [name]: checked }));
        } else {
            setServiceForm(f => ({ ...f, [name]: value }));
        }
    };
    const onCreateService = async () => {
        if (!id) return;
        const service = {
            serviceName: (serviceForm.name ?? '').toString().trim(),
            description: (serviceForm.description ?? '').toString().trim(),
            address: (serviceForm.address ?? '').toString().trim(),
            categoryId: '',
            categoryModel: { id: '', name: (serviceForm.categoryName ?? '').toString().trim() },
            subCategoryId: '',
            subCategoryModel: { id: '', name: (serviceForm.subCategoryName ?? '').toString().trim() },
            price: (serviceForm.price ?? '').toString().trim(),
            discount: (serviceForm.discount ?? '').toString().trim() || undefined,
            provider_id: id,
            serviceImage: [],
            video: undefined,
            createdAt: new Date(),
            duration: (serviceForm.duration ?? '').toString().trim() || undefined,
            prePayment: !!serviceForm.prePayment,
            likedUser: null,
            reviewCount: 0,
            reviewSum: 0,
            feature: !!serviceForm.feature,
            status: !!serviceForm.status,
            active: !!serviceForm.active,
            slug: undefined,
            type: (serviceForm.type ?? '').toString().trim(),
            serviceLocationMode: (serviceForm.serviceLocationMode ?? 'onsite').toString(),
            location: undefined,
            position: undefined,
        } as import('@/features/service/addServiceSlice').AddServiceModel;

        try {
            await dispatch(addService({ service, imageFiles: addImages, videoFile: addVideo })).unwrap();
            await dispatch(fetchProviderServices(id));
            resetServiceForm();
            setAddImages([]);
            setAddVideo(undefined);
            dispatch(closeAddServiceModal());
        } catch (e) {
            // Error handled via slice state
            console.error('Add service failed', e);
        }
    };
    // removed: onUpdateService (handled by EditServiceModal + slice)

    // removed: onUploadFiles (not needed)
    const onAddImageFiles = (files: FileList | null) => {
        if (!files) return;
        setAddImages(Array.from(files));
    };
    const onAddVideoFile = (files: FileList | null) => {
        if (!files || files.length === 0) { setAddVideo(undefined); return; }
        setAddVideo(files[0]);
    };

    // Delete confirm modal state and handler
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const confirmDelete = async () => {
        if (!deleteId || !id) return;
        try {
            await dispatch(deleteServiceThunk(deleteId)).unwrap();
            await dispatch(fetchProviderServices(id));
        } catch (e) {
            console.error('Delete failed', e);
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <AuthGuard>
            <div className="flex">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen bg-gray-50">
                    {(selectedLoading || servicesLoading) && (
                        <div className="p-10">Loading...</div>
                    )}
                    {error && (
                        <div className="p-10 text-red-600">{error}</div>
                    )}
                    {!selectedLoading && provider && (
                        <>
                            <div>
                                {/* Banner */}
                                <div className="h-48 w-full bg-gray-200 relative">
                                    {bannerSrc ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={bannerSrc} alt="Banner" className="h-48 w-full object-cover" />
                                    ) : (
                                        <div className="h-48 w-full bg-gradient-to-r from-gray-200 to-gray-300" />)
                                    }
                                    {/* Profile image */}
                                    <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full ring-4 ring-white overflow-hidden bg-gray-300">
                                        {profileSrc ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={profileSrc} alt={displayName} className="h-full w-full object-cover" />
                                        ) : null}
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="p-10 pt-16">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h1 className="text-3xl font-bold">{displayName}</h1>
                                            <p className="text-gray-600">{provider.email || '—'} · {provider.phoneNumber || provider.phone || '—'}</p>
                                            <p className="text-gray-600">{provider.address || '—'}</p>
                                        </div>
                                        <Button onClick={() => setOpen(true)} variant="outline">Edit</Button>
                                    </div>

                                    {/* Earnings Summary */}
                                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white rounded-lg shadow p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-emerald-100 rounded-lg">
                                                    <DollarSign className="h-6 w-6 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Earnings</p>
                                                    <p className="text-2xl font-bold text-gray-900">ETB {totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg shadow p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-amber-100 rounded-lg">
                                                    <Clock className="h-6 w-6 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Pending Withdrawals</p>
                                                    <p className="text-2xl font-bold text-gray-900">ETB {totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg shadow p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-indigo-100 rounded-lg">
                                                    <FileText className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Withdrawals</p>
                                                    <p className="text-2xl font-bold text-gray-900">{providerWithdrawals.length}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabs */}
                                    <div className="mb-6 flex items-center gap-2 bg-white rounded-lg p-1 shadow border border-gray-200">
                                        <button
                                            onClick={() => setActiveTab('services')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                activeTab === 'services'
                                                    ? 'bg-indigo-500 text-white shadow-md'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <Briefcase className="h-4 w-4" />
                                            Services
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('documents')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                activeTab === 'documents'
                                                    ? 'bg-indigo-500 text-white shadow-md'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <FileText className="h-4 w-4" />
                                            Documents
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('withdrawals')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                activeTab === 'withdrawals'
                                                    ? 'bg-indigo-500 text-white shadow-md'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <History className="h-4 w-4" />
                                            Withdrawals
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('handyman')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                                activeTab === 'handyman'
                                                    ? 'bg-indigo-500 text-white shadow-md'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <Wrench className="h-4 w-4" />
                                            Handyman
                                        </button>
                                    </div>

                                    {/* Services Tab */}
                                    {activeTab === 'services' && (
                                    <section>
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-2xl font-semibold">Services</h2>
                                            <div className="flex gap-2">
                                                <Button onClick={openAddService}>Add Service</Button>
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            const updated = await dispatch(approveServicesByProvider(id)).unwrap();
                                                            if (updated > 0) {
                                                                await dispatch(fetchProviderServices(id));
                                                            }
                                                        } catch (e) {
                                                            console.error('Approve services for provider failed', e);
                                                        }
                                                    }}
                                                >
                                                    Approve All Services
                                                </Button>
                                            </div>
                                        </div>
                                        {services.length === 0 ? (
                                            <div className="text-gray-500">No services found for this provider.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {services.map((s) => (
                                                    <div key={s.id} className="bg-white rounded shadow p-4">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="font-semibold">{s.serviceName || s.name || 'Service'}</div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    aria-label="Edit service"
                                                                    title="Edit service"
                                                                    onClick={() => openEditService(s.id)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                                                    aria-label="Delete service"
                                                                    title="Delete service (opens confirmation)"
                                                                    onClick={() => setDeleteId(s.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="h-36 w-full bg-gray-100 mb-3 overflow-hidden rounded">
                                                            {(() => {
                                                                const primary = s.images?.[0]
                                                                    ?? (Array.isArray(s.serviceImage) ? s.serviceImage[0] : s.serviceImage ?? undefined)
                                                                    ?? s.image
                                                                    ?? s.image_url
                                                                    ?? undefined;
                                                                return primary ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={primary} alt={s.serviceName || s.name || 'Service'} className="h-36 w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-36 w-full bg-gray-200" />
                                                                );
                                                            })()}
                                                        </div>
                                                        {s.description && (
                                                            <div className="text-sm text-gray-600 mt-1 line-clamp-2">{s.description}</div>
                                                        )}
                                                        {s.images && s.images.length > 1 && (
                                                            <div className="flex gap-2 mt-3">
                                                                {s.images.slice(1, 5).map((img, idx) => (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img key={idx} src={img} alt={`thumb-${idx}`} className="h-10 w-10 rounded object-cover border" />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                    )}

                                    {/* Documents Tab */}
                                    {activeTab === 'documents' && (
                                    <section>
                                        <h2 className="text-2xl font-semibold mb-4">Uploaded Documents</h2>
                                        {providerDocuments.length === 0 ? (
                                            <div className="bg-white rounded-lg shadow p-6 text-gray-500">No documents uploaded.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {providerDocuments.map((doc) => (
                                                    <div key={doc.id} className="bg-white rounded-lg shadow p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-5 w-5 text-indigo-600" />
                                                                <span className="font-semibold">{doc.documentName || 'Document'}</span>
                                                            </div>
                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                                doc.isVerify 
                                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                                    : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {doc.isVerify ? 'Verified' : 'Pending'}
                                                            </span>
                                                        </div>
                                                        {doc.documentImage && (
                                                            <div className="mt-3 relative">
                                                                <img 
                                                                    src={doc.documentImage} 
                                                                    alt={doc.documentName || 'Document'}
                                                                    className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                                                                    onClick={() => setSelectedDocument(doc.documentImage || null)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                    )}

                                    {/* Withdrawals Tab */}
                                    {activeTab === 'withdrawals' && (
                                    <section>
                                        <h2 className="text-2xl font-semibold mb-4">Withdrawal History</h2>
                                        {providerWithdrawals.length === 0 ? (
                                            <div className="bg-white rounded-lg shadow p-6 text-gray-500">No withdrawal requests.</div>
                                        ) : (
                                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50 border-b">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Note</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {providerWithdrawals.map((withdrawal) => (
                                                            <tr key={withdrawal.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                                    {withdrawal.createdDate ? new Date(withdrawal.createdDate).toLocaleDateString() : '—'}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                                                    ETB {typeof withdrawal.amount === 'string' ? parseFloat(withdrawal.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : withdrawal.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                                        withdrawal.paymentStatus === 'approved' || withdrawal.paymentStatus === 'completed'
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : withdrawal.paymentStatus === 'rejected'
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                        {withdrawal.paymentStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-600">{withdrawal.note || '—'}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                                    {withdrawal.paymentDate ? new Date(withdrawal.paymentDate).toLocaleDateString() : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>
                                    )}

                                    {/* Handyman Tab */}
                                    {activeTab === 'handyman' && (
                                    <section>
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-2xl font-semibold">Handyman</h2>
                                        </div>
                                        {providerHandymen.length === 0 ? (
                                            <div className="bg-white rounded-lg shadow p-6 text-gray-500">No handymen assigned to this provider.</div>
                                        ) : (
                                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50 border-b">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {providerHandymen.map((handyman) => (
                                                            <tr key={handyman.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        {handyman.profileImage ? (
                                                                            <img src={handyman.profileImage} alt={`${handyman.firstName} ${handyman.lastName}`} className="w-8 h-8 rounded-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                                                <Wrench className="h-4 w-4 text-indigo-600" />
                                                                            </div>
                                                                        )}
                                                                        <span className="text-sm font-medium text-gray-900">
                                                                            {[handyman.firstName, handyman.lastName].filter(Boolean).join(' ') || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-600">{handyman.email || '—'}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                                    {handyman.countryCode && handyman.phoneNumber 
                                                                        ? `${handyman.countryCode} ${handyman.phoneNumber}`
                                                                        : handyman.phoneNumber || '—'}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-600">{handyman.category || '—'}</td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                                        handyman.active && handyman.isActive
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                        {handyman.active && handyman.isActive ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => {
                                                                                setEditingHandyman(handyman);
                                                                                setHandymanForm({
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
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                                                            onClick={() => setDeletingHandymanId(handyman.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>
                                    )}
                                </div>
                            </div>
                            {/* Edit dialog */}
                            <Dialog open={open} onClose={() => setOpen(false)}>
                                <DialogHeader>
                                    <DialogTitle>Edit Provider</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="name">Name</Label>
                                        <Input id="name" name="name" value={form.name} onChange={onChange} placeholder="Provider name" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" name="phone" value={form.phone} onChange={onChange} placeholder="Phone number" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="address">Address</Label>
                                        <Input id="address" name="address" value={form.address} onChange={onChange} placeholder="Street, City" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="banner">Banner URL</Label>
                                        <Input id="banner" name="banner" value={form.banner} onChange={onChange} placeholder="https://..." />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="avatar">Profile Image URL</Label>
                                        <Input id="avatar" name="avatar" value={form.avatar} onChange={onChange} placeholder="https://..." />
                                    </div>
                                    <DialogDescription>
                                        Tip: You can paste an image URL now. File uploads can be added next (Supabase Storage or direct URL).
                                    </DialogDescription>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                                    <Button onClick={onSave}>Save changes</Button>
                                </DialogFooter>
                            </Dialog>

                            {/* Add Service dialog */}
                            <Dialog open={addOpen} onClose={() => dispatch(closeAddServiceModal())}>
                                <DialogHeader>
                                    <DialogTitle>Add Service</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-name">Service Name</Label>
                                        <Input id="svc-name" name="name" value={serviceForm.name} onChange={onServiceChange} placeholder="e.g. Home Cleaning" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-address">Address (optional)</Label>
                                        <Input id="svc-address" name="address" value={serviceForm.address} onChange={onServiceChange} placeholder="Street, City" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-image">Images</Label>
                                        <input id="svc-image" aria-label="Upload service images" type="file" accept="image/*" multiple onChange={(e) => onAddImageFiles(e.target.files)} className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
                                        {addImages.length > 0 && (
                                            <div className="mt-2 text-xs text-gray-600 break-all">{addImages.length} image(s) selected</div>
                                        )}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-video">Video (optional)</Label>
                                        <input id="svc-video" aria-label="Upload service video" type="file" accept="video/*" onChange={(e) => onAddVideoFile(e.target.files)} className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
                                        {addVideo && <div className="mt-2 text-xs text-gray-600 break-all">Selected: {addVideo.name}</div>}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-category-name">Category</Label>
                                            <Input id="svc-category-name" name="categoryName" value={serviceForm.categoryName} onChange={onServiceChange} placeholder="e.g. Cleaning" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-subcategory-name">Subcategory</Label>
                                            <Input id="svc-subcategory-name" name="subCategoryName" value={serviceForm.subCategoryName} onChange={onServiceChange} placeholder="e.g. Home" />
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-price">Price</Label>
                                        <Input id="svc-price" name="price" value={serviceForm.price} onChange={onServiceChange} placeholder="$100" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-discount">Discount (optional)</Label>
                                        <Input id="svc-discount" name="discount" value={serviceForm.discount} onChange={onServiceChange} placeholder="e.g. 10%" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-desc">Description</Label>
                                        <textarea id="svc-desc" name="description" value={serviceForm.description} onChange={onServiceChange} className="min-h-[90px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Short description" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-duration">Duration</Label>
                                            <Input id="svc-duration" name="duration" value={serviceForm.duration} onChange={onServiceChange} placeholder="e.g. 2h" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-type">Type</Label>
                                            <Input id="svc-type" name="type" value={serviceForm.type} onChange={onServiceChange} placeholder="e.g. Standard" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-mode">Location Mode</Label>
                                            <select id="svc-mode" aria-label="Service location mode" name="serviceLocationMode" value={serviceForm.serviceLocationMode} onChange={onServiceChange} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                <option value="onsite">Onsite</option>
                                                <option value="offsite">Offsite</option>
                                                <option value="remote">Remote</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" name="prePayment" checked={serviceForm.prePayment} onChange={onServiceChange} className="h-4 w-4" />
                                            Pre-payment
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" name="feature" checked={serviceForm.feature} onChange={onServiceChange} className="h-4 w-4" />
                                            Featured
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" name="status" checked={serviceForm.status} onChange={onServiceChange} className="h-4 w-4" />
                                            Status
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" name="active" checked={serviceForm.active} onChange={onServiceChange} className="h-4 w-4" />
                                            Active
                                        </label>
                                    </div>
                                    {addError && <div className="text-sm text-red-600">{addError}</div>}
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => dispatch(closeAddServiceModal())}>Cancel</Button>
                                    <Button onClick={onCreateService} disabled={addLoading}>{addLoading ? 'Creating…' : 'Create'}</Button>
                                </DialogFooter>
                            </Dialog>

                            {/* Global Edit Service modal */}
                            <EditServiceModal />

                            {/* Delete confirmation dialog */}
                            <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                                <DialogHeader>
                                    <DialogTitle>Delete service?</DialogTitle>
                                    <DialogDescription>
                                        This action cannot be undone. If there are existing bookings, the service will be archived instead of deleted.
                                    </DialogDescription>
                                </DialogHeader>
                                {deleteError && (
                                    <div className="text-sm text-red-600">{String(deleteError)}</div>
                                )}
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={deleteLoading}>Cancel</Button>
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-300 hover:bg-red-50"
                                        onClick={confirmDelete}
                                        disabled={deleteLoading}
                                    >
                                        {deleteLoading ? 'Deleting…' : 'Delete'}
                                    </Button>
                                </DialogFooter>
                            </Dialog>

                            {/* Document Image Modal */}
                            {selectedDocument && (
                                <Dialog open={!!selectedDocument} onClose={() => setSelectedDocument(null)}>
                                    <DialogHeader>
                                        <DialogTitle>Document Image</DialogTitle>
                                    </DialogHeader>
                                    <div className="p-4">
                                        <img src={selectedDocument} alt="Document" className="w-full h-auto rounded-lg" />
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={() => setSelectedDocument(null)}>Close</Button>
                                    </DialogFooter>
                                </Dialog>
                            )}

                            {/* Edit Handyman Modal */}
                            {editingHandyman && (
                                <Dialog open={!!editingHandyman} onClose={() => setEditingHandyman(null)}>
                                    <DialogHeader>
                                        <DialogTitle>Edit Handyman</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 p-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="hm-firstName">First Name</Label>
                                                <Input 
                                                    id="hm-firstName" 
                                                    value={handymanForm.firstName} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, firstName: e.target.value })} 
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="hm-lastName">Last Name</Label>
                                                <Input 
                                                    id="hm-lastName" 
                                                    value={handymanForm.lastName} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, lastName: e.target.value })} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="hm-email">Email</Label>
                                            <Input 
                                                id="hm-email" 
                                                type="email"
                                                value={handymanForm.email} 
                                                onChange={(e) => setHandymanForm({ ...handymanForm, email: e.target.value })} 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="hm-countryCode">Country Code</Label>
                                                <Input 
                                                    id="hm-countryCode" 
                                                    value={handymanForm.countryCode} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, countryCode: e.target.value })} 
                                                    placeholder="+251"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="hm-phoneNumber">Phone Number</Label>
                                                <Input 
                                                    id="hm-phoneNumber" 
                                                    value={handymanForm.phoneNumber} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, phoneNumber: e.target.value })} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="hm-userName">Username</Label>
                                            <Input 
                                                id="hm-userName" 
                                                value={handymanForm.userName} 
                                                onChange={(e) => setHandymanForm({ ...handymanForm, userName: e.target.value })} 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="hm-category">Category</Label>
                                                <Input 
                                                    id="hm-category" 
                                                    value={handymanForm.category} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, category: e.target.value })} 
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="hm-subCategory">Subcategory</Label>
                                                <Input 
                                                    id="hm-subCategory" 
                                                    value={handymanForm.subCategory} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, subCategory: e.target.value })} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="hm-address">Address</Label>
                                            <Input 
                                                id="hm-address" 
                                                value={handymanForm.address} 
                                                onChange={(e) => setHandymanForm({ ...handymanForm, address: e.target.value })} 
                                            />
                                        </div>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={handymanForm.active} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, active: e.target.checked })} 
                                                />
                                                <span className="text-sm">Active</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={handymanForm.isActive} 
                                                    onChange={(e) => setHandymanForm({ ...handymanForm, isActive: e.target.checked })} 
                                                />
                                                <span className="text-sm">Is Active</span>
                                            </label>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setEditingHandyman(null)}>Cancel</Button>
                                        <Button onClick={async () => {
                                            try {
                                                await dispatch(updateHandyman({
                                                    id: editingHandyman.id,
                                                    ...handymanForm,
                                                })).unwrap();
                                                await dispatch(fetchHandymen());
                                                setEditingHandyman(null);
                                            } catch (e) {
                                                console.error('Update handyman failed', e);
                                            }
                                        }}>Save Changes</Button>
                                    </DialogFooter>
                                </Dialog>
                            )}

                            {/* Delete Handyman Confirmation */}
                            <Dialog open={!!deletingHandymanId} onClose={() => setDeletingHandymanId(null)}>
                                <DialogHeader>
                                    <DialogTitle>Delete Handyman?</DialogTitle>
                                    <DialogDescription>
                                        This action cannot be undone. This will permanently delete the handyman.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setDeletingHandymanId(null)}>Cancel</Button>
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-300 hover:bg-red-50"
                                        onClick={async () => {
                                            if (!deletingHandymanId) return;
                                            try {
                                                await dispatch(deleteHandyman(deletingHandymanId)).unwrap();
                                                await dispatch(fetchHandymen());
                                                setDeletingHandymanId(null);
                                            } catch (e) {
                                                console.error('Delete handyman failed', e);
                                            }
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </DialogFooter>
                            </Dialog>
                        </>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
