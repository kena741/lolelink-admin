"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { RefreshCw } from 'lucide-react';
import { fetchServices, approveFeatureRequestById, rejectFeatureRequestById, unfeatureServiceById } from '@/features/service/approveServicesSlice';
import { deleteService as deleteServiceThunk } from '@/features/service/deleteServiceSlice';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';
import type { RootState } from '@/store/store';
import ServiceCard from '@/components/ServiceCard';
import type { ServiceModel } from '@/features/service/editServiceSlice';
import { mapServiceRowToEditServiceModel, openEditModal } from '@/features/service/editServiceSlice';
import EditServiceModal from '@/app/admin/providers/[id]/EditServiceModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

export default function ApproveServicesPage() {
    const dispatch = useAppDispatch();
    const { canWriteServices } = useAdminPermissions();
    const { services, loading, error, updatedCount } = useAppSelector((s: RootState) => s.approveServices ?? { services: [], loading: false, error: null, updatedCount: 0 });
    const { loading: deleteLoading, error: deleteError } = useAppSelector((s: RootState) => s.deleteService ?? { loading: false, error: null, success: false });

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'services' | 'featured'>('services');
    const [servicesSubTab, setServicesSubTab] = useState<'pending' | 'approved'>('pending');
    const [featuredSubTab, setFeaturedSubTab] = useState<'pending' | 'existing'>('pending');

    const normalizedServices = useMemo(() => (services || []).map(s => s as ServiceModel), [services]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = !q
            ? normalizedServices
            : normalizedServices.filter(s => {
                const name = (s.serviceName ?? '').toString().toLowerCase();
                const desc = (s.description ?? '').toString().toLowerCase();
                const providerName = (s.providerName ?? '').toString().toLowerCase();
                return (
                    name.includes(q) ||
                    desc.includes(q) ||
                    providerName.includes(q) ||
                    (s.id ?? '').toString().toLowerCase().includes(q)
                );
            });
        return [...list].sort((a, b) => {
            const ar = (a.pricing_type ?? '').toString().toUpperCase() === 'RECURRING' ? 0 : 1;
            const br = (b.pricing_type ?? '').toString().toUpperCase() === 'RECURRING' ? 0 : 1;
            return ar - br;
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
        if (!shouldRefetchAdminList('approve-services', { hasRows: services.length > 0 })) return;
        void dispatch(fetchServices()).then((action) => {
            if (fetchServices.fulfilled.match(action)) markAdminListFetched('approve-services');
        });
    }, [dispatch, services.length]);

    const confirmDeletePendingService = async () => {
        if (!deleteId) return;
        try {
            await dispatch(deleteServiceThunk(deleteId)).unwrap();
            await dispatch(fetchServices());
        } catch (e) {
            console.error('Delete pending service failed', e);
        } finally {
            setDeleteId(null);
        }
    };

    // Note: approval is now provider-scoped. Use the provider detail page to approve a provider's services.

    return (
        <>
            
                
                    <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <AdminPageHeader
                            title="Approve Services"
                            description={`${pendingServicesCount > 0 ? `${pendingServicesCount} awaiting approval` : 'No pending approvals'} · ${pendingFeaturedCount > 0 ? `${pendingFeaturedCount} featured pending` : 'No pending featured'}`}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => dispatch(fetchServices())}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />
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
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                    onClick={() => setActiveTab('services')}
                                >
                                    Services{pendingServicesCount > 0 ? ` (${pendingServicesCount})` : ''}
                                </button>
                                <button
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === 'featured'
                                            ? 'bg-primary text-primary-foreground shadow-sm'
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
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setServicesSubTab('pending')}
                            >
                                Pending{pendingServicesCount > 0 ? ` (${pendingServicesCount})` : ''}
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    servicesSubTab === 'approved'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
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
                                            dispatch(openEditModal(
                                                mapServiceRowToEditServiceModel(svc as unknown as Record<string, unknown>)
                                            ));
                                        };
                                        return (
                                            <ServiceCard
                                                key={srv.id ?? JSON.stringify(srv)}
                                                service={srv}
                                                onView={onView}
                                                isActionLoading={loading || deleteLoading}
                                                onDelete={canWriteServices ? (serviceId) => setDeleteId(serviceId) : undefined}
                                            />
                                        );
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
                                            dispatch(openEditModal(
                                                mapServiceRowToEditServiceModel(svc as unknown as Record<string, unknown>)
                                            ));
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
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-gray-700 hover:text-gray-900'
                                }`}
                                onClick={() => setFeaturedSubTab('pending')}
                            >
                                Pending{pendingFeaturedCount > 0 ? ` (${pendingFeaturedCount})` : ''}
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    featuredSubTab === 'existing'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
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
                                            dispatch(openEditModal(
                                                mapServiceRowToEditServiceModel(svc as unknown as Record<string, unknown>)
                                            ));
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
                                                onApproveFeature={canWriteServices ? onApprove : undefined}
                                                onRejectFeature={canWriteServices ? onReject : undefined}
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
                                            dispatch(openEditModal(
                                                mapServiceRowToEditServiceModel(svc as unknown as Record<string, unknown>)
                                            ));
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
                                                onRemoveFeatured={canWriteServices ? onRemoveFeatured : undefined}
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
                
                <EditServiceModal />

                {canWriteServices && (
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogHeader>
                        <DialogTitle>Delete pending service?</DialogTitle>
                        <DialogDescription>
                            This removes the service from the pending queue. If it has bookings, it will be archived instead of permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="text-sm text-red-600">{String(deleteError)}</div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={deleteLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            onClick={confirmDeletePendingService}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </Dialog>
                )}
            
        </>
    );
}
