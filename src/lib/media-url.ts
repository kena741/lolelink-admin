const BUCKET = 'betegnabucket';

export function isPlaceholderMediaUrl(url: string | null | undefined): boolean {
    if (!url?.trim()) return true;
    const lower = url.toLowerCase();
    return (
        lower.includes('firebasestorage.googleapis.com') ||
        lower.includes('placeholder') ||
        lower.includes('user-placeholder')
    );
}

export function getDisplayImageUrl(url: string | null | undefined): string | null {
    if (!url?.trim()) return null;
    if (isPlaceholderMediaUrl(url)) return null;
    return url.trim();
}

interface ProfileImageSource {
    profileImage?: string | null;
    profile_image?: string | null;
    avatar_url?: string | null;
}

export function resolveProfileImageUrl(
    source: ProfileImageSource | null | undefined
): string | null {
    if (!source) return null;
    return (
        getDisplayImageUrl(source.profileImage) ??
        getDisplayImageUrl(source.profile_image) ??
        getDisplayImageUrl(source.avatar_url)
    );
}

export function extractSupabaseStoragePath(url: string): string | null {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length).replace(/%20/g, ' ');
}

export function getRemovedStorageUrls(previous: string[], next: string[]): string[] {
    const nextSet = new Set(next);
    return previous.filter((url) => {
        if (!url || nextSet.has(url)) return false;
        return extractSupabaseStoragePath(url) !== null;
    });
}

export function getServiceImageUrls(service: Record<string, unknown>): string[] {
    const value = service.serviceImage ?? service.images ?? service.image;
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }
    if (typeof value === 'string' && value.trim()) return [value];
    return [];
}
