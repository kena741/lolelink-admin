'use client';

import type React from 'react';
import { cn } from '@/lib/utils';

type StorageImageProps = {
    src: string;
    alt: string;
    className?: string;
    /** Use when parent is `relative` and image should fill the box. */
    fill?: boolean;
    width?: number;
    height?: number;
    loading?: 'lazy' | 'eager';
    onClick?: React.MouseEventHandler<HTMLImageElement>;
    onError?: () => void;
};

/** Re-encode path segments so spaces/commas in uploaded filenames don't break in production. */
function toSafeImageSrc(src: string): string {
    try {
        const url = new URL(src);
        url.pathname = url.pathname
            .split('/')
            .map((segment) => {
                if (!segment) return segment;
                try {
                    return encodeURIComponent(decodeURIComponent(segment));
                } catch {
                    return encodeURIComponent(segment);
                }
            })
            .join('/');
        return url.toString();
    } catch {
        return src;
    }
}

/**
 * Renders remote storage images with a native img element.
 * Avoids Next.js `/_next/image` optimization, which often fails for
 * Supabase Storage URLs in production while working locally.
 */
export function StorageImage({
    src,
    alt,
    className,
    fill = false,
    width,
    height,
    loading = 'lazy',
    onClick,
    onError,
}: StorageImageProps) {
    const safeSrc = toSafeImageSrc(src);

    return (
        // Native element on purpose — do not swap for next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={safeSrc}
            alt={alt}
            width={fill ? undefined : width}
            height={fill ? undefined : height}
            loading={loading}
            onClick={onClick}
            onError={onError}
            referrerPolicy="no-referrer"
            className={cn(
                fill ? 'absolute inset-0 h-full w-full' : undefined,
                className
            )}
        />
    );
}
