import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabaseClient";

export interface Provider {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string; // alternative field naming
    address?: string;
    country_code?: string;
    createdAt?: string;
    profileImage?: string; // camelCase variant
    profile_image?: string; // snake_case variant
    avatar_url?: string; // common alternative
    banner?: string | null;
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
        const { data, error } = await supabase.from("provider").select("*");
        if (error) return rejectWithValue(error.message);
        // Normalize snake_case -> camelCase for createdAt
        const normalized: Provider[] = ((data as ProviderRow[] | null) ?? []).map((p) => {
            const { created_at, ...rest } = p;
            return {
                ...rest,
                createdAt: created_at ?? p.createdAt,
            } as Provider;
        });
        return normalized;
    }
);

export const fetchProviderById = createAsyncThunk<Provider, string, { rejectValue: string }>(
    "provider/fetchProviderById",
    async (id, { rejectWithValue }) => {
        const { data, error } = await supabase.from("provider").select("*").eq("id", id).single();
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
        let { data, error } = await supabase
            .from("service")
            .select("*")
            .eq("provider_id", providerId);

        if (error) {
            // Fallback to plural 'services'
            const fallback = await supabase
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
        const { data: counts1, error: e1 } = await supabase
            .from("service")
            .select("provider_id, count:id", { count: "exact" });

        let countsData = counts1 as { provider_id: string; count: number }[] | null;
        let err = e1;

        if (err) {
            const { data: counts2, error: e2 } = await supabase
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

export const updateProvider = createAsyncThunk<
    Provider,
    { id: string; updates: Partial<Provider> },
    { rejectValue: string }
>(
    "provider/updateProvider",
    async ({ id, updates }, { rejectWithValue }) => {
    const { data, error } = await supabase
            .from("provider")
            .update(updates)
            .eq("id", id)
            .select("*")
            .single();
        if (error) return rejectWithValue(error.message);
    type ProviderRow = Provider & { created_at?: string };
    const row = data as ProviderRow;
        const { created_at, ...rest } = row ?? {};
        return { ...rest, createdAt: row?.createdAt ?? created_at } as Provider;
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
            const { data, error } = await supabase
                .from("service")
                .insert(base)
                .select("*")
                .single();
            if (error) throw error;
            return normalizeService([data as ServiceRow])[0];
    } catch {
            const { data, error } = await supabase
                .from("services")
                .insert(base)
                .select("*")
                .single();
            if (error) return rejectWithValue(error.message);
            return normalizeService([data as ServiceRow])[0];
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
        try {
            const { data, error } = await supabase
                .from("service")
                .update(base)
                .eq("id", id)
                .select("*")
                .single();
            if (error) throw error;
            return normalizeService([data as ServiceRow])[0];
    } catch {
            const { data, error } = await supabase
                .from("services")
                .update(base)
                .eq("id", id)
                .select("*")
                .single();
            if (error) return rejectWithValue(error.message);
            return normalizeService([data as ServiceRow])[0];
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
                // update selected
                state.selected = action.payload;
                // update in list if present
                const idx = state.providers.findIndex(p => p.id === action.payload.id);
                if (idx !== -1) state.providers[idx] = action.payload;
            })
            .addCase(createService.fulfilled, (state, action: PayloadAction<Service>) => {
                state.services.push(action.payload);
            })
            .addCase(updateService.fulfilled, (state, action: PayloadAction<Service>) => {
                const i = state.services.findIndex(s => s.id === action.payload.id);
                if (i !== -1) state.services[i] = action.payload;
            });
    },
});

export const { clearSelected, clearServices } = providerSlice.actions;
export default providerSlice.reducer;
