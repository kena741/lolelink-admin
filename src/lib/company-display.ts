export interface ProviderCompany {
    id: string;
    providerId: string;
    name: string;
    companyName: string | null;
    website: string | null;
    industry: string | null;
    companySize: string | null;
    headquarters: string | null;
    founded: string | null;
    profileBio: string | null;
    bannerImage: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface ProviderCompanyVerification {
    providerType: string | null;
    companyVerificationStatus: string | null;
    companyLicenseUrl: string | null;
    companyRejectionReason: string | null;
}

function readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCompanyRow(row: Record<string, unknown>): ProviderCompany {
    return {
        id: String(row.id ?? ''),
        providerId: String(row.provider_id ?? ''),
        name: readString(row.name) ?? '—',
        companyName: readString(row.company_name),
        website: readString(row.website),
        industry: readString(row.industry),
        companySize: readString(row.company_size),
        headquarters: readString(row.headquarters),
        founded: readString(row.founded),
        profileBio: readString(row.profile_bio),
        bannerImage: readString(row.banner_image),
        createdAt: readString(row.created_at),
        updatedAt: readString(row.updated_at),
    };
}

export function normalizeProviderCompanyVerification(
    row: Record<string, unknown>
): ProviderCompanyVerification {
    return {
        providerType: readString(row.provider_type),
        companyVerificationStatus: readString(row.company_verification_status),
        companyLicenseUrl: readString(row.company_license_url),
        companyRejectionReason: readString(row.company_rejection_reason),
    };
}

export function formatProviderType(value: string | null): string {
    if (!value) return 'Individual';
    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function formatCompanyVerificationStatus(value: string | null): string {
    if (!value) return 'Not submitted';
    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function companyVerificationTone(
    value: string | null
): 'neutral' | 'warning' | 'success' | 'danger' {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'verified') return 'success';
    if (normalized === 'rejected') return 'danger';
    if (normalized === 'pending' || normalized === 'submitted' || normalized === 'in_review') {
        return 'warning';
    }
    return 'neutral';
}
