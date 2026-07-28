import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabaseClient";
import { logClientAdminActivity } from "@/lib/record-admin-activity";
import { buildChangeMetadata } from "@/lib/activity-log-changes";

export interface Provider {
    id: string;
    user_id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    userName?: string;
    phone?: string;
    phoneNumber?: string; // alternative field naming
    bannerImage?: string;
    companyName?: string;
    industry?: string;
    companySize?: string;
    headquarters?: string;
    founded?: string;
    address?: string;
    country?: string;
    countryCode?: string;
    country_code?: string;
    currency?: string;
    location?: Record<string, unknown> | null;
    profileBio?: string;
    slug?: string;
    userType?: string;
    walletAmount?: string;
    active?: boolean;
    fcmToken?: string;
    professionId?: string;
    categoryId?: string;
    socialLinks?: Record<string, unknown> | null;
    createdAt?: string;
    updateAt?: string;
    password?: string;
    profileImage?: string; // camelCase variant
    profile_image?: string; // snake_case variant
    avatar_url?: string; // common alternative
    banner?: string | null;
    activation_paid?: boolean;
    activation_paid_at?: string;
    activation_tx_ref?: string;
    service_tier_max?: number;
    service_tier_paid_at?: string;
    service_tier_tx_ref?: string;
    verified_subcategory_ids?: string[];
    archived_at?: string | null;
    provider_type?: string | null;
    company_verification_status?: string | null;
    company_license_url?: string | null;
    company_rejection_reason?: string | null;
    admin_note?: string | null;
}

export interface ProviderState {
    providers: Provider[];
    loading: boolean;
    error: string | null;
    selected: Provider | null;
    selectedLoading: boolean;
    services: Service[];
    servicesLoading: boolean;
    servicesError: string | null;
    serviceCounts: Record<string, number>;
}

export interface Service {
    id: string;
    provider_id?: string;
    name?: string; // generic name
    serviceName?: string; // alt field
    image?: string | null; // single image fallback
    image_url?: string | null;
    serviceImage?: string | string[] | null;
    images?: string[]; // list of images (preferred)
    image_urls?: string[]; // alt array
    serviceImages?: string[]; // alt array
    gallery?: string[]; // alt array
    description?: string | null;
    createdAt?: string;
    created_at?: string;
    slug?: string;
    price?: string;
    discount?: string;
    status?: boolean;
    feature?: boolean;
    type?: string;
    prePayment?: boolean;
    duration?: string;
}

const initialState: ProviderState = {
    providers: [],
    loading: false,
    error: null,
    selected: null,
    selectedLoading: false,
    services: [],
    servicesLoading: false,
    servicesError: null,
    serviceCounts: {},
};

// Shape returned by Supabase (snake_case) with minimal typing
type ProviderRow = Omit<Provider, 'createdAt'> & { created_at?: string; createdAt?: string };

export const fetchProviders = createAsyncThunk(
    "provider/fetchProviders",
    async (_, { rejectWithValue }) => {
        const { data, error } = await getSupabase().from("provider").select("*");
        if (error) return rejectWithValue(error.message);
        // Normalize snake_case -> camelCase for createdAt
        const normalized: Provider[] = ((data as ProviderRow[] | null) ?? []).map((p) => {
            const { created_at, ...rest } = p;
            const row = rest as Record<string, unknown>;
            const archived_at =
                (typeof row.archived_at === "string" ? row.archived_at : null)
                ?? (typeof row.archivedAt === "string" ? row.archivedAt : null);
            return {
                ...rest,
                createdAt: created_at ?? p.createdAt,
                archived_at,
            } as Provider;
        });
        return normalized;
    }
);

export const fetchProviderById = createAsyncThunk<Provider, string, { rejectValue: string }>(
    "provider/fetchProviderById",
    async (id, { rejectWithValue }) => {
        const { data, error } = await getSupabase().from("provider").select("*").eq("id", id).single();
        if (error) return rejectWithValue(error.message);
        type ProviderRow = Provider & { created_at?: string };
        const row = data as ProviderRow;
        const { created_at, ...rest } = row ?? ({} as ProviderRow);
        return { ...rest, createdAt: row?.createdAt ?? created_at } as Provider;
    }
);

type ServiceRow = {
    id: string;
    provider_id?: string;
    name?: string;
    serviceName?: string;
    image?: string | null;
    image_url?: string | null;
    serviceImage?: string | string[] | null;
    images?: string[];
    image_urls?: string[];
    serviceImages?: string[];
    gallery?: string[];
    description?: string | null;
    createdAt?: string;
    created_at?: string;
    slug?: string;
    price?: string;
    discount?: string;
    status?: boolean;
    feature?: boolean;
    type?: string;
    prePayment?: boolean;
    duration?: string;
};

const normalizeService = (rows: ServiceRow[] | null | undefined): Service[] =>
    (rows ?? []).map((r) => {
        const imagesArr =
            r.images ??
            r.image_urls ??
            r.serviceImages ??
            r.gallery ??
            (Array.isArray(r.serviceImage)
                ? r.serviceImage
                : r.serviceImage
                    ? [r.serviceImage]
                    : r.image
                        ? [r.image]
                        : r.image_url
                            ? [r.image_url]
                            : undefined);

        return {
            id: r.id,
            provider_id: r.provider_id,
            name: r.name ?? r.serviceName,
            serviceName: r.serviceName,
            image: imagesArr?.[0] ?? null,
            image_url: r.image_url ?? null,
            serviceImage: r.serviceImage ?? null,
            images: imagesArr,
            image_urls: r.image_urls,
            serviceImages: r.serviceImages,
            gallery: r.gallery,
            description: r.description ?? null,
            createdAt: r.createdAt ?? r.created_at,
            created_at: r.created_at,
            slug: r.slug,
            price: r.price,
            discount: r.discount,
            status: r.status ?? undefined,
            feature: r.feature,
            type: r.type,
            prePayment: r.prePayment,
            duration: r.duration,
        };
    });

export const fetchProviderServices = createAsyncThunk<
    Service[],
    string,
    { rejectValue: string }
>(
    "provider/fetchProviderServices",
    async (providerId, { rejectWithValue }) => {
        // Try singular 'service' table first
        let { data, error } = await getSupabase()
            .from("service")
            .select("*")
            .eq("provider_id", providerId);

        if (error) {
            // Fallback to plural 'services'
            const fallback = await getSupabase()
                .from("services")
                .select("*")
                .eq("provider_id", providerId);
            data = fallback.data;
            error = fallback.error;
        }

        if (error) return rejectWithValue(error.message);
        return normalizeService(data as ServiceRow[] | null | undefined);
    }
);

export const fetchServiceCountsByProvider = createAsyncThunk<
    Record<string, number>,
    void,
    { rejectValue: string }
>(
    "provider/fetchServiceCountsByProvider",
    async (_, { rejectWithValue }) => {
        // Try singular table
        const { data: counts1, error: e1 } = await getSupabase()
            .from("service")
            .select("provider_id, count:id", { count: "exact" });

        let countsData = counts1 as { provider_id: string; count: number }[] | null;
        let err = e1;

        if (err) {
            const { data: counts2, error: e2 } = await getSupabase()
                .from("services")
                .select("provider_id, count:id", { count: "exact" });
            countsData = counts2 as { provider_id: string; count: number }[] | null;
            err = e2;
        }

        if (err) return rejectWithValue(err.message);

        const map: Record<string, number> = {};
        (countsData ?? []).forEach((row) => {
            if (row.provider_id) map[row.provider_id] = (map[row.provider_id] ?? 0) + 1;
        });
        return map;
    }
);

const PROVIDER_UPDATE_KEYS = new Set([
    "firstName",
    "lastName",
    "phoneNumber",
    "address",
    "location",
    "banner",
    "profileImage",
    "profileBio",
    "companyName",
    "countryCode",
    "admin_note",
]);

function sanitizeProviderUpdates(updates: Partial<Provider>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
        if (PROVIDER_UPDATE_KEYS.has(key) && value !== undefined) {
            out[key] = value;
        }
    }
    return out;
}

export const updateProvider = createAsyncThunk<
    Provider,
    { id: string; updates: Partial<Provider> },
    { rejectValue: string }
>(
    "provider/updateProvider",
    async ({ id, updates }, { rejectWithValue }) => {
        const payload = sanitizeProviderUpdates(updates);
        if (Object.keys(payload).length === 0) {
            return rejectWithValue("No valid fields to update");
        }

        const { data: existingProvider, error: existingError } = await getSupabase()
            .from("provider")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (existingError) return rejectWithValue(existingError.message);
        if (!existingProvider) return rejectWithValue("Provider not found");

        const { data, error } = await getSupabase()
            .from("provider")
            .update(payload)
            .eq("id", id)
            .select("*")
            .single();
        if (error) return rejectWithValue(error.message);
    type ProviderRow = Provider & { created_at?: string };
    const row = data as ProviderRow;
        const { created_at, ...rest } = row ?? {};
        const updated = { ...rest, createdAt: row?.createdAt ?? created_at } as Provider;

        logClientAdminActivity({
            action: 'update',
            resource_type: 'provider',
            resource_id: id,
            summary: `Updated provider ${updated.firstName || updated.userName || id}`,
            metadata: buildChangeMetadata(
                existingProvider as Record<string, unknown>,
                updated as unknown as Record<string, unknown>,
                Object.keys(payload)
            ),
        });

        return updated;
    }
);

interface ActivationPaymentResponse {
    status: string;
    mode?: string;
    checkout_url?: string;
    provider_id: string;
    provider_name: string;
    activation_paid_at?: string;
    tx_ref: string;
    fee_amount: string;
    note?: string | null;
    error?: string;
}

export const initiateActivationPayment = createAsyncThunk<
    { checkout_url: string; tx_ref: string },
    { providerId: string; feeAmount: number },
    { rejectValue: string }
>(
    "provider/initiateActivationPayment",
    async ({ providerId, feeAmount }, { rejectWithValue }) => {
        const response = await fetch('/api/provider/activate-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId, mode: 'chapa', feeAmount }),
        });
        const payload = (await response.json()) as ActivationPaymentResponse;
        if (!response.ok || payload.status !== 'success' || !payload.checkout_url) {
            return rejectWithValue(payload.error || 'Failed to initialize Chapa checkout');
        }
        return { checkout_url: payload.checkout_url, tx_ref: payload.tx_ref };
    }
);

interface ActivationVerifyResponse {
    status: string;
    already_paid?: boolean;
    chapa_status?: string;
    message?: string;
    provider_id: string;
    activation_paid_at?: string;
    error?: string;
}

export const verifyActivationPayment = createAsyncThunk<
    Provider,
    { providerId: string },
    { rejectValue: string }
>(
    "provider/verifyActivationPayment",
    async ({ providerId }, { rejectWithValue }) => {
        const response = await fetch('/api/provider/activate-payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId }),
        });
        const payload = (await response.json()) as ActivationVerifyResponse;
        if (!response.ok) {
            return rejectWithValue(payload.error || 'Verification failed');
        }
        if (payload.status === 'pending') {
            return rejectWithValue(payload.message || 'Payment not yet confirmed by Chapa');
        }
        const { data, error } = await getSupabase()
            .from("provider")
            .select("*")
            .eq("id", providerId)
            .single();
        if (error || !data) return rejectWithValue(error?.message || 'Failed to reload provider');
        type ProviderRow = Provider & { created_at?: string };
        const row = data as ProviderRow;
        const { created_at, ...rest } = row ?? {};
        return { ...rest, createdAt: row?.createdAt ?? created_at } as Provider;
    }
);

export const markActivationPaid = createAsyncThunk<
    Provider,
    { providerId: string; feeAmount: number; txRef?: string; note?: string },
    { rejectValue: string }
>(
    "provider/markActivationPaid",
    async ({ providerId, feeAmount, txRef, note }, { rejectWithValue }) => {
        const response = await fetch('/api/provider/activate-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId, mode: 'manual', feeAmount, txRef, note }),
        });
        const payload = (await response.json()) as ActivationPaymentResponse;
        if (!response.ok || payload.status !== 'success') {
            return rejectWithValue(payload.error || 'Failed to mark activation as paid');
        }
        const { data, error } = await getSupabase()
            .from("provider")
            .select("*")
            .eq("id", providerId)
            .single();
        if (error || !data) return rejectWithValue(error?.message || 'Failed to reload provider');
        type ProviderRow = Provider & { created_at?: string };
        const row = data as ProviderRow;
        const { created_at, ...rest } = row ?? {};
        return { ...rest, createdAt: row?.createdAt ?? created_at } as Provider;
    }
);

export const archiveProvider = createAsyncThunk<
    { providerId: string; archived_at: string },
    string,
    { rejectValue: string }
>("provider/archiveProvider", async (providerId, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "archive" }),
        });
        const result = (await res.json()) as { archived_at?: string; error?: string };
        if (!res.ok || !result.archived_at) {
            return rejectWithValue(result.error || "Failed to archive provider");
        }
        return { providerId, archived_at: result.archived_at };
    } catch {
        return rejectWithValue("Network error while archiving provider");
    }
});

export const restoreProvider = createAsyncThunk<
    { providerId: string },
    string,
    { rejectValue: string }
>("provider/restoreProvider", async (providerId, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restore" }),
        });
        const result = (await res.json()) as { error?: string };
        if (!res.ok) return rejectWithValue(result.error || "Failed to restore provider");
        return { providerId };
    } catch {
        return rejectWithValue("Network error while restoring provider");
    }
});

export const deleteProvider = createAsyncThunk<string, string, { rejectValue: string }>(
    "provider/deleteProvider",
    async (providerId, { rejectWithValue }) => {
        try {
            const res = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}`, {
                method: "DELETE",
            });
            const result = (await res.json()) as { error?: string };
            if (!res.ok) return rejectWithValue(result.error || "Failed to delete provider");
            return providerId;
        } catch {
            return rejectWithValue("Network error while deleting provider");
        }
    }
);

export const createService = createAsyncThunk<
    Service,
    { provider_id: string; values: Partial<Service> },
    { rejectValue: string }
>(
    "provider/createService",
    async ({ provider_id, values }, { rejectWithValue }) => {
        const base = { provider_id, ...values } as Record<string, unknown>;
        // Prefer 'images' array if provided as comma separated string in serviceImage
        if (typeof values.serviceImage === 'string') {
            base.images = [values.serviceImage];
        }
        try {
            const { data, error } = await getSupabase()
                .from("service")
                .insert(base)
                .select("*")
                .single();
            if (error) throw error;
            const created = normalizeService([data as ServiceRow])[0];
            logClientAdminActivity({
                action: 'create',
                resource_type: 'service',
                resource_id: created.id,
                summary: `Created service ${created.serviceName || created.id} for provider ${provider_id}`,
            });
            return created;
    } catch {
            const { data, error } = await getSupabase()
                .from("services")
                .insert(base)
                .select("*")
                .single();
            if (error) return rejectWithValue(error.message);
            const created = normalizeService([data as ServiceRow])[0];
            logClientAdminActivity({
                action: 'create',
                resource_type: 'service',
                resource_id: created.id,
                summary: `Created service ${created.serviceName || created.id} for provider ${provider_id}`,
            });
            return created;
        }
    }
);

export const updateService = createAsyncThunk<
    Service,
    { id: string; values: Partial<Service> },
    { rejectValue: string }
>(
    "provider/updateService",
    async ({ id, values }, { rejectWithValue }) => {
        const base = { ...values } as Record<string, unknown>;
        if (typeof values.serviceImage === 'string') {
            base.images = [values.serviceImage];
        }

        const { data: existing, error: existingError } = await getSupabase()
            .from('service')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (existingError) return rejectWithValue(existingError.message);
        if (!existing) return rejectWithValue('Service not found');

        try {
            const { data, error } = await getSupabase()
                .from("service")
                .update(base)
                .eq("id", id)
                .select("*")
                .single();
            if (error) throw error;
            const updated = normalizeService([data as ServiceRow])[0];
            logClientAdminActivity({
                action: 'update',
                resource_type: 'service',
                resource_id: id,
                summary: `Updated service ${updated.serviceName || id}`,
                metadata: buildChangeMetadata(
                    existing as Record<string, unknown>,
                    updated as unknown as Record<string, unknown>,
                    Object.keys(base)
                ),
            });
            return updated;
    } catch {
            const { data, error } = await getSupabase()
                .from("services")
                .update(base)
                .eq("id", id)
                .select("*")
                .single();
            if (error) return rejectWithValue(error.message);
            const updated = normalizeService([data as ServiceRow])[0];
            logClientAdminActivity({
                action: 'update',
                resource_type: 'service',
                resource_id: id,
                summary: `Updated service ${updated.serviceName || id}`,
                metadata: buildChangeMetadata(
                    existing as Record<string, unknown>,
                    updated as unknown as Record<string, unknown>,
                    Object.keys(base)
                ),
            });
            return updated;
        }
    }
);

const providerSlice = createSlice({
    name: "provider",
    initialState,
    reducers: {
        clearSelected(state) {
            state.selected = null;
        },
        clearServices(state) {
            state.services = [];
            state.servicesError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProviders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProviders.fulfilled, (state, action) => {
                state.loading = false;
                state.providers = action.payload;
            })
            .addCase(fetchProviders.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchProviderById.pending, (state) => {
                state.selectedLoading = true;
                state.selected = null;
                state.error = null;
            })
            .addCase(fetchProviderById.fulfilled, (state, action: PayloadAction<Provider>) => {
                state.selectedLoading = false;
                state.selected = action.payload;
            })
            .addCase(fetchProviderById.rejected, (state, action) => {
                state.selectedLoading = false;
                state.error = (action.payload as string) || 'Failed to load provider';
            })
            .addCase(fetchProviderServices.pending, (state) => {
                state.servicesLoading = true;
                state.servicesError = null;
                state.services = [];
            })
            .addCase(fetchProviderServices.fulfilled, (state, action: PayloadAction<Service[]>) => {
                state.servicesLoading = false;
                state.services = action.payload;
            })
            .addCase(fetchProviderServices.rejected, (state, action) => {
                state.servicesLoading = false;
                state.servicesError = (action.payload as string) || 'Failed to load services';
            })
            .addCase(fetchServiceCountsByProvider.fulfilled, (state, action: PayloadAction<Record<string, number>>) => {
                state.serviceCounts = action.payload;
            })
            .addCase(updateProvider.fulfilled, (state, action: PayloadAction<Provider>) => {
                state.selected = action.payload;
                const idx = state.providers.findIndex(p => p.id === action.payload.id);
                if (idx !== -1) state.providers[idx] = action.payload;
            })
            .addCase(verifyActivationPayment.fulfilled, (state, action: PayloadAction<Provider>) => {
                state.selected = action.payload;
                const idx = state.providers.findIndex(p => p.id === action.payload.id);
                if (idx !== -1) state.providers[idx] = action.payload;
            })
            .addCase(markActivationPaid.fulfilled, (state, action: PayloadAction<Provider>) => {
                state.selected = action.payload;
                const idx = state.providers.findIndex(p => p.id === action.payload.id);
                if (idx !== -1) state.providers[idx] = action.payload;
            })
            .addCase(createService.fulfilled, (state, action: PayloadAction<Service>) => {
                state.services.push(action.payload);
            })
            .addCase(updateService.fulfilled, (state, action: PayloadAction<Service>) => {
                const i = state.services.findIndex(s => s.id === action.payload.id);
                if (i !== -1) state.services[i] = action.payload;
            })
            .addCase(archiveProvider.fulfilled, (state, action) => {
                const { providerId, archived_at } = action.payload;
                const idx = state.providers.findIndex((p) => p.id === providerId);
                if (idx !== -1) {
                    state.providers[idx] = { ...state.providers[idx], archived_at };
                }
                if (state.selected?.id === providerId) {
                    state.selected = { ...state.selected, archived_at };
                }
            })
            .addCase(restoreProvider.fulfilled, (state, action) => {
                const { providerId } = action.payload;
                const idx = state.providers.findIndex((p) => p.id === providerId);
                if (idx !== -1) {
                    state.providers[idx] = { ...state.providers[idx], archived_at: null };
                }
                if (state.selected?.id === providerId) {
                    state.selected = { ...state.selected, archived_at: null };
                }
            })
            .addCase(deleteProvider.fulfilled, (state, action) => {
                const id = action.payload;
                state.providers = state.providers.filter((p) => p.id !== id);
                state.serviceCounts = { ...state.serviceCounts };
                delete state.serviceCounts[id];
                if (state.selected?.id === id) {
                    state.selected = null;
                }
            });
    },
});

export const { clearSelected, clearServices } = providerSlice.actions;
export default providerSlice.reducer;
