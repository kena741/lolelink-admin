
'use client';
import React, { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProviderById, fetchProviderServices, clearSelected, clearServices } from '@/features/provider/providerSlice';

export default function ProviderDetailPage() {
    const params = useParams();
    const id = (params?.id as string) || '';

    const dispatch = useAppDispatch();
    const { selected: provider, selectedLoading, error, services, servicesLoading } = useAppSelector((s) => s.provider);

    useEffect(() => {
        if (!id) return;
        dispatch(fetchProviderById(id));
        dispatch(fetchProviderServices(id));
        return () => {
            dispatch(clearSelected());
            dispatch(clearServices());
        };
    }, [dispatch, id]);

    const bannerSrc = provider?.banner || undefined;
    const profileSrc = provider?.profileImage || provider?.profile_image || provider?.avatar_url || undefined;
    const displayName = (() => {
        const first = provider?.firstName ?? provider?.first_name;
        const last = provider?.lastName ?? provider?.last_name;
        const full = [first, last].filter(Boolean).join(' ');
        return full || provider?.name || '—';
    })();

    return (
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold">{displayName}</h1>
                                    <p className="text-gray-600">{provider.email || '—'} · {provider.phoneNumber || provider.phone || '—'}</p>
                                    <p className="text-gray-600">{provider.address || '—'}</p>
                                </div>
                            </div>

                            {/* Services listed by this provider */}
                            <section className="mt-10">
                                <h2 className="text-2xl font-semibold mb-4">Services</h2>
                                {services.length === 0 ? (
                                    <div className="text-gray-500">No services found for this provider.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {services.map((s) => (
                                            <div key={s.id} className="bg-white rounded shadow p-4">
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
                                                <div className="font-semibold">{s.serviceName || s.name || 'Service'}</div>
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
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
