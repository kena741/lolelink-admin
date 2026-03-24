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
    return normalized;
}

export const fetchSettings = createAsyncThunk<
    Settings,
    void,
    { rejectValue: string }
>(
    'settings/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            // Try to fetch settings - handle case where table might be empty or have multiple rows
            let data: Record<string, unknown>[] = [];
            let error: { message?: string } | null = null;
            
            try {
                const result = await supabase
                    .from('settings')
                    .select('*')
                    .limit(1);
                data = (result.data as Record<string, unknown>[] | null) ?? [];
                error = result.error as { message?: string } | null;
            } catch (e) {
                // If legacy settings table fails, continue with defaults + app_settings payment
                console.warn('Settings table not accessible, falling back to defaults:', e);
            }

            if (error) {
                // If legacy settings table has RLS or schema issues, continue to app_settings payment
                console.warn('Settings fetch error (continuing with defaults):', error.message || error);
            }

            const settingsData = data?.[0] ?? {};

            // Parse settings from database
            const appSettings: AppSettings = {
                appColor: settingsData.appColor,
                appName: settingsData.appName,
                appVersion: settingsData.appVersion,
                extraCharge_GST: settingsData.extraCharge_GST,
                googleMapKey: settingsData.googleMapKey,
                minimum_amount_deposit: settingsData.minimum_amount_deposit,
                minimum_amount_withdraw: settingsData.minimum_amount_withdraw,
            };

            const generalSettings: GeneralSettings = {
                notification_server_key: settingsData.notification_server_key,
                phoneNumber: settingsData.phoneNumber,
                radius: settingsData.radius,
                referralAmount: settingsData.referralAmount,
                supportEmail: settingsData.supportEmail,
                supportURL: settingsData.supportURL,
            };

            const policySettings: PolicySettings = {
                aboutApp: settingsData.aboutApp,
                privacyPolicy: settingsData.privacyPolicy,
                termsAndConditions: settingsData.termsAndConditions,
            };

            // Only include chapa, telebirr, and wallet (legacy source from settings table)
            const paymentSettings: PaymentSettings = {};
            if (settingsData.chapa) {
                try {
                    paymentSettings.chapa = typeof settingsData.chapa === 'string' ? JSON.parse(settingsData.chapa) : settingsData.chapa;
                } catch {
                    paymentSettings.chapa = settingsData.chapa;
                }
            }
            if (settingsData.telebirr) {
                try {
                    paymentSettings.telebirr = typeof settingsData.telebirr === 'string' ? JSON.parse(settingsData.telebirr) : settingsData.telebirr;
                } catch {
                    paymentSettings.telebirr = settingsData.telebirr;
                }
            }
            if (settingsData.wallet) {
                try {
                    paymentSettings.wallet = typeof settingsData.wallet === 'string' ? JSON.parse(settingsData.wallet) : settingsData.wallet;
                } catch {
                    paymentSettings.wallet = settingsData.wallet;
                }
            }

            // Primary source for payment settings is app_settings(id='payment')
            const { data: appPaymentData } = await supabase
                .from('app_settings')
                .select('id, data')
                .eq('id', 'payment')
                .maybeSingle();

            const appPayment = parseObjectValue(appPaymentData?.data);
            if (appPayment.chapa && typeof appPayment.chapa === 'object') {
                paymentSettings.chapa = appPayment.chapa as PaymentSettings['chapa'];
            }
            if (appPayment.telebirr && typeof appPayment.telebirr === 'object') {
                paymentSettings.telebirr = appPayment.telebirr as PaymentSettings['telebirr'];
            }
            if (appPayment.wallet && typeof appPayment.wallet === 'object') {
                paymentSettings.wallet = appPayment.wallet as PaymentSettings['wallet'];
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

            const hasSettingsTableFields = Object.keys(updateData).length > 0;
            if (!hasSettingsTableFields) {
                const paymentSettings: PaymentSettings = normalizePaymentSettingsForStorage(updates.paymentSettings) || {};
                return {
                    appSettings: {},
                    generalSettings: {},
                    policySettings: {},
                    paymentSettings,
                };
            }

            // Try to update existing row first, if no rows exist, insert
            let existingData;
            try {
                const existingResult = await supabase
                    .from('settings')
                    .select('id')
                    .limit(1);
                existingData = existingResult.data?.[0];
            } catch (e) {
                // Table might not exist, will try to insert
                console.warn('Could not check existing settings:', e);
            }

            let result;
            if (existingData?.id) {
                // Update existing row
                const { data, error } = await supabase
                    .from('settings')
                    .update(updateData)
                    .eq('id', existingData.id)
                    .select()
                    .limit(1);
                
                if (error) {
                    console.error('Error updating settings:', error);
                    throw error;
                }
                result = data?.[0];
            } else {
                // Insert new row
                const { data, error } = await supabase
                    .from('settings')
                    .insert(updateData)
                    .select()
                    .limit(1);
                
                if (error) {
                    console.error('Error inserting settings:', error);
                    throw error;
                }
                result = data?.[0];
            }

            if (!result) {
                throw new Error('Failed to save settings');
            }

            // Return updated settings in same format as fetchSettings
            const appSettings: AppSettings = {
                appColor: result.appColor,
                appName: result.appName,
                appVersion: result.appVersion,
                extraCharge_GST: result.extraCharge_GST,
                googleMapKey: result.googleMapKey,
                minimum_amount_deposit: result.minimum_amount_deposit,
                minimum_amount_withdraw: result.minimum_amount_withdraw,
            };

            const generalSettings: GeneralSettings = {
                notification_server_key: result.notification_server_key,
                phoneNumber: result.phoneNumber,
                radius: result.radius,
                referralAmount: result.referralAmount,
                supportEmail: result.supportEmail,
                supportURL: result.supportURL,
            };

            const policySettings: PolicySettings = {
                aboutApp: result.aboutApp,
                privacyPolicy: result.privacyPolicy,
                termsAndConditions: result.termsAndConditions,
            };

            const paymentSettings: PaymentSettings = updates.paymentSettings || {};
            if (result.chapa) {
                try {
                    paymentSettings.chapa = typeof result.chapa === 'string' ? JSON.parse(result.chapa) : result.chapa;
                } catch {
                    paymentSettings.chapa = result.chapa;
                }
            }
            if (result.telebirr) {
                try {
                    paymentSettings.telebirr = typeof result.telebirr === 'string' ? JSON.parse(result.telebirr) : result.telebirr;
                } catch {
                    paymentSettings.telebirr = result.telebirr;
                }
            }
            if (result.wallet) {
                try {
                    paymentSettings.wallet = typeof result.wallet === 'string' ? JSON.parse(result.wallet) : result.wallet;
                } catch {
                    paymentSettings.wallet = result.wallet;
                }
            }

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

