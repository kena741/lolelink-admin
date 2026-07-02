import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildChangeMetadata } from '@/lib/activity-log-changes';
import {
    normalizeCompanyRow,
    normalizeProviderCompanyVerification,
} from '@/lib/company-display';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getProviderIdFromParams(
    params: Promise<RouteParams> | RouteParams
): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

function readOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

interface PatchCompanyBody {
    name?: string;
    companyName?: string | null;
    website?: string | null;
    industry?: string | null;
    companySize?: string | null;
    headquarters?: string | null;
    founded?: string | null;
    profileBio?: string | null;
    bannerImage?: string | null;
    companyVerificationStatus?: string | null;
    companyLicenseUrl?: string | null;
    companyRejectionReason?: string | null;
}

export async function GET(
    request: Request,
    context: { params: Promise<RouteParams> }
) {
    const auth = await requireAdminPermission(request, 'providers:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const providerId = await getProviderIdFromParams(context.params);
        if (!providerId) {
            return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
        }

        const { data: provider, error: providerError } = await supabaseAdmin
            .from('provider')
            .select(
                'id, provider_type, company_verification_status, company_license_url, company_rejection_reason'
            )
            .eq('id', providerId)
            .maybeSingle();

        if (providerError) {
            return NextResponse.json({ error: providerError.message }, { status: 500 });
        }
        if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const { data: companyRow, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('provider_id', providerId)
            .maybeSingle();

        if (companyError) {
            return NextResponse.json({ error: companyError.message }, { status: 500 });
        }

        return NextResponse.json({
            data: {
                company: companyRow
                    ? normalizeCompanyRow(companyRow as Record<string, unknown>)
                    : null,
                verification: normalizeProviderCompanyVerification(
                    provider as Record<string, unknown>
                ),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<RouteParams> }
) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const providerId = await getProviderIdFromParams(context.params);
        if (!providerId) {
            return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
        }

        const body = (await request.json()) as PatchCompanyBody;

        const { data: provider, error: providerError } = await supabaseAdmin
            .from('provider')
            .select(
                'id, firstName, lastName, userName, provider_type, company_verification_status, company_license_url, company_rejection_reason'
            )
            .eq('id', providerId)
            .maybeSingle();

        if (providerError) {
            return NextResponse.json({ error: providerError.message }, { status: 500 });
        }
        if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const providerUpdates: Record<string, string | null> = {};
        const verificationStatus = readOptionalString(body.companyVerificationStatus);
        const licenseUrl = readOptionalString(body.companyLicenseUrl);
        const rejectionReason = readOptionalString(body.companyRejectionReason);

        if (verificationStatus !== undefined) {
            providerUpdates.company_verification_status = verificationStatus;
        }
        if (licenseUrl !== undefined) {
            providerUpdates.company_license_url = licenseUrl;
        }
        if (rejectionReason !== undefined) {
            providerUpdates.company_rejection_reason = rejectionReason;
        }

        if (Object.keys(providerUpdates).length > 0) {
            const { error: providerUpdateError } = await supabaseAdmin
                .from('provider')
                .update(providerUpdates)
                .eq('id', providerId);

            if (providerUpdateError) {
                return NextResponse.json({ error: providerUpdateError.message }, { status: 500 });
            }
        }

        const { data: existingCompany, error: existingCompanyError } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('provider_id', providerId)
            .maybeSingle();

        if (existingCompanyError) {
            return NextResponse.json({ error: existingCompanyError.message }, { status: 500 });
        }

        const companyUpdates: Record<string, string | null> = {};
        const name = readOptionalString(body.name);
        const companyName = readOptionalString(body.companyName);
        const website = readOptionalString(body.website);
        const industry = readOptionalString(body.industry);
        const companySize = readOptionalString(body.companySize);
        const headquarters = readOptionalString(body.headquarters);
        const founded = readOptionalString(body.founded);
        const profileBio = readOptionalString(body.profileBio);
        const bannerImage = readOptionalString(body.bannerImage);

        if (name !== undefined) companyUpdates.name = name ?? 'Company';
        if (companyName !== undefined) companyUpdates.company_name = companyName;
        if (website !== undefined) companyUpdates.website = website;
        if (industry !== undefined) companyUpdates.industry = industry;
        if (companySize !== undefined) companyUpdates.company_size = companySize;
        if (headquarters !== undefined) companyUpdates.headquarters = headquarters;
        if (founded !== undefined) companyUpdates.founded = founded;
        if (profileBio !== undefined) companyUpdates.profile_bio = profileBio;
        if (bannerImage !== undefined) companyUpdates.banner_image = bannerImage;

        let companyRow: Record<string, unknown> | null = existingCompany as Record<string, unknown> | null;

        if (Object.keys(companyUpdates).length > 0) {
            if (existingCompany) {
                companyUpdates.updated_at = new Date().toISOString();
                const { data, error } = await supabaseAdmin
                    .from('companies')
                    .update(companyUpdates)
                    .eq('provider_id', providerId)
                    .select('*')
                    .single();

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                companyRow = data as Record<string, unknown>;
            } else {
                const insertName = name ?? companyName ?? 'Company';
                const { data, error } = await supabaseAdmin
                    .from('companies')
                    .insert({
                        provider_id: providerId,
                        name: insertName,
                        company_name: companyName ?? insertName,
                        website: website ?? null,
                        industry: industry ?? null,
                        company_size: companySize ?? null,
                        headquarters: headquarters ?? null,
                        founded: founded ?? null,
                        profile_bio: profileBio ?? null,
                        banner_image: bannerImage ?? null,
                    })
                    .select('*')
                    .single();

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                companyRow = data as Record<string, unknown>;
            }
        }

        const providerName =
            [provider.firstName, provider.lastName].filter(Boolean).join(' ').trim()
            || (provider.userName as string | undefined)?.trim()
            || providerId;

        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'provider',
            resource_id: providerId,
            summary: `Updated company profile for provider ${providerName}`,
            metadata: buildChangeMetadata(
                (existingCompany ?? {}) as Record<string, unknown>,
                (companyRow ?? {}) as Record<string, unknown>,
                Object.keys(companyUpdates)
            ),
        });

        const { data: updatedProvider } = await supabaseAdmin
            .from('provider')
            .select(
                'provider_type, company_verification_status, company_license_url, company_rejection_reason'
            )
            .eq('id', providerId)
            .maybeSingle();

        return NextResponse.json({
            data: {
                company: companyRow ? normalizeCompanyRow(companyRow) : null,
                verification: normalizeProviderCompanyVerification(
                    (updatedProvider ?? provider) as Record<string, unknown>
                ),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
