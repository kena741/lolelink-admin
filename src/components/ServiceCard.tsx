import React from "react";
import { Check, Eye, Trash2, X } from "lucide-react";
import ServiceCarousel from "./ServiceCarousel";
import type { ServiceModel } from "@/features/service/editServiceSlice";
import { formatAdminDateTimeUtc } from "@/lib/admin-datetime";

export interface ServiceCardProps {
    service: ServiceModel;
    onView: (service: ServiceModel) => void;
    isActionLoading?: boolean;
    onApproveFeature?: (serviceId: string) => void | Promise<void>;
    onRejectFeature?: (serviceId: string) => void | Promise<void>;
    onRemoveFeatured?: (serviceId: string) => void | Promise<void>;
    onDelete?: (serviceId: string) => void | Promise<void>;
}

function formatMoney(value: string | number | null | undefined): string {
    if (value == null || value === "") return "—";
    const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(num)) return `ETB ${value}`;
    return `ETB ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
    service,
    onView,
    isActionLoading = false,
    onApproveFeature,
    onRejectFeature,
    onRemoveFeatured,
    onDelete,
}) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const playHoverPreview = async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
            v.muted = false;
            await v.play();
        } catch {
            try {
                v.muted = true;
                await v.play();
            } catch {
                // ignore
            }
        }
    };
    const stopPreview = () => {
        const v = videoRef.current;
        if (!v) return;
        try {
            v.pause();
            v.currentTime = 0;
        } catch { }
    };

    const featureRequestStatus = service.feature_requested_status ?? null;
    const isFeatureRequestPending = String(featureRequestStatus ?? "").toLowerCase() === "pending";
    const isFeatured = Boolean(service.feature);
    const requestDate = service.feature_requested_at || service.createdAt || null;

    const actionButtonClass =
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:pointer-events-none disabled:opacity-50 sm:text-sm";

    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md">
            <div className="flex flex-1 flex-col">
                <div
                    className="relative h-40 overflow-hidden sm:h-48 md:h-52"
                    role="region"
                    aria-roledescription="carousel"
                    onMouseEnter={() => {
                        if (service.video) void playHoverPreview();
                    }}
                    onMouseLeave={stopPreview}
                >
                    {service.video ? (
                        <video
                            ref={videoRef}
                            src={service.video}
                            className="h-full w-full cursor-pointer object-cover bg-black"
                            playsInline
                            preload="metadata"
                            aria-label={service.serviceName ?? "Service video"}
                            onClick={() => onView(service)}
                        />
                    ) : (
                        <ServiceCarousel images={service.serviceImage ?? []} alt={service.serviceName ?? ""} />
                    )}
                </div>

                <div
                    className="flex flex-1 cursor-pointer flex-col p-4"
                    role="button"
                    tabIndex={0}
                    onClick={() => onView(service)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onView(service);
                    }}
                    aria-label={`View details for ${service.serviceName}`}
                >
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span
                            className={
                                service.approved
                                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                                    : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600"
                            }
                        >
                            {service.approved ? "Approved" : "Not approved"}
                        </span>
                        {(service.pricing_type ?? "").toString().toUpperCase() === "RECURRING" ? (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                                Recurring
                            </span>
                        ) : null}
                        {isFeatured ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                                Featured
                            </span>
                        ) : null}
                        {!isFeatured && isFeatureRequestPending ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Feature requested
                            </span>
                        ) : null}
                        {!isFeatured && isFeatureRequestPending ? (
                            <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    service.featureRequestPaid
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-rose-100 text-rose-800"
                                }`}
                            >
                                {service.featureRequestPaid ? "Paid" : "Unpaid"}
                            </span>
                        ) : null}
                        {service.isArchived ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                Archived
                            </span>
                        ) : null}
                    </div>

                    <h3 className="truncate text-base font-bold text-gray-900">{service.serviceName}</h3>

                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                        {service.providerName ? (
                            <p className="truncate">
                                <span className="font-medium text-gray-600">Provider</span>
                                {" · "}
                                {service.providerName}
                            </p>
                        ) : null}
                        {requestDate ? (
                            <p>
                                <span className="font-medium text-gray-600">
                                    {isFeatureRequestPending ? "Requested" : "Created"}
                                </span>
                                {" · "}
                                {formatAdminDateTimeUtc(requestDate)}
                            </p>
                        ) : null}
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-snug text-gray-600">{service.description}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Service price</p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatMoney(service.price)}</p>
                        </div>
                        {isFeatureRequestPending ? (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Feature fee</p>
                                <p
                                    className={`mt-0.5 text-sm font-semibold ${
                                        service.featureRequestPaid ? "text-emerald-700" : "text-rose-700"
                                    }`}
                                >
                                    {service.featureRequestPaid
                                        ? formatMoney(service.featureRequestPaidAmount)
                                        : "Not paid"}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Listing</p>
                                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                                    {isFeatured ? "Featured" : "Standard"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
                {isFeatureRequestPending && onApproveFeature ? (
                    <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => onApproveFeature(service.id)}
                        className={`${actionButtonClass} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                    >
                        <Check className="h-4 w-4" aria-hidden />
                        Approve
                    </button>
                ) : null}
                {isFeatureRequestPending && onRejectFeature ? (
                    <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => onRejectFeature(service.id)}
                        className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100`}
                    >
                        <X className="h-4 w-4" aria-hidden />
                        Reject
                    </button>
                ) : null}
                {isFeatured && !isFeatureRequestPending && onRemoveFeatured ? (
                    <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => onRemoveFeatured(service.id)}
                        className={`${actionButtonClass} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100`}
                    >
                        Remove featured
                    </button>
                ) : null}
                {onDelete && !service.isArchived ? (
                    <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => onDelete(service.id)}
                        className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100`}
                    >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Archive
                    </button>
                ) : null}
                <button
                    type="button"
                    className={`${actionButtonClass} ml-auto border-gray-300 bg-white text-gray-900 hover:bg-gray-50`}
                    onClick={() => onView(service)}
                >
                    <Eye className="h-4 w-4" aria-hidden />
                    View
                </button>
            </div>
        </div>
    );
};

export default ServiceCard;
