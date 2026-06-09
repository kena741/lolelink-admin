
'use client';
import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProviderById, fetchProviderServices, clearSelected, clearServices, updateProvider } from '@/features/provider/providerSlice';
import { addService, openAddServiceModal, closeAddServiceModal } from '@/features/service/addServiceSlice';
import { mapServiceRowToEditServiceModel, openEditModal } from '@/features/service/editServiceSlice';
import EditServiceModal from './EditServiceModal';
import { deleteService as deleteServiceThunk } from '@/features/service/deleteServiceSlice';
import { approveServicesByProvider } from '@/features/service/approveServicesSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import { fetchPayoutRequests } from '@/features/payout/payoutSlice';
import { getDisplayImageUrl, resolveProfileImageUrl } from '@/lib/media-url';
import {
    filterServiceDiscountInput,
    getServiceDiscountError,
    validateServiceDiscount,
} from '@/lib/service-discount';
import { fetchHandymen, updateHandyman, deleteHandyman, type Handyman } from '@/features/handyman/handymanSlice';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchSubCategories } from '@/features/subcategory/subcategorySlice';
import { Pencil, Trash2, FileText, DollarSign, Wrench, Clock, Briefcase, History, CreditCard } from 'lucide-react';
import { ActivationPaymentModal } from '@/components/ActivationPaymentModal';
import { fetchSettings } from '@/features/settings/settingsSlice';
import { Button } from '@/components/ui/button';
import type { RootState } from '@/store/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProviderAddressPicker } from '@/components/ProviderAddressPicker';
import { buildProviderUpdatesFromEditForm } from '@/lib/build-provider-updates';
import { parseProviderLocation } from '@/lib/provider-location';
import Image from 'next/image';

export default function ProviderDetailPage() {
    const params = useParams();
    const id = (params?.id as string) || '';

    const dispatch = useAppDispatch();
    const { selected: provider, selectedLoading, error, services, servicesLoading } = useAppSelector((s) => s.provider);
    const { loading: deleteLoading, error: deleteError } = useAppSelector((s: RootState) => s.deleteService ?? { loading: false, error: null, success: false });

    const { documents } = useAppSelector((state) => state.verifyDocuments);
    const { requests: payoutRequests } = useAppSelector((state) => state.payout);
    const { handymen } = useAppSelector((state) => state.handyman);
    const { categories } = useAppSelector((state) => state.category);
    const { subCategories } = useAppSelector((state) => state.subcategory);
    
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [editingHandyman, setEditingHandyman] = useState<Handyman | null>(null);
    const [handymanForm, setHandymanForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        userName: '',
        userType: '',
        categoryId: '',
        subCategoryId: '',
        address: '',
        countryCode: '',
        active: true,
        isActive: true,
    });
    const [deletingHandymanId, setDeletingHandymanId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'services' | 'documents' | 'withdrawals' | 'handyman'>('services');
    const [activationModalOpen, setActivationModalOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        dispatch(fetchProviderById(id));
        dispatch(fetchProviderServices(id));
        dispatch(fetchVerifyDocuments());
        dispatch(fetchPayoutRequests());
        dispatch(fetchHandymen());
        dispatch(fetchCategories());
        dispatch(fetchSubCategories());
        dispatch(fetchSettings());
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
    const profileSrc = resolveProfileImageUrl(provider) ?? undefined;
    const displayName = (() => {
        const first = provider?.firstName ?? provider?.first_name;
        const last = provider?.lastName ?? provider?.last_name;
        const full = [first, last].filter(Boolean).join(' ');
        return full || provider?.name || '—';
    })();

    // Edit modal state
    const [open, setOpen] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveLoading, setSaveLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        latitude: null as number | null,
        longitude: null as number | null,
        banner: '',
        avatar: '',
    });
    useEffect(() => {
        if (!provider) return;
        const coords = parseProviderLocation(provider.location ?? null);
        setForm({
            name: (provider.name || `${provider.firstName ?? provider.first_name ?? ''} ${provider.lastName ?? provider.last_name ?? ''}`.trim()).trim(),
            phone: provider.phoneNumber || provider.phone || '',
            address: provider.address || '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            banner: provider.banner || '',
            avatar: resolveProfileImageUrl(provider) || '',
        });
    }, [provider]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const onSave = async () => {
        if (!provider || !id) return;
        setSaveError(null);
        setSaveLoading(true);
        try {
            const updates = buildProviderUpdatesFromEditForm(form);
            await dispatch(
                updateProvider({
                    id: provider.id,
                    updates: updates as Partial<import('@/features/provider/providerSlice').Provider>,
                })
            ).unwrap();
            await dispatch(fetchProviderById(id));
            setOpen(false);
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save provider');
        } finally {
            setSaveLoading(false);
        }
    };

    // Service add/edit modal state
    const { open: addOpen, loading: addLoading, error: addError } = useAppSelector((s) => s.addServiceModal);
    const [serviceForm, setServiceForm] = useState({
        name: '',
        description: '',
        imageUrl: '',
        price: '',
        address: '',
        categoryId: '',
        subCategoryId: '',
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
        name: '', description: '', imageUrl: '', price: '', address: '', categoryId: '', subCategoryId: '', discount: '', duration: '', prePayment: false, feature: false, status: true, active: true, type: '', serviceLocationMode: 'onsite'
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
        const mapped = mapServiceRowToEditServiceModel(
            svc as unknown as Record<string, unknown>,
            id
        );
        dispatch(openEditModal(mapped));
    };
    const onServiceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            setServiceForm(f => ({ ...f, [name]: checked }));
            return;
        }
        if (name === 'discount') {
            setServiceForm((f) => ({
                ...f,
                discount: filterServiceDiscountInput(value, f.discount),
            }));
            return;
        }
        setServiceForm(f => ({ ...f, [name]: value }));
    };

    const serviceDiscountError = getServiceDiscountError(serviceForm.discount);
    const categoryNameById = (categoryId: string) =>
        categories.find((cat) => cat.id === categoryId)?.categoryName ?? '—';

    const filteredSubCategoriesForService = serviceForm.categoryId
        ? subCategories.filter((sub) => sub.categoryId === serviceForm.categoryId)
        : [];

    const filteredSubCategoriesForHandyman = handymanForm.categoryId
        ? subCategories.filter((sub) => sub.categoryId === handymanForm.categoryId)
        : [];

    const selectClassName =
        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

    const onCreateService = async () => {
        if (!id) return;
        if (!serviceForm.categoryId || !serviceForm.subCategoryId) {
            alert('Please select a category and subcategory');
            return;
        }
        const discountResult = validateServiceDiscount(serviceForm.discount);
        if (!discountResult.ok) {
            alert(discountResult.error);
            return;
        }

        const selectedCategory = categories.find((cat) => cat.id === serviceForm.categoryId);
        const selectedSubCategory = subCategories.find((sub) => sub.id === serviceForm.subCategoryId);
        const service = {
            serviceName: (serviceForm.name ?? '').toString().trim(),
            description: (serviceForm.description ?? '').toString().trim(),
            address: (serviceForm.address ?? '').toString().trim(),
            categoryId: serviceForm.categoryId,
            categoryModel: {
                id: serviceForm.categoryId,
                name: selectedCategory?.categoryName ?? '',
            },
            subCategoryId: serviceForm.subCategoryId,
            subCategoryModel: {
                id: serviceForm.subCategoryId,
                name: selectedSubCategory?.subCategoryName ?? '',
                categoryId: serviceForm.categoryId,
            },
            price: (serviceForm.price ?? '').toString().trim(),
            discount: discountResult.value,
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
                                            <div className="flex items-center gap-3">
                                                <h1 className="text-3xl font-bold">{displayName}</h1>
                                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                    provider.activation_paid
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {provider.activation_paid ? 'Activation Paid' : 'Activation Fee Pending'}
                                                </span>
                                                {!provider.activation_paid && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setActivationModalOpen(true)}
                                                        className="gap-1.5"
                                                    >
                                                        <CreditCard className="h-4 w-4" />
                                                        Pay Activation Fee
                                                    </Button>
                                                )}
                                            </div>
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
                                            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                                    <Briefcase className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                                <p className="text-lg font-semibold text-foreground">No services found</p>
                                                <p className="mt-1 text-sm text-muted-foreground">Add a service to get started.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                {services.map((s) => {
                                                    const serviceTitle = s.serviceName || s.name || 'Service';
                                                    const primaryImage = s.images?.[0]
                                                        ?? (Array.isArray(s.serviceImage) ? s.serviceImage[0] : s.serviceImage ?? undefined)
                                                        ?? s.image
                                                        ?? s.image_url
                                                        ?? undefined;
                                                    const isActive = s.status !== false;

                                                    return (
                                                        <div
                                                            key={s.id}
                                                            className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:bg-muted/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                                                        >
                                                            <div className="h-40 w-full overflow-hidden bg-muted">
                                                                {primaryImage ? (
                                                                    <Image
                                                                        src={primaryImage}
                                                                        alt={serviceTitle}
                                                                        width={640}
                                                                        height={160}
                                                                        loading="lazy"
                                                                        className="h-40 w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-full items-center justify-center">
                                                                        <Briefcase className="h-10 w-10 text-muted-foreground/60" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="p-5">
                                                                <div className="mb-3 flex items-start justify-between gap-3">
                                                                    <div className="min-w-0 flex-1">
                                                                        <h3 className="truncate text-lg font-bold text-foreground">
                                                                            {serviceTitle}
                                                                        </h3>
                                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                                                                                isActive
                                                                                    ? 'bg-primary/10 text-primary'
                                                                                    : 'bg-muted text-muted-foreground'
                                                                            }`}>
                                                                                {isActive ? 'Active' : 'Inactive'}
                                                                            </span>
                                                                            {s.feature ? (
                                                                                <span className="inline-flex items-center rounded-md bg-chart-4/15 px-2.5 py-1 text-xs font-semibold text-chart-4">
                                                                                    Featured
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex shrink-0 gap-1">
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                                                            aria-label="Edit service"
                                                                            title="Edit service"
                                                                            onClick={() => openEditService(s.id)}
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                            aria-label="Delete service"
                                                                            title="Delete service"
                                                                            onClick={() => setDeleteId(s.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                {s.description ? (
                                                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                                                        {s.description}
                                                                    </p>
                                                                ) : null}
                                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {s.price ? (
                                                                            <span className="text-base font-bold tabular-nums text-foreground">
                                                                                {s.price}
                                                                            </span>
                                                                        ) : null}
                                                                        {s.discount ? (
                                                                            <span className="inline-flex items-center rounded-md bg-chart-3/15 px-2 py-0.5 text-xs font-semibold text-chart-3">
                                                                                {s.discount}% off
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    {s.duration ? (
                                                                        <span className="text-xs font-medium text-muted-foreground">
                                                                            {s.duration}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                {s.images && s.images.length > 1 ? (
                                                                    <div className="mt-3 flex gap-2">
                                                                        {s.images.slice(1, 5).map((img, idx) => (
                                                                            <Image
                                                                                key={idx}
                                                                                src={img}
                                                                                alt={`${serviceTitle} ${idx + 2}`}
                                                                                width={40}
                                                                                height={40}
                                                                                loading="lazy"
                                                                                className="h-10 w-10 rounded-md object-cover shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
                                                        {getDisplayImageUrl(doc.documentImage) && (
                                                            <div className="mt-3 relative">
                                                                <Image
                                                                    src={getDisplayImageUrl(doc.documentImage)!}
                                                                    alt={doc.documentName || 'Document'}
                                                                    width={640}
                                                                    height={128}
                                                                    loading="lazy"
                                                                    className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                                                                    onClick={() => setSelectedDocument(getDisplayImageUrl(doc.documentImage))}
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
                                                                        {getDisplayImageUrl(handyman.profileImage) ? (
                                                                            <Image src={getDisplayImageUrl(handyman.profileImage)!} alt={`${handyman.firstName} ${handyman.lastName}`} width={32} height={32} loading="lazy" className="w-8 h-8 rounded-full object-cover" />
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
                                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                                    {handyman.categoryId
                                                                        ? categoryNameById(handyman.categoryId)
                                                                        : handyman.category || '—'}
                                                                </td>
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
                                                                                const resolvedCategoryId =
                                                                                    handyman.categoryId ||
                                                                                    categories.find(
                                                                                        (cat) =>
                                                                                            cat.categoryName === handyman.category
                                                                                    )?.id ||
                                                                                    '';
                                                                                const resolvedSubCategoryId =
                                                                                    handyman.subCategoryId ||
                                                                                    subCategories.find(
                                                                                        (sub) =>
                                                                                            sub.subCategoryName === handyman.subCategory &&
                                                                                            (!resolvedCategoryId ||
                                                                                                sub.categoryId === resolvedCategoryId)
                                                                                    )?.id ||
                                                                                    '';
                                                                                setHandymanForm({
                                                                                    firstName: handyman.firstName || '',
                                                                                    lastName: handyman.lastName || '',
                                                                                    email: handyman.email || '',
                                                                                    phoneNumber: handyman.phoneNumber || '',
                                                                                    userName: handyman.userName || '',
                                                                                    userType: handyman.userType || '',
                                                                                    categoryId: resolvedCategoryId,
                                                                                    subCategoryId: resolvedSubCategoryId,
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
                            <Dialog open={open} onClose={() => { setOpen(false); setSaveError(null); }}>
                                <DialogHeader>
                                    <DialogTitle>Edit Provider</DialogTitle>
                                </DialogHeader>
                                {saveError && (
                                    <p className="mb-2 text-sm text-destructive">{saveError}</p>
                                )}
                                <div className="grid gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="name">Name</Label>
                                        <Input id="name" name="name" value={form.name} onChange={onChange} placeholder="Provider name" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" name="phone" value={form.phone} onChange={onChange} placeholder="Phone number" />
                                    </div>
                                    <ProviderAddressPicker
                                        id="address"
                                        value={{
                                            address: form.address,
                                            latitude: form.latitude,
                                            longitude: form.longitude,
                                        }}
                                        onChange={(next) =>
                                            setForm((f) => ({
                                                ...f,
                                                address: next.address,
                                                latitude: next.latitude,
                                                longitude: next.longitude,
                                            }))
                                        }
                                    />
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
                                    <Button variant="ghost" onClick={() => { setOpen(false); setSaveError(null); }} disabled={saveLoading}>Cancel</Button>
                                    <Button onClick={onSave} disabled={saveLoading}>{saveLoading ? 'Saving…' : 'Save changes'}</Button>
                                </DialogFooter>
                            </Dialog>

                            {/* Add Service dialog */}
                            <Dialog
                                open={addOpen}
                                onClose={() => dispatch(closeAddServiceModal())}
                                className="flex h-[min(440px,65vh)] max-w-2xl flex-col overflow-hidden p-0"
                            >
                                <DialogHeader className="mb-0 shrink-0 border-b border-subtle px-6 py-4">
                                    <DialogTitle>Add Service</DialogTitle>
                                </DialogHeader>
                                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
                                            <Label htmlFor="svc-category-id">Category</Label>
                                            <select
                                                id="svc-category-id"
                                                name="categoryId"
                                                value={serviceForm.categoryId}
                                                onChange={(e) => {
                                                    const nextCategoryId = e.target.value;
                                                    setServiceForm((f) => ({
                                                        ...f,
                                                        categoryId: nextCategoryId,
                                                        subCategoryId: '',
                                                    }));
                                                }}
                                                className={selectClassName}
                                            >
                                                <option value="">Select a category</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.categoryName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="svc-subcategory-id">Subcategory</Label>
                                            <select
                                                id="svc-subcategory-id"
                                                name="subCategoryId"
                                                value={serviceForm.subCategoryId}
                                                onChange={onServiceChange}
                                                disabled={!serviceForm.categoryId}
                                                className={selectClassName}
                                            >
                                                <option value="">
                                                    {serviceForm.categoryId ? 'Select a subcategory' : 'Select a category first'}
                                                </option>
                                                {filteredSubCategoriesForService.map((sub) => (
                                                    <option key={sub.id} value={sub.id}>
                                                        {sub.subCategoryName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-price">Price</Label>
                                        <Input id="svc-price" name="price" value={serviceForm.price} onChange={onServiceChange} placeholder="$100" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="svc-discount">Discount (%) (optional)</Label>
                                        <Input
                                            id="svc-discount"
                                            name="discount"
                                            type="text"
                                            inputMode="decimal"
                                            value={serviceForm.discount}
                                            onChange={onServiceChange}
                                            placeholder="e.g. 10"
                                            aria-invalid={serviceDiscountError ? true : undefined}
                                            className={serviceDiscountError ? 'border-red-500 focus:ring-red-200' : undefined}
                                        />
                                        {serviceDiscountError ? (
                                            <p className="text-xs text-red-600">{serviceDiscountError}</p>
                                        ) : (
                                            <p className="text-xs text-gray-500">Enter a percentage from 0 to 99.99.</p>
                                        )}
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
                                </div>
                                <DialogFooter className="mt-0 shrink-0 border-t border-subtle px-6 py-4">
                                    <Button variant="ghost" onClick={() => dispatch(closeAddServiceModal())}>Cancel</Button>
                                    <Button onClick={onCreateService} disabled={addLoading || Boolean(serviceDiscountError)}>
                                        {addLoading ? 'Creating…' : 'Create'}
                                    </Button>
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
                                        <Image src={selectedDocument} alt="Document" width={1200} height={800} className="w-full h-auto rounded-lg" />
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
                                                <Label htmlFor="hm-category-id">Category</Label>
                                                <select
                                                    id="hm-category-id"
                                                    value={handymanForm.categoryId}
                                                    onChange={(e) => {
                                                        const nextCategoryId = e.target.value;
                                                        setHandymanForm({
                                                            ...handymanForm,
                                                            categoryId: nextCategoryId,
                                                            subCategoryId: '',
                                                        });
                                                    }}
                                                    className={selectClassName}
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
                                                <Label htmlFor="hm-subcategory-id">Subcategory</Label>
                                                <select
                                                    id="hm-subcategory-id"
                                                    value={handymanForm.subCategoryId}
                                                    onChange={(e) =>
                                                        setHandymanForm({
                                                            ...handymanForm,
                                                            subCategoryId: e.target.value,
                                                        })
                                                    }
                                                    disabled={!handymanForm.categoryId}
                                                    className={selectClassName}
                                                >
                                                    <option value="">
                                                        {handymanForm.categoryId ? 'Select a subcategory' : 'Select a category first'}
                                                    </option>
                                                    {filteredSubCategoriesForHandyman.map((sub) => (
                                                        <option key={sub.id} value={sub.id}>
                                                            {sub.subCategoryName}
                                                        </option>
                                                    ))}
                                                </select>
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
                                            if (!handymanForm.categoryId || !handymanForm.subCategoryId) {
                                                alert('Please select a category and subcategory');
                                                return;
                                            }
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
                            {provider && (
                                <ActivationPaymentModal
                                    open={activationModalOpen}
                                    onClose={() => setActivationModalOpen(false)}
                                    providerId={provider.id}
                                    providerName={displayName}
                                />
                            )}
                        </>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
