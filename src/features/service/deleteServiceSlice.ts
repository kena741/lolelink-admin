import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';

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

/** Soft-archive only — never hard-delete (bookings/history keep service_id). */
export const deleteService = createAsyncThunk<string, string, { rejectValue: string }>(
    'service/deleteService',
    async (serviceId, thunkAPI) => {
        try {
            const { data: found, error: fetchError } = await getSupabase()
                .from('service')
                .select('id, serviceName, isArchived')
                .eq('id', serviceId)
                .single();

            if (fetchError || !found) {
                return thunkAPI.rejectWithValue(fetchError?.message || 'Service not found.');
            }

            if (found.isArchived === true) {
                return serviceId;
            }

            const { error: softDeleteError } = await getSupabase()
                .from('service')
                .update({
                    isArchived: true,
                    status: false,
                    active: false,
                })
                .eq('id', serviceId);

            if (softDeleteError) {
                return thunkAPI.rejectWithValue(softDeleteError.message || 'Archive failed');
            }

            const serviceName = typeof found.serviceName === 'string' ? found.serviceName : serviceId;
            const logged = await logClientAdminActivity({
                action: 'archive',
                resource_type: 'service',
                resource_id: serviceId,
                summary: `Archived service ${serviceName}`,
            });
            if (!logged) {
                return thunkAPI.rejectWithValue('Service archived, but failed to write admin activity log');
            }

            return serviceId;
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
                state.error = (action.payload as string) || 'Failed to archive service';
                state.success = false;
            });
    },
});

export const { resetDeleteServiceState } = deleteServiceSlice.actions;
export default deleteServiceSlice.reducer;
