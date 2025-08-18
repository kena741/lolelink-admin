import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

interface DeleteServiceState {
    loading: boolean;
    error: string | null;
    success: boolean;
}

const initialState: DeleteServiceState = {
    loading: false,
    error: null,
    success: false,
};

export const deleteService = createAsyncThunk<string, string, { rejectValue: string }>(
    'service/deleteService',
    async (serviceId, thunkAPI) => {
        try {
            // 1. Check if the service exists
            const { data: found, error: fetchError } = await supabase
                .from('service')
                .select('*')
                .eq('id', serviceId)
                .single();

            if (fetchError || !found) {
                const msg = fetchError?.message || 'Service not found.';
                return thunkAPI.rejectWithValue(msg);
            }

            // 2. Check for references in booked_service
            const { data: bookings, error: bookingsError } = await supabase
                .from('booked_service')
                .select('id')
                .eq('service_id', serviceId);

            if (bookingsError) {
                return thunkAPI.rejectWithValue(bookingsError.message || 'Error checking bookings');
            }

            const isReferenced = Array.isArray(bookings) && bookings.length > 0;

            if (isReferenced) {
                // 3a. Soft delete instead (e.g., mark as archived)
                const { error: softDeleteError } = await supabase
                    .from('service')
                    .update({ isArchived: true })
                    .eq('id', serviceId);

                if (softDeleteError) {
                    return thunkAPI.rejectWithValue(softDeleteError.message || 'Soft delete failed');
                }

                return serviceId;
            } else {
                // 3b. Safe to delete normally
                const { error: deleteError } = await supabase
                    .from('service')
                    .delete()
                    .eq('id', serviceId);

                if (deleteError) {
                    return thunkAPI.rejectWithValue(deleteError.message || 'Delete failed');
                }

                return serviceId;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

const deleteServiceSlice = createSlice({
    name: 'deleteService',
    initialState,
    reducers: {
        resetDeleteServiceState(state) {
            state.loading = false;
            state.error = null;
            state.success = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(deleteService.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(deleteService.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
                state.success = true;
            })
            .addCase(deleteService.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to delete service';
                state.success = false;
            });
    },
});

export const { resetDeleteServiceState } = deleteServiceSlice.actions;
export default deleteServiceSlice.reducer;
