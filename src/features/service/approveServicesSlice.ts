import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

interface ApproveServicesState {
    loading: boolean;
    error: string | null;
    success: boolean;
    updatedCount: number;
    services: unknown[];
}

const initialState: ApproveServicesState = {
    loading: false,
    error: null,
    success: false,
    updatedCount: 0,
    services: [],
};

// Fetch services (non-archived)
export const fetchServices = createAsyncThunk<unknown[], void, { rejectValue: string }>(
    'service/fetchServices',
    async (_, thunkAPI) => {
        try {
            const { data, error } = await supabase
                .from('service')
                .select('*')
                .eq('status', true)
                .neq('isArchived', true);

            if (error) return thunkAPI.rejectWithValue(error.message || 'Failed to fetch services');

            return (data || []) as unknown[];
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

// Fetch all non-archived services and set approved = true for them
// Approve all services for a given provider id
export const approveServicesByProvider = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/approveServicesByProvider',
    async (providerId, thunkAPI) => {
        try {
            if (!providerId) return thunkAPI.rejectWithValue('Missing provider id');

            // fetch ids of services for this provider that are not archived and not already approved
            const { data: services, error: fetchError } = await supabase
                .from('service')
                .select('id, approved')
                .eq('provider_id', providerId)
                .neq('isArchived', true);

            if (fetchError) return thunkAPI.rejectWithValue(fetchError.message || 'Failed to fetch services');

            type ServiceRow = { id?: string; approved?: boolean };
            const ids = (services || [])
                .filter((s: ServiceRow) => s && s.id && s.approved !== true)
                .map((s: ServiceRow) => s.id as string);

            if (ids.length === 0) {
                return 0; // nothing to update
            }

            const { error: updateError } = await supabase
                .from('service')
                .update({ approved: true })
                .in('id', ids);

            if (updateError) return thunkAPI.rejectWithValue(updateError.message || 'Failed to approve services');

            return ids.length;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

// Approve a single service by id
export const approveServiceById = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/approveServiceById',
    async (serviceId, thunkAPI) => {
        try {
            if (!serviceId) return thunkAPI.rejectWithValue('Missing service id');

            const { error: updateError } = await supabase
                .from('service')
                .update({ approved: true })
                .eq('id', serviceId);

            if (updateError) return thunkAPI.rejectWithValue(updateError.message || 'Failed to approve service');

            return 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

const approveServicesSlice = createSlice({
    name: 'approveServices',
    initialState,
    reducers: {
        resetApproveState(state) {
            state.loading = false;
            state.error = null;
            state.success = false;
            state.updatedCount = 0;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(approveServicesByProvider.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(approveServicesByProvider.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(approveServicesByProvider.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // single service approval handlers
        builder
            .addCase(approveServiceById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(approveServiceById.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(approveServiceById.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // fetchServices handlers
        builder
            .addCase(fetchServices.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchServices.fulfilled, (state, action) => {
                state.loading = false;
                state.services = action.payload;
            })
            .addCase(fetchServices.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { resetApproveState } = approveServicesSlice.actions;
export default approveServicesSlice.reducer;
