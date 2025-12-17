"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { fetchServices, /* approveAllServices, */ resetApproveState } from '@/features/service/approveServicesSlice';
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
    const [activeTab, setActiveTab] = useState<'notApproved' | 'approved'>('notApproved');

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

    useEffect(() => {
        dispatch(fetchServices());
        return () => {
            dispatch(resetApproveState());
        };
    }, [dispatch]);

    // Note: approval is now provider-scoped. Use the provider detail page to approve a provider's services.

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg mb-2">
                                        Approve Services
                                    </h1>
                                    <p className="text-white/90 text-base font-medium">
                                        {notApprovedServices.length} awaiting approval · {approvedServices.length} approved
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        onClick={() => dispatch(fetchServices())} 
                                        className="bg-white/10 backdrop-blur-md text-white border-white/20 hover:bg-white/20"
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
                                        activeTab === 'notApproved' 
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' 
                                            : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                    onClick={() => setActiveTab('notApproved')}
                                >
                                    Not approved ({notApprovedServices.length})
                                </button>
                                <button
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === 'approved' 
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' 
                                            : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                    onClick={() => setActiveTab('approved')}
                                >
                                    Approved ({approvedServices.length})
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

                    {activeTab === 'notApproved' && (
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-3">Awaiting Approval ({notApprovedServices.length})</h2>
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

                    {activeTab === 'approved' && (
                        <section>
                            <h2 className="text-xl font-semibold mb-3">Approved ({approvedServices.length})</h2>
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

                        {updatedCount > 0 && (
                            <div className="mt-6 text-sm text-green-700">Approved {updatedCount} services</div>
                        )}
                    </div>
                </main>
                <EditServiceModal />
            </div>
        </AuthGuard>
    );
}
