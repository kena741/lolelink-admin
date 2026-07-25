'use client';

import { useState } from 'react';
import { StorageImage } from '@/components/StorageImage';
import { getMediaUrlExtension, isBrowserInlineImage } from '@/lib/document-media';
import { cn } from '@/lib/utils';

type DocumentMediaPreviewProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    onOpen?: () => void;
};

/**
 * Preview for provider-uploaded docs (often iPhone image_picker files).
 * Uses a native img so Next `/_next/image` never touches HEIC/odd JPEGs.
 */
export function DocumentMediaPreview({
    src,
    alt,
    className,
    imgClassName,
    onOpen,
}: DocumentMediaPreviewProps) {
    const [failed, setFailed] = useState(false);
    const canPreview = isBrowserInlineImage(src) && !failed;
    const ext = getMediaUrlExtension(src);

    if (!canPreview) {
        return (
            <div className={cn('rounded-lg border border-border bg-muted/40 p-4', className)}>
                <p className="text-sm text-text-secondary">
                    {failed
                        ? 'This iPhone/HEIC image can’t be previewed in the browser.'
                        : (
                            <>
                                This file is <span className="font-semibold uppercase">{ext || 'unknown'}</span> and
                                can’t be previewed in the browser.
                            </>
                        )}
                </p>
                <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                    Open original file
                </a>
            </div>
        );
    }

    return (
        <button
            type="button"
            className={cn(
                'block w-full overflow-hidden rounded-lg border border-border bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className
            )}
            onClick={onOpen}
        >
            <StorageImage
                src={src}
                alt={alt}
                className={cn('mx-auto max-h-96 w-full object-contain', imgClassName)}
                onError={() => setFailed(true)}
            />
        </button>
    );
}
