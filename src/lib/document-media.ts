import { getDisplayImageUrl } from '@/lib/media-url';

/** File extension from a media URL (lowercase, no query string). */
export function getMediaUrlExtension(url: string | null | undefined): string | null {
    const display = getDisplayImageUrl(url);
    if (!display) return null;
    try {
        const pathname = new URL(display).pathname;
        const match = pathname.match(/\.([a-z0-9]+)$/i);
        return match?.[1]?.toLowerCase() ?? null;
    } catch {
        const match = display.split('?')[0]?.match(/\.([a-z0-9]+)$/i);
        return match?.[1]?.toLowerCase() ?? null;
    }
}

const BROWSER_INLINE_IMAGE_EXTS = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'avif',
    'bmp',
    'svg',
]);

/** True when most browsers can render this URL as an inline image preview. */
export function isBrowserInlineImage(url: string | null | undefined): boolean {
    const ext = getMediaUrlExtension(url);
    if (!ext) return true;
    return BROWSER_INLINE_IMAGE_EXTS.has(ext);
}
