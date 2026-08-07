import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabaseClient";
import {
    getClientSupabaseTarget,
    getEdgeFunctionsBaseUrl,
} from "@/lib/supabase-env";

export interface Customer {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    gender?: string;
    ip_address?: string;
    country_code?: string;
    mobile_number?: string;
    phoneNumber?: string;
    phone?: string; // Legacy field, use mobile_number
    avatar?: string;
    created_at?: string;
    updated_at?: string;
    wallet_amount?: number;
    status?: string;
    flag?: string;
    password?: string;
    default_address?: {
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    } | null | string;
    customer_id?: string;
    promo_code?: string;
    updated_by_admin?: string;
    provider_id?: string; // Optional, may not be present
    address?: string; // Legacy field, use default_address
    last_request_at?: string | null; // Computed field, not from DB
    archived_at?: string | null;
    admin_note?: string | null;
}

interface CustomerListState {
    customers: Customer[];
    loading: boolean;
    error: string | null;
    success: boolean;
    convertingId: string | null;
    convertError: string | null;
    convertSuccess: boolean;
}

const initialState: CustomerListState = {
    customers: [],
    loading: false,
    error: null,
    success: false,
    convertingId: null,
    convertError: null,
    convertSuccess: false,
};

export const addCustomer = createAsyncThunk(
    "customer/addCustomer",
    async (customer: Customer, { rejectWithValue }) => {
        const { error } = await getSupabase().from("customer").insert(customer);
        if (error) return rejectWithValue(error.message);
        return true;
    }
);

export const addCustomerWithFunction = createAsyncThunk(
    "customer/addCustomerWithFunction",
    async (
        {
            first_name,
            last_name,
            email,
            phone,
            provider_id,
            address,
        }: {
            first_name: string;
            last_name: string;
            email?: string;
            phone: string;
            provider_id?: string;
            address?: string;
        },
        { rejectWithValue }
    ) => {
        const sessionRes = await getSupabase().auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) return rejectWithValue("User not authenticated");

        const password = Math.random().toString(36).slice(-8);

        const edgeBase = getEdgeFunctionsBaseUrl(getClientSupabaseTarget());
        const res = await fetch(`${edgeBase}/add_customer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                first_name,
                last_name,
                email,
                phone,
                password,
                provider_id,
                address,
            }),
        });

        const result = await res.json();

        if (!res.ok) {
            return rejectWithValue(result.error || "Failed to add customer");
        }

        return result;
    }
);

export const fetchCustomersByProviderId = createAsyncThunk(
    "customer/fetchCustomersByProviderId",
    async (provider_id: string, { rejectWithValue }) => {
        const { data: customers, error: customerError } = await getSupabase()
            .from("customer")
            .select("*")
            .eq("provider_id", provider_id);

        if (customerError) return rejectWithValue(customerError.message);
        if (!customers || customers.length === 0) return [] as Customer[];

        const customerIds = customers.map((c) => c.id).filter(Boolean) as string[];

        if (customerIds.length === 0) {
            return (customers as Customer[]).map((c) => ({ ...c, last_request_at: null }));
        }

        const { data: providers, error: providerError } = await getSupabase()
            .from("provider")
            .select("id")
            .in("id", customerIds);

        if (providerError) return rejectWithValue(providerError.message);

        const { data: bookings, error: bookingError } = await getSupabase()
            .from("booked_service")
            .select("customer_id, createdAt")
            .in("customer_id", customerIds);

        if (bookingError) return rejectWithValue(bookingError.message);

        const lastRequestMap: Record<string, string> = {};
        type BookingRow = { customer_id: string; createdAt: string };
        (bookings as BookingRow[] | null | undefined ?? []).forEach((b) => {
            const existing = lastRequestMap[b.customer_id];
            if (!existing || new Date(b.createdAt) > new Date(existing)) {
                lastRequestMap[b.customer_id] = b.createdAt;
            }
        });
        const providerIdSet = new Set(
            ((providers as Array<{ id: string }> | null | undefined) ?? [])
                .map((provider) => provider.id)
        );

        const enriched = (customers as Customer[]).map((c) => {
            // Parse default_address if it's a JSON string
            let defaultAddress = c.default_address;
            if (defaultAddress && typeof defaultAddress === 'string') {
                try {
                    defaultAddress = JSON.parse(defaultAddress);
                } catch {
                    // If parsing fails, keep as is
                    defaultAddress = null;
                }
            }
            
            return {
                ...c,
                provider_id: c.provider_id || (c.id && providerIdSet.has(c.id) ? c.id : undefined),
                archived_at: c.archived_at ?? (c as { archivedAt?: string | null }).archivedAt ?? null,
                default_address: defaultAddress,
                last_request_at: (c.id && lastRequestMap[c.id]) || null,
            };
        });

        return enriched;
    }
);

export const fetchAllCustomers = createAsyncThunk(
    "customer/fetchAllCustomers",
    async (_, { rejectWithValue }) => {
        const { data: customers, error } = await getSupabase().from("customer").select("*");
        if (error) return rejectWithValue(error.message);
        if (!customers || customers.length === 0) return [] as Customer[];

        const customerIds = customers.map((c) => c.id).filter(Boolean) as string[];
        if (customerIds.length === 0) {
            return (customers as Customer[]).map((c) => ({ ...c, last_request_at: null }));
        }

        const { data: providers, error: providerError } = await getSupabase()
            .from("provider")
            .select("id")
            .in("id", customerIds);

        if (providerError) return rejectWithValue(providerError.message);

        const { data: bookings, error: bookingError } = await getSupabase()
            .from("booked_service")
            .select("customer_id, createdAt")
            .in("customer_id", customerIds);

        if (bookingError) return rejectWithValue(bookingError.message);

        const lastRequestMap: Record<string, string> = {};
        type BookingRow = { customer_id: string; createdAt: string };
        (bookings as BookingRow[] | null | undefined ?? []).forEach((b) => {
            const existing = lastRequestMap[b.customer_id];
            if (!existing || new Date(b.createdAt) > new Date(existing)) {
                lastRequestMap[b.customer_id] = b.createdAt;
            }
        });
        const providerIdSet = new Set(
            ((providers as Array<{ id: string }> | null | undefined) ?? [])
                .map((provider) => provider.id)
        );

        const enriched = (customers as Customer[]).map((c) => {
            // Parse default_address if it's a JSON string
            let defaultAddress = c.default_address;
            if (defaultAddress && typeof defaultAddress === 'string') {
                try {
                    defaultAddress = JSON.parse(defaultAddress);
                } catch {
                    // If parsing fails, keep as is
                    defaultAddress = null;
                }
            }
            
            return {
                ...c,
                provider_id: c.provider_id || (c.id && providerIdSet.has(c.id) ? c.id : undefined),
                archived_at: c.archived_at ?? (c as { archivedAt?: string | null }).archivedAt ?? null,
                default_address: defaultAddress,
                last_request_at: (c.id && lastRequestMap[c.id]) || null,
            };
        });

        return enriched;
    }
);

export const convertToProvider = createAsyncThunk<
    { providerId: string },
    string,
    { rejectValue: string }
>(
    "customer/convertToProvider",
    async (customerId, { rejectWithValue }) => {
        try {
            const res = await fetch("/api/convert-to-provider", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId }),
            });
            const result = await res.json();
            if (!res.ok) {
                return rejectWithValue(result.error || "Failed to convert customer");
            }
            return { providerId: result.data.id as string };
        } catch {
            return rejectWithValue("Network error while converting customer");
        }
    }
);

export const archiveCustomer = createAsyncThunk<
    { customerId: string; archived_at: string },
    string,
    { rejectValue: string }
>("customer/archiveCustomer", async (customerId, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "archive" }),
        });
        const result = (await res.json()) as { archived_at?: string; error?: string };
        if (!res.ok || !result.archived_at) {
            return rejectWithValue(result.error || "Failed to archive customer");
        }
        return { customerId, archived_at: result.archived_at };
    } catch {
        return rejectWithValue("Network error while archiving customer");
    }
});

export const restoreCustomer = createAsyncThunk<
    { customerId: string },
    string,
    { rejectValue: string }
>("customer/restoreCustomer", async (customerId, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restore" }),
        });
        const result = (await res.json()) as { error?: string };
        if (!res.ok) return rejectWithValue(result.error || "Failed to restore customer");
        return { customerId };
    } catch {
        return rejectWithValue("Network error while restoring customer");
    }
});

export const deleteCustomer = createAsyncThunk<string, string, { rejectValue: string }>(
    "customer/deleteCustomer",
    async (customerId, { rejectWithValue }) => {
        try {
            const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
                method: "DELETE",
            });
            const result = (await res.json()) as { error?: string };
            if (!res.ok) return rejectWithValue(result.error || "Failed to delete customer");
            return customerId;
        } catch {
            return rejectWithValue("Network error while deleting customer");
        }
    }
);

const customerSlice = createSlice({
    name: "customer",
    initialState,
    reducers: {
        resetCustomerState: (state) => {
            state.loading = false;
            state.error = null;
            state.success = false;
        },
        resetConvertState: (state) => {
            state.convertingId = null;
            state.convertError = null;
            state.convertSuccess = false;
        },
        setCustomerAdminNote: (
            state,
            action: { payload: { id: string; admin_note: string | null } }
        ) => {
            const idx = state.customers.findIndex((c) => c.id === action.payload.id);
            if (idx !== -1) {
                state.customers[idx] = {
                    ...state.customers[idx],
                    admin_note: action.payload.admin_note,
                };
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCustomersByProviderId.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCustomersByProviderId.fulfilled, (state, action) => {
                state.loading = false;
                state.customers = action.payload as Customer[];
            })
            .addCase(fetchCustomersByProviderId.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchAllCustomers.pending, (state) => {
                if (state.customers.length === 0) state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllCustomers.fulfilled, (state, action) => {
                state.loading = false;
                state.customers = action.payload as Customer[];
            })
            .addCase(fetchAllCustomers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(addCustomer.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(addCustomer.fulfilled, (state) => {
                state.loading = false;
                state.success = true;
            })
            .addCase(addCustomer.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(addCustomerWithFunction.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(addCustomerWithFunction.fulfilled, (state) => {
                state.loading = false;
                state.success = true;
            })
            .addCase(addCustomerWithFunction.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(convertToProvider.pending, (state, action) => {
                state.convertingId = action.meta.arg;
                state.convertError = null;
                state.convertSuccess = false;
            })
            .addCase(convertToProvider.fulfilled, (state, action) => {
                state.convertingId = null;
                state.convertSuccess = true;
                const convertedId = action.meta.arg;
                state.customers = state.customers.filter((c) => c.id !== convertedId);
            })
            .addCase(convertToProvider.rejected, (state, action) => {
                state.convertingId = null;
                state.convertError = action.payload as string;
            })
            .addCase(archiveCustomer.fulfilled, (state, action) => {
                const { customerId, archived_at } = action.payload;
                const idx = state.customers.findIndex((c) => c.id === customerId);
                if (idx !== -1) {
                    state.customers[idx] = { ...state.customers[idx], archived_at };
                }
            })
            .addCase(restoreCustomer.fulfilled, (state, action) => {
                const { customerId } = action.payload;
                const idx = state.customers.findIndex((c) => c.id === customerId);
                if (idx !== -1) {
                    state.customers[idx] = { ...state.customers[idx], archived_at: null };
                }
            })
            .addCase(deleteCustomer.fulfilled, (state, action) => {
                const id = action.payload;
                state.customers = state.customers.filter((c) => c.id !== id);
            });
    },
});

export const { resetCustomerState, resetConvertState, setCustomerAdminNote } = customerSlice.actions;
export default customerSlice.reducer;
