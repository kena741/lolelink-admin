import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

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
    privacyPolicy?: string;
    termsAndConditions?: string;
}

export interface PaymentSettings {
    chapa?: { name: string; enable: boolean; isActive?: boolean | number; [key: string]: string | boolean | number | undefined };
    telebirr?: { name: string; annld?: string; [key: string]: string | boolean | number | undefined };
    wallet?: { name: string; enable?: boolean; [key: string]: string | boolean | number | undefined };
}

export interface LanguageSettings {
    [key: string]: string;
}

export interface Settings {
    appSettings: AppSettings;
    generalSettings: GeneralSettings;
    policySettings: PolicySettings;
    paymentSettings: PaymentSettings;
    languageSettings?: LanguageSettings;
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
    return normalized;
}

function toChapaSettings(value: unknown): PaymentSettings['chapa'] | undefined {
    const objectValue = parseObjectValue(value);
    if (typeof objectValue.name !== 'string')
        return undefined;
    return {
        ...objectValue,
        name: objectValue.name,
        enable: Boolean(objectValue.enable),
        isActive: typeof objectValue.isActive === 'boolean' || typeof objectValue.isActive === 'number'
            ? objectValue.isActive
            : undefined,
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

export const fetchSettings = createAsyncThunk<
    Settings,
    void,
    { rejectValue: string }
>(
    'settings/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            const { data: appRootSettingsData } = await supabase
                .from('app_settings')
                .select('id, data')
                .eq('id', 'settings')
                .maybeSingle();
            const rootSettings = parseObjectValue((appRootSettingsData as AppSettingsRow | null)?.data);

            // Parse settings from database
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

            const policySettings: PolicySettings = {
                aboutApp: readString(rootSettings.aboutApp),
                privacyPolicy: readString(rootSettings.privacyPolicy),
                termsAndConditions: readString(rootSettings.termsAndConditions),
            };

            const paymentSettings: PaymentSettings = {};

            // Primary source for payment settings is app_settings(id='payment')
            const { data: appPaymentData } = await supabase
                .from('app_settings')
                .select('id, data')
                .eq('id', 'payment')
                .maybeSingle();

            const appPayment = parseObjectValue(appPaymentData?.data);
            if (appPayment.chapa && typeof appPayment.chapa === 'object') {
                const chapaSettings = toChapaSettings(appPayment.chapa);
                if (chapaSettings)
                    paymentSettings.chapa = chapaSettings;
            }
            if (appPayment.telebirr && typeof appPayment.telebirr === 'object') {
                const telebirrSettings = toTelebirrSettings(appPayment.telebirr);
                if (telebirrSettings)
                    paymentSettings.telebirr = telebirrSettings;
            }
            if (appPayment.wallet && typeof appPayment.wallet === 'object') {
                const walletSettings = toWalletSettings(appPayment.wallet);
                if (walletSettings)
                    paymentSettings.wallet = walletSettings;
            }

            return {
                appSettings,
                generalSettings,
                policySettings,
                paymentSettings,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch settings';
            return rejectWithValue(msg);
        }
    }
);

export const updateSettings = createAsyncThunk<
    Settings,
    Partial<Settings>,
    { rejectValue: string }
>(
    'settings/updateSettings',
    async (updates, { rejectWithValue }) => {
        try {
            const updateData: Record<string, string | number | boolean | null | undefined> = {};

            // Update app settings
            if (updates.appSettings) {
                Object.assign(updateData, updates.appSettings);
            }

            // Update general settings
            if (updates.generalSettings) {
                Object.assign(updateData, updates.generalSettings);
            }

            // Update policy settings
            if (updates.policySettings) {
                Object.assign(updateData, updates.policySettings);
            }

            // Update payment settings in app_settings(id='payment')
            if (updates.paymentSettings) {
                const normalizedPaymentSettings = normalizePaymentSettingsForStorage(updates.paymentSettings);
                const { data: existingPaymentSetting } = await supabase
                    .from('app_settings')
                    .select('id, data')
                    .eq('id', 'payment')
                    .maybeSingle();

                const existingPaymentData = parseObjectValue(existingPaymentSetting?.data);
                const nextPaymentData = {
                    ...existingPaymentData,
                    ...(normalizedPaymentSettings?.chapa ? { chapa: normalizedPaymentSettings.chapa } : {}),
                    ...(normalizedPaymentSettings?.telebirr ? { telebirr: normalizedPaymentSettings.telebirr } : {}),
                    ...(normalizedPaymentSettings?.wallet ? { wallet: normalizedPaymentSettings.wallet } : {}),
                };

                const { error: appSettingsError } = await supabase
                    .from('app_settings')
                    .upsert(
                        {
                            id: 'payment',
                            data: nextPaymentData,
                        },
                        { onConflict: 'id' }
                    );

                if (appSettingsError) {
                    console.error('Error updating app_settings payment:', appSettingsError);
                    throw appSettingsError;
                }
            }

            const hasRootSettingsFields = Object.keys(updateData).length > 0;
            if (!hasRootSettingsFields) {
                const paymentSettings: PaymentSettings = normalizePaymentSettingsForStorage(updates.paymentSettings) || {};
                return {
                    appSettings: {},
                    generalSettings: {},
                    policySettings: {},
                    paymentSettings,
                };
            }

            const { data: existingRootSettingsData } = await supabase
                .from('app_settings')
                .select('id, data')
                .eq('id', 'settings')
                .maybeSingle();
            const existingRootData = parseObjectValue((existingRootSettingsData as AppSettingsRow | null)?.data);
            const nextRootData = {
                ...existingRootData,
                ...updateData,
            };
            const { error: rootSettingsError } = await supabase
                .from('app_settings')
                .upsert(
                    {
                        id: 'settings',
                        data: nextRootData,
                    },
                    { onConflict: 'id' }
                );
            if (rootSettingsError) {
                console.error('Error updating app_settings root settings:', rootSettingsError);
                throw rootSettingsError;
            }

            // Return updated settings in same format as fetchSettings
            const appSettings: AppSettings = {
                appColor: readString(nextRootData.appColor),
                appName: readString(nextRootData.appName),
                appVersion: readString(nextRootData.appVersion),
                extraCharge_GST: readBoolean(nextRootData.extraCharge_GST),
                googleMapKey: readString(nextRootData.googleMapKey),
                minimum_amount_deposit: readString(nextRootData.minimum_amount_deposit),
                minimum_amount_withdraw: readString(nextRootData.minimum_amount_withdraw),
            };

            const generalSettings: GeneralSettings = {
                notification_server_key: readString(nextRootData.notification_server_key),
                phoneNumber: readString(nextRootData.phoneNumber),
                radius: readString(nextRootData.radius),
                referralAmount: readString(nextRootData.referralAmount),
                supportEmail: readString(nextRootData.supportEmail),
                supportURL: readString(nextRootData.supportURL),
            };

            const policySettings: PolicySettings = {
                aboutApp: readString(nextRootData.aboutApp),
                privacyPolicy: readString(nextRootData.privacyPolicy),
                termsAndConditions: readString(nextRootData.termsAndConditions),
            };

            const paymentSettings: PaymentSettings = normalizePaymentSettingsForStorage(updates.paymentSettings) || {};

            return {
                appSettings,
                generalSettings,
                policySettings,
                paymentSettings,
            };
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

