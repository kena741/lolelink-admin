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
    chapa?: { name: string; enable: boolean; isActive?: number; [key: string]: any };
    telebirr?: { name: string; annld?: string; [key: string]: any };
    wallet?: { name: string; enable?: boolean; [key: string]: any };
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

export const fetchSettings = createAsyncThunk<
    Settings,
    void,
    { rejectValue: string }
>(
    'settings/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            // Try to fetch settings - handle case where table might be empty or have multiple rows
            let data, error;
            
            try {
                const result = await supabase
                    .from('settings')
                    .select('*')
                    .limit(1);
                data = result.data;
                error = result.error;
            } catch (e) {
                // If table doesn't exist or any error, return empty settings
                console.warn('Settings table not accessible, returning empty settings:', e);
                return {
                    appSettings: {},
                    generalSettings: {},
                    policySettings: {},
                    paymentSettings: {},
                };
            }

            if (error) {
                // If table doesn't exist or RLS issue, return empty settings
                // 406 errors are common when table doesn't exist or RLS blocks access
                console.warn('Settings fetch error (returning empty settings):', error.message || error);
                return {
                    appSettings: {},
                    generalSettings: {},
                    policySettings: {},
                    paymentSettings: {},
                };
            }

            // If no data, return empty settings
            if (!data || data.length === 0) {
                return {
                    appSettings: {},
                    generalSettings: {},
                    policySettings: {},
                    paymentSettings: {},
                };
            }

            const settingsData = data[0];

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

            // Only include chapa, telebirr, and wallet
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
            const updateData: any = {};

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

            // Update payment settings
            if (updates.paymentSettings) {
                if (updates.paymentSettings.chapa) {
                    updateData.chapa = typeof updates.paymentSettings.chapa === 'object' 
                        ? JSON.stringify(updates.paymentSettings.chapa) 
                        : updates.paymentSettings.chapa;
                }
                if (updates.paymentSettings.telebirr) {
                    updateData.telebirr = typeof updates.paymentSettings.telebirr === 'object' 
                        ? JSON.stringify(updates.paymentSettings.telebirr) 
                        : updates.paymentSettings.telebirr;
                }
                if (updates.paymentSettings.wallet) {
                    updateData.wallet = typeof updates.paymentSettings.wallet === 'object' 
                        ? JSON.stringify(updates.paymentSettings.wallet) 
                        : updates.paymentSettings.wallet;
                }
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

            const paymentSettings: PaymentSettings = {};
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

