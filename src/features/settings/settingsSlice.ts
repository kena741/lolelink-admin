import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';

export interface AppSettings {
    appColor?: string;
    appName?: string;
    appVersion?: string;
    extraCharge_GST?: boolean;
    googleMapKey?: string;
    minimum_amount_deposit?: string;
    minimum_amount_withdraw?: string;
}

export interface GeneralSettings {
    notification_server_key?: string;
    phoneNumber?: string;
    radius?: string;
    referralAmount?: string;
    supportEmail?: string;
    supportURL?: string;
}

export interface PolicySettings {
    aboutApp?: string;
    aboutAppZemenService?: string;
    aboutAppZemenProvider?: string;
    privacyPolicy?: string;
    termsAndConditions?: string;
}

export interface PaymentSettings {
    chapa?: { name: string; enable: boolean; isActive?: boolean | number; [key: string]: string | boolean | number | undefined };
    telebirr?: { name: string; annld?: string; [key: string]: string | boolean | number | undefined };
    wallet?: { name: string; enable?: boolean; [key: string]: string | boolean | number | undefined };
    flutterWave?: { name: string; isActive?: boolean; isSandBox?: boolean; publicKey?: string; [key: string]: string | boolean | number | undefined };
}

export interface ContactUsSettings {
    email?: string;
    address?: string;
    phoneNumber?: string;
    emailSubject?: string;
}

export interface AdminCommissionSettings {
    isFix?: boolean;
    value?: string;
    active?: boolean;
}

export interface BookingStatusOption {
    flag: string;
    name: string;
}

export interface ServicePostingTierConstant {
    total_price: number;
    max_services: number;
}

export interface ConstantSettings {
    minimum_wallet_balance_to_keep?: string;
    provider_service_featured_request_fee_amount?: string;
    provider_activation_account_activation_fee_amount?: string;
    service_posting_tiers?: ServicePostingTierConstant[];
}

export interface LanguageSetting {
    id?: string;
    code: string;
    name: string;
    active: boolean;
}

export type LanguageSettings = LanguageSetting[];

export interface Settings {
    appSettings: AppSettings;
    generalSettings: GeneralSettings;
    policySettings: PolicySettings;
    paymentSettings: PaymentSettings;
    languageSettings?: LanguageSettings;
    contactUs?: ContactUsSettings;
    adminCommission?: AdminCommissionSettings;
    statusOptions?: BookingStatusOption[];
    constants?: ConstantSettings;
}

interface UpdateSettingsPayload extends Partial<Settings> {
    languageDeletedIds?: string[];
}

interface SettingsState {
    settings: Settings | null;
    loading: boolean;
    error: string | null;
}

const initialState: SettingsState = {
    settings: null,
    loading: false,
    error: null,
};

interface AppSettingsRow {
    id?: string;
    data?: unknown;
}

interface LanguageRow {
    id?: string;
    code?: string;
    name?: string;
    active?: boolean;
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

function readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function toChapaSettings(value: unknown): PaymentSettings['chapa'] | undefined {
    const objectValue = parseObjectValue(value);
    if (Object.keys(objectValue).length === 0)
        return undefined;
    const name = typeof objectValue.name === 'string' ? objectValue.name : 'Chapa';
    return {
        ...objectValue,
        name,
        enable: Boolean(objectValue.enable),
        isActive: typeof objectValue.isActive === 'boolean' || typeof objectValue.isActive === 'number'
            ? objectValue.isActive
            : undefined,
        isSandbox: Boolean(objectValue.isSandbox),
    };
}

function toFlutterWaveSettings(value: unknown): PaymentSettings['flutterWave'] | undefined {
    const objectValue = parseObjectValue(value);
    if (Object.keys(objectValue).length === 0)
        return undefined;
    const name = typeof objectValue.name === 'string' ? objectValue.name : 'Flutter Wave';
    return {
        ...objectValue,
        name,
        isActive: Boolean(objectValue.isActive),
        isSandBox: Boolean(objectValue.isSandBox),
    };
}

function toTelebirrSettings(value: unknown): PaymentSettings['telebirr'] | undefined {
    const objectValue = parseObjectValue(value);
    if (typeof objectValue.name !== 'string')
        return undefined;
    return {
        ...objectValue,
        name: objectValue.name,
    };
}

function toWalletSettings(value: unknown): PaymentSettings['wallet'] | undefined {
    const objectValue = parseObjectValue(value);
    if (typeof objectValue.name !== 'string')
        return undefined;
    return {
        ...objectValue,
        name: objectValue.name,
        enable: typeof objectValue.enable === 'boolean' ? objectValue.enable : undefined,
    };
}

function parseStatusOptions(data: unknown): BookingStatusOption[] | undefined {
    if (!Array.isArray(data))
        return undefined;
    const options = data
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
            flag: readString(item.flag) ?? '',
            name: readString(item.name) ?? '',
        }))
        .filter((item) => item.flag.length > 0);
    return options.length > 0 ? options : [];
}

function parseContactUs(data: Record<string, unknown>): ContactUsSettings {
    return {
        email: readString(data.email),
        address: readString(data.address),
        phoneNumber: readString(data.phoneNumber),
        emailSubject: readString(data.emailSubject),
    };
}

function parseAdminCommission(data: Record<string, unknown>): AdminCommissionSettings {
    return {
        isFix: readBoolean(data.isFix),
        value: readString(data.value),
        active: readBoolean(data.active),
    };
}

function parseServicePostingTiersConstant(data: unknown): ServicePostingTierConstant[] | undefined {
    if (!Array.isArray(data)) return undefined;
    const tiers: ServicePostingTierConstant[] = [];
    for (const row of data) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const record = row as Record<string, unknown>;
        const totalPrice =
            typeof record.total_price === 'number'
                ? record.total_price
                : typeof record.total_price === 'string'
                    ? Number.parseFloat(record.total_price)
                    : NaN;
        const maxServices =
            typeof record.max_services === 'number'
                ? record.max_services
                : typeof record.max_services === 'string'
                    ? Number.parseFloat(record.max_services)
                    : NaN;
        if (!Number.isFinite(totalPrice) || totalPrice <= 0 || !Number.isFinite(maxServices)) continue;
        tiers.push({
            total_price: Math.round(totalPrice * 100) / 100,
            max_services: Math.trunc(maxServices),
        });
    }
    return tiers.length > 0 ? tiers : undefined;
}

function parseConstants(data: Record<string, unknown>): ConstantSettings {
    return {
        minimum_wallet_balance_to_keep: readString(data.minimum_wallet_balance_to_keep),
        provider_service_featured_request_fee_amount: readString(data.provider_service_featured_request_fee_amount),
        provider_activation_account_activation_fee_amount: readString(data.provider_activation_account_activation_fee_amount),
        service_posting_tiers: parseServicePostingTiersConstant(data.service_posting_tiers),
    };
}

function readPolicyValue(value: unknown): string | undefined {
    const text = readString(value);
    if (!text)
        return undefined;
    const normalized = text.trim();
    if (normalized.length === 0)
        return undefined;
    if (normalized.startsWith('PASTE_') && normalized.endsWith('_HERE'))
        return undefined;
    return text;
}

function mergePolicyFields(policyRow: Record<string, unknown>, settingsRow: Record<string, unknown>): PolicySettings {
    const pick = (key: string) => readPolicyValue(policyRow[key]) ?? readPolicyValue(settingsRow[key]);
    return {
        aboutApp: pick('aboutApp'),
        aboutAppZemenService: pick('aboutAppZemenService') ?? pick('aboutApp'),
        aboutAppZemenProvider: pick('aboutAppZemenProvider'),
        privacyPolicy: pick('privacyPolicy'),
        termsAndConditions: pick('termsAndConditions'),
    };
}

function buildPaymentSettingsFromRow(paymentData: Record<string, unknown>): PaymentSettings {
    const paymentSettings: PaymentSettings = {};
    if (paymentData.chapa && typeof paymentData.chapa === 'object') {
        const chapaSettings = toChapaSettings(paymentData.chapa);
        if (chapaSettings)
            paymentSettings.chapa = chapaSettings;
    }
    if (paymentData.telebirr && typeof paymentData.telebirr === 'object') {
        const telebirrSettings = toTelebirrSettings(paymentData.telebirr);
        if (telebirrSettings)
            paymentSettings.telebirr = telebirrSettings;
    }
    if (paymentData.wallet && typeof paymentData.wallet === 'object') {
        const walletSettings = toWalletSettings(paymentData.wallet);
        if (walletSettings)
            paymentSettings.wallet = walletSettings;
    }
    if (paymentData.flutterWave && typeof paymentData.flutterWave === 'object') {
        const flutterWaveSettings = toFlutterWaveSettings(paymentData.flutterWave);
        if (flutterWaveSettings)
            paymentSettings.flutterWave = flutterWaveSettings;
    }
    return paymentSettings;
}

function parseLanguageRows(rows: LanguageRow[] | null): LanguageSettings {
    const languages: LanguageSettings = [];
    for (const row of rows ?? []) {
        const code = readString(row.code);
        const name = readString(row.name);
        if (!code || !name)
            continue;
        languages.push({
            id: readString(row.id),
            code,
            name,
            active: Boolean(row.active),
        });
    }
    return languages;
}

function buildSettingsFromRows(rows: AppSettingsRow[] | null, languageRows: LanguageRow[] | null): Settings {
    const byId: Record<string, Record<string, unknown>> = {};
    for (const row of rows ?? []) {
        if (row.id)
            byId[row.id] = parseObjectValue(row.data);
    }

    const rootSettings = byId.settings ?? {};
    const policyRow = byId.policy ?? {};

    const appSettings: AppSettings = {
        appColor: readString(rootSettings.appColor),
        appName: readString(rootSettings.appName),
        appVersion: readString(rootSettings.appVersion),
        extraCharge_GST: readBoolean(rootSettings.extraCharge_GST),
        googleMapKey: readString(rootSettings.googleMapKey),
        minimum_amount_deposit: readString(rootSettings.minimum_amount_deposit),
        minimum_amount_withdraw: readString(rootSettings.minimum_amount_withdraw),
    };

    const generalSettings: GeneralSettings = {
        notification_server_key: readString(rootSettings.notification_server_key),
        phoneNumber: readString(rootSettings.phoneNumber),
        radius: readString(rootSettings.radius),
        referralAmount: readString(rootSettings.referralAmount),
        supportEmail: readString(rootSettings.supportEmail),
        supportURL: readString(rootSettings.supportURL),
    };

    const policySettings = mergePolicyFields(policyRow, rootSettings);

    const paymentSettings = buildPaymentSettingsFromRow(byId.payment ?? {});

    const statusRaw = rows?.find((r) => r.id === 'status')?.data;
    const statusOptions = parseStatusOptions(statusRaw);

    const contactUsRow = byId.contact_us ?? {};
    const contactUs = Object.keys(contactUsRow).length > 0 ? parseContactUs(contactUsRow) : undefined;

    const adminRow = byId.admin_commission ?? {};
    const adminCommission = Object.keys(adminRow).length > 0 ? parseAdminCommission(adminRow) : undefined;

    const constantRow = byId.constant ?? {};
    const constants = Object.keys(constantRow).length > 0 ? parseConstants(constantRow) : undefined;
    const languageSettings = parseLanguageRows(languageRows);

    return {
        appSettings,
        generalSettings,
        policySettings,
        paymentSettings,
        languageSettings,
        ...(contactUs && Object.values(contactUs).some((v) => v !== undefined) ? { contactUs } : {}),
        ...(adminCommission && Object.values(adminCommission).some((v) => v !== undefined) ? { adminCommission } : {}),
        ...(statusOptions !== undefined ? { statusOptions } : {}),
        ...(constants && Object.values(constants).some((v) => v !== undefined) ? { constants } : {}),
    };
}

export const fetchSettings = createAsyncThunk<
    Settings,
    void,
    { rejectValue: string }
>(
    'settings/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            const { data: rows, error } = await getSupabase()
                .from('app_settings')
                .select('id, data');
            if (error)
                throw error;
            const { data: languageRows, error: languageError } = await getSupabase()
                .from('languages')
                .select('id, code, name, active');
            if (languageError)
                throw languageError;
            return buildSettingsFromRows(
                (rows as AppSettingsRow[]) ?? null,
                (languageRows as LanguageRow[]) ?? null
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch settings';
            return rejectWithValue(msg);
        }
    }
);

export const updateSettings = createAsyncThunk<
    Settings,
    UpdateSettingsPayload,
    { rejectValue: string }
>(
    'settings/updateSettings',
    async (updates, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            const payload = (await response.json()) as {
                error?: string;
                data?: {
                    appRows?: AppSettingsRow[] | null;
                    languageRows?: LanguageRow[] | null;
                };
            };
            if (!response.ok || !payload.data) {
                throw new Error(payload.error || 'Failed to update settings');
            }

            logClientAdminActivity({
                action: 'update',
                resource_type: 'settings',
                summary: 'Updated platform settings',
                metadata: {
                    sections: Object.keys(updates).filter((key) => updates[key as keyof UpdateSettingsPayload] !== undefined),
                },
            });

            return buildSettingsFromRows(
                payload.data.appRows ?? null,
                payload.data.languageRows ?? null
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update settings';
            return rejectWithValue(msg);
        }
    }
);

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
                state.loading = false;
                state.settings = action.payload;
            })
            .addCase(fetchSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch settings';
            })
            .addCase(updateSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
                state.loading = false;
                state.settings = action.payload;
            })
            .addCase(updateSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update settings';
            });
    },
});

export default settingsSlice.reducer;

