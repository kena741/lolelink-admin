import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

interface AppSettings {
    appColor?: string;
    appName?: string;
    appVersion?: string;
    extraCharge_GST?: boolean;
    googleMapKey?: string;
    minimum_amount_deposit?: string;
    minimum_amount_withdraw?: string;
}

interface GeneralSettings {
    notification_server_key?: string;
    phoneNumber?: string;
    radius?: string;
    referralAmount?: string;
    supportEmail?: string;
    supportURL?: string;
}

interface PolicySettings {
    aboutApp?: string;
    aboutAppZemenService?: string;
    aboutAppZemenProvider?: string;
    privacyPolicy?: string;
    termsAndConditions?: string;
}

interface PaymentSettings {
    chapa?: { name: string; enable: boolean; isActive?: boolean | number; [key: string]: string | boolean | number | undefined };
    telebirr?: { name: string; annld?: string; [key: string]: string | boolean | number | undefined };
    wallet?: { name: string; enable?: boolean; [key: string]: string | boolean | number | undefined };
    flutterWave?: { name: string; isActive?: boolean; isSandBox?: boolean; publicKey?: string; [key: string]: string | boolean | number | undefined };
}

interface ContactUsSettings {
    email?: string;
    address?: string;
    phoneNumber?: string;
    emailSubject?: string;
}

interface AdminCommissionSettings {
    isFix?: boolean;
    value?: string;
    active?: boolean;
}

interface BookingStatusOption {
    flag: string;
    name: string;
}

interface ConstantSettings {
    minimum_wallet_balance_to_keep?: string;
    provider_service_featured_request_fee_amount?: string;
    provider_activation_account_activation_fee_amount?: string;
    service_posting_tiers?: Array<{ total_price: number; max_services: number }>;
}

interface LanguageSetting {
    id?: string;
    code: string;
    name: string;
    active: boolean;
}

interface SettingsPayload {
    appSettings?: AppSettings;
    generalSettings?: GeneralSettings;
    policySettings?: PolicySettings;
    paymentSettings?: PaymentSettings;
    contactUs?: ContactUsSettings;
    adminCommission?: AdminCommissionSettings;
    statusOptions?: BookingStatusOption[];
    constants?: ConstantSettings;
    languageSettings?: LanguageSetting[];
    languageDeletedIds?: string[];
}

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            return parsed ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

function normalizePaymentSettingsForStorage(settings?: PaymentSettings): PaymentSettings | undefined {
    if (!settings) return settings;
    const normalized: PaymentSettings = { ...settings };
    if (normalized.chapa) {
        normalized.chapa = {
            ...normalized.chapa,
            enable: Boolean(normalized.chapa.enable),
            isActive: Boolean(normalized.chapa.isActive),
            isSandbox: Boolean(normalized.chapa.isSandbox),
        };
    }
    if (normalized.flutterWave) {
        normalized.flutterWave = {
            ...normalized.flutterWave,
            isActive: Boolean(normalized.flutterWave.isActive),
            isSandBox: Boolean(normalized.flutterWave.isSandBox),
        };
    }
    return normalized;
}

async function upsertSection(
    supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>,
    id: string,
    patch: Record<string, unknown>
): Promise<void> {
    const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('id, data')
        .eq('id', id)
        .maybeSingle();
    const merged = { ...parseObjectValue(existing?.data), ...patch };
    const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ id, data: merged }, { onConflict: 'id' });
    if (error) throw new Error(error.message || `Failed to update ${id}`);
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'settings:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const payload = (await request.json()) as SettingsPayload;

        const rootPatch: Record<string, unknown> = {
            ...(payload.appSettings ?? {}),
            ...(payload.generalSettings ?? {}),
            ...(payload.policySettings ?? {}),
        };
        if (Object.keys(rootPatch).length > 0) {
            await upsertSection(supabaseAdmin, 'settings', rootPatch);
        }

        if (payload.paymentSettings) {
            const normalizedPaymentSettings = normalizePaymentSettingsForStorage(payload.paymentSettings);
            await upsertSection(supabaseAdmin, 'payment', (normalizedPaymentSettings ?? {}) as Record<string, unknown>);
        }
        if (payload.policySettings && Object.keys(payload.policySettings).length > 0) {
            await upsertSection(supabaseAdmin, 'policy', payload.policySettings as Record<string, unknown>);
        }
        if (payload.contactUs && Object.keys(payload.contactUs).length > 0) {
            await upsertSection(supabaseAdmin, 'contact_us', payload.contactUs as Record<string, unknown>);
        }
        if (payload.adminCommission && Object.keys(payload.adminCommission).length > 0) {
            await upsertSection(supabaseAdmin, 'admin_commission', payload.adminCommission as Record<string, unknown>);
        }
        if (payload.statusOptions !== undefined) {
            const { error } = await supabaseAdmin
                .from('app_settings')
                .upsert({ id: 'status', data: payload.statusOptions }, { onConflict: 'id' });
            if (error) throw new Error(error.message || 'Failed to update status options');
        }
        if (payload.constants && Object.keys(payload.constants).length > 0) {
            await upsertSection(supabaseAdmin, 'constant', payload.constants as Record<string, unknown>);
        }

        if (payload.languageSettings !== undefined || (payload.languageDeletedIds?.length ?? 0) > 0) {
            const normalizedLanguages = (payload.languageSettings ?? [])
                .map((language) => ({
                    id: language.id,
                    code: language.code.trim(),
                    name: language.name.trim(),
                    active: language.active,
                }))
                .filter((language) => language.code.length > 0 && language.name.length > 0);

            const languageUpserts = normalizedLanguages
                .filter((language) => Boolean(language.id))
                .map((language) => ({
                    id: language.id as string,
                    code: language.code,
                    name: language.name,
                    active: language.active,
                }));
            const languageInserts = normalizedLanguages
                .filter((language) => !language.id)
                .map((language) => ({
                    code: language.code,
                    name: language.name,
                    active: language.active,
                }));
            const deleteIds = (payload.languageDeletedIds ?? []).filter((id) => id.trim().length > 0);

            if (languageUpserts.length > 0) {
                const { error } = await supabaseAdmin.from('languages').upsert(languageUpserts, { onConflict: 'id' });
                if (error) throw new Error(error.message || 'Failed to update languages');
            }
            if (languageInserts.length > 0) {
                const { error } = await supabaseAdmin.from('languages').insert(languageInserts);
                if (error) throw new Error(error.message || 'Failed to insert languages');
            }
            if (deleteIds.length > 0) {
                const { error } = await supabaseAdmin.from('languages').delete().in('id', deleteIds);
                if (error) throw new Error(error.message || 'Failed to delete languages');
            }
        }

        const { data: appRows, error: appError } = await supabaseAdmin.from('app_settings').select('id, data');
        if (appError) throw new Error(appError.message || 'Failed to reload app settings');
        const { data: languageRows, error: languageError } = await supabaseAdmin
            .from('languages')
            .select('id, code, name, active');
        if (languageError) throw new Error(languageError.message || 'Failed to reload languages');

        return NextResponse.json({ data: { appRows, languageRows } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update settings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
