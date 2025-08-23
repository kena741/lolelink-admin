import React from "react";
import ServiceCarousel from "./ServiceCarousel";
import type { ServiceModel } from "@/features/service/editServiceSlice";


/**
 * Props for ServiceCard
 */
export interface ServiceCardProps {
    service: ServiceModel;
    onView: (service: ServiceModel) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onView }) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const playHoverPreview = async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
            v.muted = false; // try with audio first
            await v.play();
        } catch {
            // Autoplay with sound is likely blocked; fall back to muted
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
    return (
        <div
            className="rounded-lg border bg-gray-50 text-card-foreground shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col group h-full"
        >
            {/* Make the whole card clickable except the buttons */}
            <div
                className="flex-1 flex flex-col cursor-pointer"
                tabIndex={0}
            >
                {/* Media: show video if available, else carousel */}
                <div
                    className="relative h-40 sm:h-48 md:h-56 overflow-hidden group"
                    role="region"
                    aria-roledescription="carousel"
                    onMouseEnter={() => { if (service.video) playHoverPreview(); }}
                    onMouseLeave={stopPreview}
                >
                    {service.video ? (
                        <video
                            ref={videoRef}
                            src={service.video}
                            className="w-full h-full object-cover bg-black cursor-pointer"
                            // We'll toggle muted dynamically
                            playsInline
                            preload="metadata"
                            aria-label={service.serviceName ?? 'Service video'}
                            onClick={() => onView(service)}
                        />
                    ) : (
                        <ServiceCarousel images={service.serviceImage ?? []} alt={service.serviceName ?? ''} />
                    )}
                </div>
                {/* Card content */}
                <div className="p-4 flex-1 flex flex-col "
                    role="button"
                    onClick={() => onView(service)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onView(service); } }}
                    aria-label={`View details for ${service.serviceName}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="grow overflow-hidden">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold truncate text-black">{service.serviceName}</h3>
                                <span
                                    aria-label={`Approved: ${Boolean(service.approved)}`}
                                    className={
                                        `text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ` +
                                        (service.approved ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700')
                                    }
                                >
                                    {` ${service.approved ? 'Approved:' : 'Not approved'}`}
                                </span>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="font-bold whitespace-nowrap text-sky-600">
                                ETB&nbsp;{service.price}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3 break-words">{service.description}</p>
                </div>
            </div>
            {/* Action buttons outside the interactive div */}
            <div className="flex justify-between gap-2 mt-auto px-4 pb-4">
                <button
                    className="whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-black bg-white hover:bg-gray-100 text-black h-9 rounded-md px-3 flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm"
                    onClick={() => onView(service)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye h-3 w-3 sm:h-4 sm:w-4"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    View
                </button>

            </div>
        </div>
    );
};

export default ServiceCard;
