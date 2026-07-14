export interface ProviderLocationCoords {
    latitude: number | null;
    longitude: number | null;
}

export interface ProviderAddressValue {
    address: string;
    latitude: number | null;
    longitude: number | null;
}

export function parseProviderLocation(
    location: Record<string, unknown> | null | undefined
): ProviderLocationCoords {
    if (!location) return { latitude: null, longitude: null };

    const latRaw = location.latitude ?? location.lat;
    const lngRaw = location.longitude ?? location.lng;
    if (typeof latRaw === 'number' && typeof lngRaw === 'number') {
        return { latitude: latRaw, longitude: lngRaw };
    }

    const geopoint = location.geopoint as Record<string, unknown> | undefined;
    if (geopoint) {
        const gLat = geopoint.latitude;
        const gLng = geopoint.longitude;
        if (typeof gLat === 'number' && typeof gLng === 'number') {
            return { latitude: gLat, longitude: gLng };
        }
    }

    return { latitude: null, longitude: null };
}

export function buildProviderLocationPayload(
    latitude: number | null,
    longitude: number | null
): { latitude: number; longitude: number } | null {
    if (latitude == null || longitude == null) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
}

/** Great-circle distance in km. */
export function distanceKm(
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
