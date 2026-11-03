import { distanceKm, parseProviderLocation } from '@/lib/provider-location';
import { isAdminUnpaidService } from '@/lib/service-posting-tiers';

/** ~0.05° ≈ 5 km near the equator / Addis. Kept for coarse fallback only. */
export const AREA_GRID_DEG = 0.05;

export const PRICE_BUCKET_DEFS = [
    { label: '<200', min: 0, max: 200 },
    { label: '200–500', min: 200, max: 500 },
    { label: '500–1000', min: 500, max: 1000 },
    { label: '1000–2500', min: 1000, max: 2500 },
    { label: '2500+', min: 2500, max: Number.POSITIVE_INFINITY },
] as const;

export type PriceBucketLabel = (typeof PRICE_BUCKET_DEFS)[number]['label'];

/** Named hubs used when address is thin but GPS exists (nearest within ~18 km). */
export const PLACE_CENTERS: Array<{ name: string; lat: number; lng: number }> = [
    { name: 'Bole, Addis Ababa', lat: 8.980, lng: 38.799 },
    { name: 'Airport / Bole Michael, Addis Ababa', lat: 8.978, lng: 38.799 },
    { name: 'CMC / Hayahulet, Addis Ababa', lat: 9.020, lng: 38.830 },
    { name: 'Megenagna, Addis Ababa', lat: 9.020, lng: 38.802 },
    { name: 'Kazanchis, Addis Ababa', lat: 9.015, lng: 38.770 },
    { name: 'Piassa / Arada, Addis Ababa', lat: 9.035, lng: 38.752 },
    { name: 'Mexico / Lideta, Addis Ababa', lat: 9.010, lng: 38.735 },
    { name: 'Sarbet / Tor Hailoch, Addis Ababa', lat: 8.995, lng: 38.720 },
    { name: 'Lebu / Jemo, Addis Ababa', lat: 8.955, lng: 38.720 },
    { name: 'Summit / Ayat, Addis Ababa', lat: 9.045, lng: 38.880 },
    { name: 'Gerji, Addis Ababa', lat: 8.995, lng: 38.815 },
    { name: 'Saris, Addis Ababa', lat: 8.960, lng: 38.780 },
    { name: 'Merkato, Addis Ababa', lat: 9.030, lng: 38.740 },
    { name: '4 Kilo / Sidist Kilo, Addis Ababa', lat: 9.040, lng: 38.760 },
    { name: 'Addis Ababa (central)', lat: 9.019, lng: 38.752 },
    { name: 'Adama', lat: 8.540, lng: 39.270 },
    { name: 'Bahir Dar', lat: 11.590, lng: 37.390 },
    { name: 'Hawassa', lat: 7.050, lng: 38.480 },
    { name: 'Mekelle', lat: 13.500, lng: 39.470 },
    { name: 'Dire Dawa', lat: 9.600, lng: 41.850 },
    { name: 'Jimma', lat: 7.670, lng: 36.830 },
    { name: 'Gondar', lat: 12.610, lng: 37.460 },
    { name: 'Dessie', lat: 11.130, lng: 39.630 },
    { name: 'Debre Birhan', lat: 9.680, lng: 39.530 },
    { name: 'Mizan Teferi', lat: 6.990, lng: 35.580 },
];

const CITY_PATTERNS: Array<{ re: RegExp; name: string }> = [
    { re: /\bbole\b/, name: 'Bole, Addis Ababa' },
    { re: /\bcmc\b|\bhayahulet\b/, name: 'CMC / Hayahulet, Addis Ababa' },
    { re: /\bmegenagna\b/, name: 'Megenagna, Addis Ababa' },
    { re: /\bkazanchis\b/, name: 'Kazanchis, Addis Ababa' },
    { re: /\bpiassa\b|\barada\b/, name: 'Piassa / Arada, Addis Ababa' },
    { re: /\bmexico\b|\blideta\b/, name: 'Mexico / Lideta, Addis Ababa' },
    { re: /\bsarbet\b|\btor\s*hailoch\b/, name: 'Sarbet / Tor Hailoch, Addis Ababa' },
    { re: /\blebu\b|\bjemo\b/, name: 'Lebu / Jemo, Addis Ababa' },
    { re: /\bsummit\b|\bayat\b/, name: 'Summit / Ayat, Addis Ababa' },
    { re: /\bgerji\b/, name: 'Gerji, Addis Ababa' },
    { re: /\bsaris\b/, name: 'Saris, Addis Ababa' },
    { re: /\bmerkato\b/, name: 'Merkato, Addis Ababa' },
    { re: /\badama\b|\bnazret\b/, name: 'Adama' },
    { re: /\bbahir\s*dar\b/, name: 'Bahir Dar' },
    { re: /\bhawassa\b|\bawassa\b/, name: 'Hawassa' },
    { re: /\bmekelle\b|\bmekele\b/, name: 'Mekelle' },
    { re: /\bdire\s*dawa\b/, name: 'Dire Dawa' },
    { re: /\bjimma\b/, name: 'Jimma' },
    { re: /\bgondar\b/, name: 'Gondar' },
    { re: /\bdese\b|\bdessie\b/, name: 'Dessie' },
    { re: /\bdebre\s*birhan\b/, name: 'Debre Birhan' },
    { re: /\bmizan\b/, name: 'Mizan Teferi' },
    { re: /\baddis\s*ababa\b|\bአዲስ\s*አበባ\b|\baddis\b/, name: 'Addis Ababa' },
];

const PLUS_CODE = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i;

export function parseMoney(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number.parseFloat(value.replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function priceBucketLabel(price: number): PriceBucketLabel {
    for (const bucket of PRICE_BUCKET_DEFS) {
        if (price >= bucket.min && price < bucket.max) return bucket.label;
    }
    return '2500+';
}

export function areaKeyFromCoords(lat: number, lng: number, step = AREA_GRID_DEG): string {
    const qLat = Math.floor(lat / step) * step;
    const qLng = Math.floor(lng / step) * step;
    return `Near ${qLat.toFixed(2)}°, ${qLng.toFixed(2)}°`;
}

export function nearestPlaceName(lat: number, lng: number, maxKm = 18): string | null {
    let best: { name: string; km: number } | null = null;
    for (const place of PLACE_CENTERS) {
        const km = distanceKm(lat, lng, place.lat, place.lng);
        if (!best || km < best.km) best = { name: place.name, km };
    }
    if (!best || best.km > maxKm) return null;
    return best.name;
}

/** Human place name from address text (plus-codes stripped). */
export function placeNameFromAddress(address: string | null | undefined): string | null {
    const raw = (address ?? '').trim();
    if (!raw) return null;
    const text = raw.toLowerCase();

    for (const pattern of CITY_PATTERNS) {
        if (pattern.re.test(text) && pattern.name !== 'Addis Ababa') return pattern.name;
    }

    const parts = raw
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p && !PLUS_CODE.test(p) && !/^ethiopia$/i.test(p) && !/^\d{3,5}$/.test(p));

    if (parts.length >= 2) {
        const city = parts[parts.length - 1]!;
        const locality = parts[parts.length - 2]!;
        if (/addis/i.test(city) || /አዲስ/.test(city)) {
            if (!/addis/i.test(locality) && locality.length > 2) {
                return `${locality}, Addis Ababa`;
            }
            return 'Addis Ababa';
        }
        if (locality.length > 2 && city.length > 2) return `${locality}, ${city}`;
        return city;
    }

    for (const pattern of CITY_PATTERNS) {
        if (pattern.re.test(text)) return pattern.name;
    }

    if (parts[0] && parts[0].length > 2) return parts[0].slice(0, 48);
    return null;
}

/** Prefer named places from address, then nearest hub by GPS, then coarse coord label. */
export function resolvePlaceName(
    location: Record<string, unknown> | null | undefined,
    address: string | null | undefined
): string {
    const fromAddress = placeNameFromAddress(address);
    const coords = parseProviderLocation(location);
    const hasGps =
        typeof coords.latitude === 'number'
        && typeof coords.longitude === 'number'
        && Number.isFinite(coords.latitude)
        && Number.isFinite(coords.longitude);

    // Generic city-only address + GPS → tighten to nearest neighborhood/city hub
    if (
        hasGps
        && (!fromAddress || fromAddress === 'Addis Ababa' || /^addis ababa$/i.test(fromAddress))
    ) {
        const nearest = nearestPlaceName(coords.latitude!, coords.longitude!);
        if (nearest) return nearest;
    }

    if (fromAddress) return fromAddress;

    if (hasGps) {
        const nearest = nearestPlaceName(coords.latitude!, coords.longitude!);
        if (nearest) return nearest;
        return areaKeyFromCoords(coords.latitude!, coords.longitude!);
    }

    return 'Unknown';
}

/** @deprecated use resolvePlaceName — kept as alias for callers/tests */
export function resolveAreaKey(
    location: Record<string, unknown> | null | undefined,
    address: string | null | undefined
): string {
    return resolvePlaceName(location, address);
}

export function areaKeyFromAddress(address: string | null | undefined): string {
    return placeNameFromAddress(address) ?? 'Unknown';
}

export function hasUsableLocation(
    location: Record<string, unknown> | null | undefined
): boolean {
    const coords = parseProviderLocation(location);
    return (
        typeof coords.latitude === 'number'
        && typeof coords.longitude === 'number'
        && Number.isFinite(coords.latitude)
        && Number.isFinite(coords.longitude)
    );
}

/** `values` need not be sorted; returns null if empty. */
export function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    if (p <= 0) return sorted[0] ?? null;
    if (p >= 100) return sorted[sorted.length - 1] ?? null;
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    const a = sorted[lo] ?? sorted[0]!;
    const b = sorted[hi] ?? a;
    if (lo === hi) return a;
    return a + (b - a) * (rank - lo);
}

export function percentiles(values: number[]): {
    p25: number | null;
    median: number | null;
    p75: number | null;
} {
    return {
        p25: percentile(values, 25),
        median: percentile(values, 50),
        p75: percentile(values, 75),
    };
}

export function formatTierMax(tierMax: number | null | undefined): string {
    const max = tierMax ?? 0;
    if (max < 0) return 'unlimited';
    return String(max);
}

export function countByKey(keys: string[]): Array<{ key: string; count: number }> {
    const map = new Map<string, number>();
    for (const key of keys) {
        map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export interface DistProvider {
    id: string;
    name: string;
    address?: string | null;
    location?: Record<string, unknown> | null;
    active?: boolean | null;
    activation_paid?: boolean | null;
    service_tier_max?: number | null;
    archived?: boolean;
}

export interface DistService {
    id: string;
    provider_id: string;
    price: number | null;
    categoryName: string;
    active: boolean;
    archived: boolean;
    description?: string | null;
}

export interface DistBooking {
    id: string;
    provider_id: string;
    status: string;
    amount: number;
    createdAt: string | null;
    categoryName?: string;
}

export interface NamedCount {
    key: string;
    count: number;
}

export interface NamedMoney {
    key: string;
    amount: number;
    count: number;
}

export interface ProviderDistributionReport {
    generatedAt: string;
    snapshot: {
        totalProviders: number;
        withLocation: number;
        withLocationPct: number;
        activated: number;
        activatedPct: number;
        withActiveService: number;
        withActiveServicePct: number;
        medianListPrice: number | null;
        completedRevenueAll: number;
        completedRevenue90d: number;
        completedBookingsAll: number;
        completedBookings90d: number;
    };
    location: {
        all: {
            providerCount: number;
            missingGps: number;
            missingPlace: number;
            topAreas: NamedCount[];
        };
        withServices: {
            providerCount: number;
            missingGps: number;
            missingPlace: number;
            topAreas: NamedCount[];
        };
    };
    listPrices: {
        buckets: NamedCount[];
        overall: { p25: number | null; median: number | null; p75: number | null };
        byCategory: Array<{
            category: string;
            count: number;
            p25: number | null;
            median: number | null;
            p75: number | null;
        }>;
    };
    tiers: {
        byTier: NamedCount[];
        overTierProviders: number;
        adminUnpaidServices: number;
        zeroServiceProviders: number;
    };
    bookingRevenue: {
        byArea: NamedMoney[];
        byCategory: NamedMoney[];
        topProviders: Array<{ providerId: string; name: string; amount: number; count: number }>;
        withServicesZeroCompleted: number;
    };
    supplyDemand: Array<{
        area: string;
        providers: number;
        completedBookings: number;
        revenue: number;
        bookingsPerProvider: number | null;
    }>;
    health: {
        inactiveProviders: number;
        zeroServices: number;
        notActivationPaid: number;
        adminUnpaidServices: number;
    };
}

const MS_90D = 90 * 24 * 60 * 60 * 1000;

function pct(part: number, whole: number): number {
    if (whole <= 0) return 0;
    return Math.round((part / whole) * 1000) / 10;
}

function categoryLabel(raw: unknown): string {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const name = (raw as Record<string, unknown>).name ?? (raw as Record<string, unknown>).categoryName;
        if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return 'Uncategorized';
}

export function normalizeServiceRow(row: Record<string, unknown>): DistService {
    const categoryModel = row.categoryModel;
    const categoryName =
        categoryLabel(categoryModel)
        || (typeof row.categoryId === 'string' ? row.categoryId : 'Uncategorized');
    return {
        id: String(row.id ?? ''),
        provider_id: String(row.provider_id ?? ''),
        price: parseMoney(row.price),
        categoryName,
        active: row.active !== false && row.status !== false,
        archived: row.isArchived === true,
        description: typeof row.description === 'string' ? row.description : null,
    };
}

export function buildProviderDistributionReport(input: {
    providers: DistProvider[];
    services: DistService[];
    bookings: DistBooking[];
    now?: Date;
}): ProviderDistributionReport {
    const now = input.now ?? new Date();
    const nowMs = now.getTime();
    const cutoff90 = nowMs - MS_90D;

    const providers = input.providers.filter((p) => !p.archived);
    const servicesByProvider = new Map<string, DistService[]>();
    for (const service of input.services) {
        if (!service.provider_id) continue;
        const list = servicesByProvider.get(service.provider_id) ?? [];
        list.push(service);
        servicesByProvider.set(service.provider_id, list);
    }

    const areaByProvider = new Map<string, string>();
    for (const provider of providers) {
        areaByProvider.set(
            provider.id,
            resolvePlaceName(provider.location ?? null, provider.address)
        );
    }

    const withLocation = providers.filter((p) => hasUsableLocation(p.location ?? null)).length;
    const activated = providers.filter((p) => p.activation_paid === true).length;
    const providersWithActiveService = providers.filter((p) => {
        const list = servicesByProvider.get(p.id) ?? [];
        return list.some((s) => !s.archived && s.active);
    });
    const withActiveService = providersWithActiveService.length;

    function locationSlice(subset: DistProvider[]) {
        const places = subset.map((p) => areaByProvider.get(p.id) ?? 'Unknown');
        return {
            providerCount: subset.length,
            missingGps: subset.filter((p) => !hasUsableLocation(p.location ?? null)).length,
            missingPlace: subset.filter((p) => (areaByProvider.get(p.id) ?? 'Unknown') === 'Unknown').length,
            topAreas: countByKey(places).slice(0, 20),
        };
    }

    const activeListPrices: number[] = [];
    const pricesByCategory = new Map<string, number[]>();
    const priceBucketKeys: string[] = [];
    let adminUnpaidServices = 0;

    for (const service of input.services) {
        if (service.archived || !service.active) continue;
        if (isAdminUnpaidService(service.description)) adminUnpaidServices += 1;
        if (service.price == null || !(service.price > 0)) continue;
        activeListPrices.push(service.price);
        priceBucketKeys.push(priceBucketLabel(service.price));
        const catList = pricesByCategory.get(service.categoryName) ?? [];
        catList.push(service.price);
        pricesByCategory.set(service.categoryName, catList);
    }

    const completed = input.bookings.filter((b) => b.status === 'completed' && b.amount > 0);
    const completed90 = completed.filter((b) => {
        if (!b.createdAt) return false;
        const ms = Date.parse(b.createdAt);
        return Number.isFinite(ms) && ms >= cutoff90;
    });

    let completedRevenueAll = 0;
    let completedRevenue90d = 0;
    for (const b of completed) completedRevenueAll += b.amount;
    for (const b of completed90) completedRevenue90d += b.amount;

    const revenueByProvider = new Map<string, { amount: number; count: number }>();
    const revenueByArea = new Map<string, { amount: number; count: number }>();
    const revenueByCategory = new Map<string, { amount: number; count: number }>();
    const bookingsByArea = new Map<string, number>();

    for (const booking of completed) {
        const area = areaByProvider.get(booking.provider_id) ?? 'unknown';
        bookingsByArea.set(area, (bookingsByArea.get(area) ?? 0) + 1);

        const prevP = revenueByProvider.get(booking.provider_id) ?? { amount: 0, count: 0 };
        prevP.amount += booking.amount;
        prevP.count += 1;
        revenueByProvider.set(booking.provider_id, prevP);

        const prevA = revenueByArea.get(area) ?? { amount: 0, count: 0 };
        prevA.amount += booking.amount;
        prevA.count += 1;
        revenueByArea.set(area, prevA);

        const cat = booking.categoryName?.trim() || 'Uncategorized';
        const prevC = revenueByCategory.get(cat) ?? { amount: 0, count: 0 };
        prevC.amount += booking.amount;
        prevC.count += 1;
        revenueByCategory.set(cat, prevC);
    }

    const nameById = new Map(providers.map((p) => [p.id, p.name]));
    const topProviders = [...revenueByProvider.entries()]
        .map(([providerId, stats]) => ({
            providerId,
            name: nameById.get(providerId) ?? providerId,
            amount: stats.amount,
            count: stats.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15);

    let overTierProviders = 0;
    let zeroServiceProviders = 0;
    let withServicesZeroCompleted = 0;
    for (const provider of providers) {
        const list = (servicesByProvider.get(provider.id) ?? []).filter((s) => !s.archived);
        const activeCount = list.filter((s) => s.active).length;
        if (activeCount === 0) zeroServiceProviders += 1;
        const max = provider.service_tier_max ?? 0;
        if (max >= 0 && activeCount > max) overTierProviders += 1;
        if (activeCount > 0 && !revenueByProvider.has(provider.id)) {
            withServicesZeroCompleted += 1;
        }
    }

    // Supply = providers that actually have active services (not empty accounts)
    const supplyByArea = countByKey(
        providersWithActiveService.map((p) => areaByProvider.get(p.id) ?? 'Unknown')
    );
    const supplyDemand = supplyByArea.slice(0, 25).map((row) => {
        const completedBookings = bookingsByArea.get(row.key) ?? 0;
        const revenue = revenueByArea.get(row.key)?.amount ?? 0;
        return {
            area: row.key,
            providers: row.count,
            completedBookings,
            revenue,
            bookingsPerProvider: row.count > 0 ? Math.round((completedBookings / row.count) * 100) / 100 : null,
        };
    });

    const byCategory = [...pricesByCategory.entries()]
        .map(([category, prices]) => ({
            category,
            count: prices.length,
            ...percentiles(prices),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

    const inactiveProviders = providers.filter((p) => p.active === false).length;
    const notActivationPaid = providers.filter((p) => p.activation_paid !== true).length;

    const overall = percentiles(activeListPrices);

    return {
        generatedAt: now.toISOString(),
        snapshot: {
            totalProviders: providers.length,
            withLocation,
            withLocationPct: pct(withLocation, providers.length),
            activated,
            activatedPct: pct(activated, providers.length),
            withActiveService,
            withActiveServicePct: pct(withActiveService, providers.length),
            medianListPrice: overall.median,
            completedRevenueAll,
            completedRevenue90d,
            completedBookingsAll: completed.length,
            completedBookings90d: completed90.length,
        },
        location: {
            all: locationSlice(providers),
            withServices: locationSlice(providersWithActiveService),
        },
        listPrices: {
            buckets: countByKey(priceBucketKeys),
            overall,
            byCategory,
        },
        tiers: {
            byTier: countByKey(providers.map((p) => formatTierMax(p.service_tier_max))),
            overTierProviders,
            adminUnpaidServices,
            zeroServiceProviders,
        },
        bookingRevenue: {
            byArea: [...revenueByArea.entries()]
                .map(([key, v]) => ({ key, amount: v.amount, count: v.count }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 20),
            byCategory: [...revenueByCategory.entries()]
                .map(([key, v]) => ({ key, amount: v.amount, count: v.count }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 15),
            topProviders,
            withServicesZeroCompleted,
        },
        supplyDemand,
        health: {
            inactiveProviders,
            zeroServices: zeroServiceProviders,
            notActivationPaid,
            adminUnpaidServices,
        },
    };
}
