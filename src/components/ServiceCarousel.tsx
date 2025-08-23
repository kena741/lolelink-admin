"use client";

import React, { useState } from "react";
import Image from "next/image";
import styles from "./ServiceCarousel.module.css";

interface ServiceCarouselProps {
    images: string[];
    alt: string;
}

const ServiceCarousel: React.FC<ServiceCarouselProps> = ({ images, alt }) => {
    const [current, setCurrent] = useState(0);
    const hasImages = images && images.length > 0;

    const goTo = (idx: number) => {
        setCurrent((idx + images.length) % images.length);
    };

    if (!hasImages) {
        return (
            <div className={styles["carousel-no-image"]}>No Image</div>
        );
    }

    return (
        <div className="relative aspect-square overflow-hidden group" role="region" aria-roledescription="carousel">
            <div className="relative w-full h-full">
                <div
                    className={`${styles["carousel-track"]} translate-x`}
                    data-current={current}
                >
                    {images.map((img) => (
                        <div
                            key={img}
                            role="group"
                            aria-roledescription="slide"
                            className={styles["carousel-slide"]}
                            data-carousel-slide
                        >
                            <div className="relative w-full h-full">
                                {/* Loader (hidden by default, can be shown if you add loading state) */}
                                <div className="w-full h-full bg-gray-50 absolute hidden">
                                    <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <Image
                                    src={img}
                                    alt={alt}
                                    fill
                                    className="w-full h-full object-cover transition-opacity duration-300 opacity-100"
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {images.length > 1 && (
                <>
                    <button
                        className="items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border-input hover:text-accent-foreground absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 border-0 shadow-lg w-10 h-10 rounded-full opacity-70 hover:opacity-100 transition-opacity duration-200 hidden sm:flex"
                        onClick={() => goTo(current - 1)}
                        aria-label="Previous slide"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left h-4 w-4"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
                        <span className="sr-only">Previous slide</span>
                    </button>
                    <button
                        className="items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border-input hover:text-accent-foreground absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 border-0 shadow-lg w-10 h-10 rounded-full opacity-70 hover:opacity-100 transition-opacity duration-200 hidden sm:flex"
                        onClick={() => goTo(current + 1)}
                        aria-label="Next slide"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right h-4 w-4"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                        <span className="sr-only">Next slide</span>
                    </button>
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-all ${current === idx ? "bg-white scale-125" : "bg-white/50"}`}
                                aria-label={`Go to slide ${idx + 1}`}
                                onClick={() => goTo(idx)}
                                type="button"
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ServiceCarousel;
