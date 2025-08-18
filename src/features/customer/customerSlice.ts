import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabaseClient";

export interface Customer {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  address?: string;
  country_code?: string;
  provider_id: string;
  created_at?: string;
  last_request_at?: string | null;
}

interface CustomerListState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: CustomerListState = {
  customers: [],
  loading: false,
  error: null,
  success: false,
};

export const addCustomer = createAsyncThunk(
  "customer/addCustomer",
  async (customer: Customer, { rejectWithValue }) => {
    const { error } = await supabase.from("customer").insert(customer);
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
      provider_id: string;
      address?: string;
    },
    { rejectWithValue }
  ) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    if (!token) return rejectWithValue("User not authenticated");

    const password = Math.random().toString(36).slice(-8);

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add_customer`, {
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
    const { data: customers, error: customerError } = await supabase
      .from("customer")
      .select("*")
      .eq("provider_id", provider_id);

    if (customerError) return rejectWithValue(customerError.message);
    if (!customers || customers.length === 0) return [] as Customer[];

    const customerIds = customers.map((c) => c.id).filter(Boolean) as string[];

    if (customerIds.length === 0) {
      return (customers as Customer[]).map((c) => ({ ...c, last_request_at: null }));
    }

  const { data: bookings, error: bookingError } = await supabase
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

    const enriched = (customers as Customer[]).map((c) => ({
      ...c,
      last_request_at: (c.id && lastRequestMap[c.id]) || null,
    }));

    return enriched;
  }
);

export const fetchAllCustomers = createAsyncThunk(
  "customer/fetchAllCustomers",
  async (_, { rejectWithValue }) => {
    const { data: customers, error } = await supabase.from("customer").select("*");
    if (error) return rejectWithValue(error.message);
    if (!customers || customers.length === 0) return [] as Customer[];

    const customerIds = customers.map((c) => c.id).filter(Boolean) as string[];
    if (customerIds.length === 0) {
      return (customers as Customer[]).map((c) => ({ ...c, last_request_at: null }));
    }

  const { data: bookings, error: bookingError } = await supabase
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

    const enriched = (customers as Customer[]).map((c) => ({
      ...c,
      last_request_at: (c.id && lastRequestMap[c.id]) || null,
    }));

    return enriched;
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
        state.loading = true;
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
      });
  },
});

export const { resetCustomerState } = customerSlice.actions;
export default customerSlice.reducer;
