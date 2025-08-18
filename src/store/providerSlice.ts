// Moved to src/features/provider/providerSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabaseClient";

export interface Provider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  country_code?: string;
  created_at?: string;
}

export interface ProviderState {
  providers: Provider[];
  loading: boolean;
  error: string | null;
}

const initialState: ProviderState = {
  providers: [],
  loading: false,
  error: null,
};

export const fetchProviders = createAsyncThunk(
  "provider/fetchProviders",
  async (_, { rejectWithValue }) => {
    const { data, error } = await supabase.from("providers").select("*");
    if (error) return rejectWithValue(error.message);
    return data || [];
  }
);

const providerSlice = createSlice({
  name: "provider",
  initialState,
  reducers: {},
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
      });
  },
});

export default providerSlice.reducer;
