"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { fetchServices, approveFeatureRequestById, rejectFeatureRequestById, unfeatureServiceById, resetApproveState } from '@/features/service/approveServicesSlice';
import type { RootState } from '@/store/store';
import ServiceCard from '@/components/ServiceCard';
import type { ServiceModel } from '@/features/service/editServiceSlice';
import { openEditModal } from '@/features/service/editServiceSlice';
import EditServiceModal from '@/app/admin/providers/[id]/EditServiceModal';

export default function ApproveServicesPage() {
    const dispatch = useAppDispatch();
    const { services, loading, error, updatedCount } = useAppSelector((s: RootState) => s.approveServices ?? { services: [], loading: false, error: null, updatedCount: 0 });

    // We'll treat fetched rows as the shared ServiceModel when rendering
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'services' | 'featured'>('services');
    const [servicesSubTab, setServicesSubTab] = useState<'pending' | 'approved'>('pending');
    const [featuredSubTab, setFeaturedSubTab] = useState<'pending' | 'existing'>('pending');

    const normalizedServices = useMemo(() => (services || []).map(s => s as ServiceModel), [services]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return normalizedServices;
        return normalizedServices.filter(s => {
            const name = (s.serviceName ?? '').toString().toLowerCase();
            const desc = (s.description ?? '').toString().toLowerCase();
            return name.includes(q) || desc.includes(q) || (s.id ?? '').toString().toLowerCase().includes(q);
        });
    }, [normalizedServices, query]);

    const approvedServices = filtered.filter(s => !!s.approved);
    const notApprovedServices = filtered.filter(s => !s.approved);
    const featureRequestedServices = filtered.filter(s => String(s.feature_requested_status ?? '').toLowerCase() === 'pending');
    const featuredServices = filtered.filter(s => s.feature === true);
    const pendingServicesCount = notApprovedServices.length;
    const approvedServicesCount = approvedServices.length;
    const pendingFeaturedCount = featureRequestedServices.length;
    const featuredCount = featuredServices.length;

    useEffect(() => {
        dispatch(fetchServices());
        return () => {
            dispatch(resetApproveState());
        };
    }, [dispatch]);

    // Note: approval is now provider-scoped. Use the provider detail page to approve a provider's services.

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground drop-shadow-lg mb-2">
                                        Approve Services
                                    </h1>
                                    <p className="text-primary-foreground/90 text-base font-medium">
                                        {pendingServicesCount > 0
                                            ? `${pendingServicesCount} awaiting approval`
                                            : 'No pending approvals'} · {pendingFeaturedCount > 0
                                            ? `${pendingFeaturedCount} featured pending`
                                            : 'No pending featured'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        onClick={() => dispatch(fetchServices())} 
                                        className="bg-card/15 backdrop-blur-md text-primary-foreground border-primary-foreground/20 hover:bg-card/25"
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Search and Tabs */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:w-96">
                                <input 
                                    aria-label="Search services" 
                                    placeholder="Search by name, description, or id" 
                                    value={query} 
                                    onChange={(e) => setQuery(e.target.value)} 
                                    className="w-full rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50 shadow-lg transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-xl p-1 border border-white/20 shadow-lg">
                                <button
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === 'services'
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                            : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                    onClick={() => setActiveTab('services')}
                                >
                                    Services{pendingServicesCount > 0 ? ` (${pendingServicesCount})` : ''}
                                </button>
                                <button
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === 'featured'
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                            : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                    onClick={() => setActiveTab('featured')}
                                >
                                    Featured posts{pendingFeaturedCount > 0 ? ` (${pendingFeaturedCount})` : ''}
                                </button>
                            </div>
                        </div>

                        {loading && (
                            <div className="p-8 text-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-4" />
                                <p className="text-gray-600">Loading services...</p>
                            </div>
                        )}
                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-600 mb-6">
                                {String(error)}
                            </div>
                        )}

                    {activeTab === 'services' && (
                        <div className="mb-6 flex flex-wrap items-center gap-3">
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    servicesSubTab === 'pending'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setServicesSubTab('pending')}
                            >
                                Pending{pendingServicesCount > 0 ? ` (${pendingServicesCount})` : ''}
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    servicesSubTab === 'approved'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setServicesSubTab('approved')}
                            >
                                Approved{approvedServicesCount > 0 ? ` (${approvedServicesCount})` : ''}
                            </button>
                        </div>
                    )}

                    {activeTab === 'services' && servicesSubTab === 'pending' && (
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-3">Awaiting Approval</h2>
                            {notApprovedServices.length === 0 ? (
                                <div className="text-sm text-gray-600">No services awaiting approval.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {notApprovedServices.map((srv) => {
                                        const onView = (svc: ServiceModel) => {
                                            // Map raw row to EditServiceSlice.ServiceModel shape similar to provider page
                                            const row = svc as unknown as Record<string, unknown>;
                                            const imgs = (row['images'] as string[] | undefined)
                                                ?? (Array.isArray(row['serviceImage']) ? (row['serviceImage'] as string[]) : (row['serviceImage'] ? [String(row['serviceImage'])] : undefined))
                                                ?? (row['image'] ? [String(row['image'])] : undefined);
                                            const maybeVideo = (row['video'] as string | null | undefined) ?? null;
                                            const mapped: ServiceModel = {
                                                id: String(row['id'] ?? svc.id),
                                                serviceName: String(row['serviceName'] ?? row['name'] ?? svc.serviceName ?? ''),
                                                description: (row['description'] as string) ?? svc.description ?? '',
                                                price: (row['price'] as unknown) as string | number ?? svc.price,
                                                duration: (row['duration'] as string | undefined) ?? svc.duration,
                                                serviceImage: imgs ?? (svc.serviceImage ?? []),
                                                discount: (row['discount'] as string | undefined) ?? svc.discount,
                                                type: (row['type'] as string | undefined) ?? svc.type,
                                                status: (row['status'] as boolean | undefined) ?? svc.status,
                                                prePayment: (row['prePayment'] as boolean | undefined) ?? svc.prePayment,
                                                feature: (row['feature'] as boolean | undefined) ?? svc.feature,
                                                serviceLocationMode: undefined,
                                                video: maybeVideo,
                                                approved: Boolean(row['approved'] ?? svc.approved),
                                            } as ServiceModel;
                                            dispatch(openEditModal(mapped));
                                        };
                                        return <ServiceCard key={srv.id ?? JSON.stringify(srv)} service={srv} onView={onView} />;
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'services' && servicesSubTab === 'approved' && (
                        <section>
                            <h2 className="text-xl font-semibold mb-3">Approved</h2>
                            {approvedServices.length === 0 ? (
                                <div className="text-sm text-gray-600">No approved services.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {approvedServices.map((srv) => {
                                        const onView = (svc: ServiceModel) => {
                                            // Map raw row to EditServiceSlice.ServiceModel shape similar to provider page
                                            const row = svc as unknown as Record<string, unknown>;
                                            const imgs = (row['images'] as string[] | undefined)
                                                ?? (Array.isArray(row['serviceImage']) ? (row['serviceImage'] as string[]) : (row['serviceImage'] ? [String(row['serviceImage'])] : undefined))
                                                ?? (row['image'] ? [String(row['image'])] : undefined);
                                            const maybeVideo = (row['video'] as string | null | undefined) ?? null;
                                            const mapped: ServiceModel = {
                                                id: String(row['id'] ?? svc.id),
                                                serviceName: String(row['serviceName'] ?? row['name'] ?? svc.serviceName ?? ''),
                                                description: (row['description'] as string) ?? svc.description ?? '',
                                                price: (row['price'] as unknown) as string | number ?? svc.price,
                                                duration: (row['duration'] as string | undefined) ?? svc.duration,
                                                serviceImage: imgs ?? (svc.serviceImage ?? []),
                                                discount: (row['discount'] as string | undefined) ?? svc.discount,
                                                type: (row['type'] as string | undefined) ?? svc.type,
                                                status: (row['status'] as boolean | undefined) ?? svc.status,
                                                prePayment: (row['prePayment'] as boolean | undefined) ?? svc.prePayment,
                                                feature: (row['feature'] as boolean | undefined) ?? svc.feature,
                                                serviceLocationMode: undefined,
                                                video: maybeVideo,
                                                approved: Boolean(row['approved'] ?? svc.approved),
                                            } as ServiceModel;
                                            dispatch(openEditModal(mapped));
                                        };
                                        return <ServiceCard key={srv.id ?? JSON.stringify(srv)} service={srv} onView={onView} />;
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'featured' && (
                        <div className="mb-6 flex flex-wrap items-center gap-3">
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    featuredSubTab === 'pending'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setFeaturedSubTab('pending')}
                            >
                                Pending{pendingFeaturedCount > 0 ? ` (${pendingFeaturedCount})` : ''}
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    featuredSubTab === 'existing'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setFeaturedSubTab('existing')}
                            >
                                Existing{featuredCount > 0 ? ` (${featuredCount})` : ''}
                            </button>
                        </div>
                    )}

                    {activeTab === 'featured' && featuredSubTab === 'pending' && (
                        <section>
                            <h2 className="sr-only">Pending featured requests</h2>
                            {featureRequestedServices.length === 0 ? (
                                <div className="text-sm text-gray-600">No featured requests pending.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {featureRequestedServices.map((srv) => {
                                        const onView = (svc: ServiceModel) => {
                                            const row = svc as unknown as Record<string, unknown>;
                                            const imgs = (row['images'] as string[] | undefined)
                                                ?? (Array.isArray(row['serviceImage']) ? (row['serviceImage'] as string[]) : (row['serviceImage'] ? [String(row['serviceImage'])] : undefined))
                                                ?? (row['image'] ? [String(row['image'])] : undefined);
                                            const maybeVideo = (row['video'] as string | null | undefined) ?? null;
                                            const mapped: ServiceModel = {
                                                id: String(row['id'] ?? svc.id),
                                                serviceName: String(row['serviceName'] ?? row['name'] ?? svc.serviceName ?? ''),
                                                description: (row['description'] as string) ?? svc.description ?? '',
                                                price: (row['price'] as unknown) as string | number ?? svc.price,
                                                duration: (row['duration'] as string | undefined) ?? svc.duration,
                                                serviceImage: imgs ?? (svc.serviceImage ?? []),
                                                discount: (row['discount'] as string | undefined) ?? svc.discount,
                                                type: (row['type'] as string | undefined) ?? svc.type,
                                                status: (row['status'] as boolean | undefined) ?? svc.status,
                                                prePayment: (row['prePayment'] as boolean | undefined) ?? svc.prePayment,
                                                feature: (row['feature'] as boolean | undefined) ?? svc.feature,
                                                serviceLocationMode: undefined,
                                                video: maybeVideo,
                                                approved: Boolean(row['approved'] ?? svc.approved),
                                            } as ServiceModel;
                                            dispatch(openEditModal(mapped));
                                        };

                                        const onApprove = async (serviceId: string) => {
                                            try {
                                                await dispatch(approveFeatureRequestById(serviceId)).unwrap();
                                                await dispatch(fetchServices());
                                            } catch (e) {
                                                console.error('Approve featured request failed', e);
                                            }
                                        };

                                        const onReject = async (serviceId: string) => {
                                            try {
                                                await dispatch(rejectFeatureRequestById(serviceId)).unwrap();
                                                await dispatch(fetchServices());
                                            } catch (e) {
                                                console.error('Reject featured request failed', e);
                                            }
                                        };

                                        return (
                                            <ServiceCard
                                                key={srv.id ?? JSON.stringify(srv)}
                                                service={srv}
                                                onView={onView}
                                                isActionLoading={loading}
                                                onApproveFeature={onApprove}
                                                onRejectFeature={onReject}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'featured' && featuredSubTab === 'existing' && (
                        <section>
                            <h2 className="sr-only">Existing featured posts</h2>
                            {featuredServices.length === 0 ? (
                                <div className="text-sm text-gray-600">No featured posts yet.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {featuredServices.map((srv) => {
                                        const onView = (svc: ServiceModel) => {
                                            const row = svc as unknown as Record<string, unknown>;
                                            const imgs = (row['images'] as string[] | undefined)
                                                ?? (Array.isArray(row['serviceImage']) ? (row['serviceImage'] as string[]) : (row['serviceImage'] ? [String(row['serviceImage'])] : undefined))
                                                ?? (row['image'] ? [String(row['image'])] : undefined);
                                            const maybeVideo = (row['video'] as string | null | undefined) ?? null;
                                            const mapped: ServiceModel = {
                                                id: String(row['id'] ?? svc.id),
                                                serviceName: String(row['serviceName'] ?? row['name'] ?? svc.serviceName ?? ''),
                                                description: (row['description'] as string) ?? svc.description ?? '',
                                                price: (row['price'] as unknown) as string | number ?? svc.price,
                                                duration: (row['duration'] as string | undefined) ?? svc.duration,
                                                serviceImage: imgs ?? (svc.serviceImage ?? []),
                                                discount: (row['discount'] as string | undefined) ?? svc.discount,
                                                type: (row['type'] as string | undefined) ?? svc.type,
                                                status: (row['status'] as boolean | undefined) ?? svc.status,
                                                prePayment: (row['prePayment'] as boolean | undefined) ?? svc.prePayment,
                                                feature: (row['feature'] as boolean | undefined) ?? svc.feature,
                                                serviceLocationMode: undefined,
                                                video: maybeVideo,
                                                approved: Boolean(row['approved'] ?? svc.approved),
                                            } as ServiceModel;
                                            dispatch(openEditModal(mapped));
                                        };

                                        const onRemoveFeatured = async (serviceId: string) => {
                                            try {
                                                await dispatch(unfeatureServiceById(serviceId)).unwrap();
                                                await dispatch(fetchServices());
                                            } catch (e) {
                                                console.error('Remove featured failed', e);
                                            }
                                        };

                                        return (
                                            <ServiceCard
                                                key={srv.id ?? JSON.stringify(srv)}
                                                service={srv}
                                                onView={onView}
                                                isActionLoading={loading}
                                                onRemoveFeatured={onRemoveFeatured}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                        {updatedCount > 0 && (
                            <div className="mt-6 text-sm text-green-700">
                                {activeTab === "featured" && featuredSubTab === "pending"
                                    ? `Updated ${updatedCount} featured requests`
                                    : `Updated ${updatedCount} services`}
                            </div>
                        )}
                    </div>
                </main>
                <EditServiceModal />
            </div>
        </AuthGuard>
    );
}
