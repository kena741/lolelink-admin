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
    const onApproveAll = async () => {
        // no-op: we keep the button disabled in the UI to prevent accidental global approval
        return;
    };

    return (
        <AuthGuard>
            <div className="flex">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen bg-gray-50 p-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">Approve Services</h1>
                            <div className="text-sm text-gray-600">{notApprovedServices.length} awaiting approval · {approvedServices.length} approved</div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input aria-label="Search services" placeholder="Search by name, description, or id" value={query} onChange={(e) => setQuery(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
                            <Button onClick={() => dispatch(fetchServices())} variant="outline">Refresh</Button>
                            <Button onClick={onApproveAll} disabled>Approve All</Button>
                        </div>
                    </div>

                    {loading && <div className="p-4">Loading…</div>}
                    {error && <div className="p-4 text-red-600">{String(error)}</div>}

                    <div className="mb-4 flex items-center gap-3">
                        <button
                            className={`px-3 py-1 rounded ${activeTab === 'notApproved' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 border'}`}
                            onClick={() => setActiveTab('notApproved')}
                        >
                            Not approved ({notApprovedServices.length})
                        </button>
                        <button
                            className={`px-3 py-1 rounded ${activeTab === 'approved' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 border'}`}
                            onClick={() => setActiveTab('approved')}
                        >
                            Approved ({approvedServices.length})
                        </button>
                    </div>

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
                </main>
            </div>
            <EditServiceModal />
        </AuthGuard>
    );
}
