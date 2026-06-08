import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AdminActivityLog } from '../../../type/activity-log';

interface ActivityLogFilters {
    admin_id?: string;
    action?: string;
    resource_type?: string;
    limit?: number;
    offset?: number;
}

interface ActivityLogState {
    logs: AdminActivityLog[];
    total: number;
    loading: boolean;
    error: string | null;
}

const initialState: ActivityLogState = {
    logs: [],
    total: 0,
    loading: false,
    error: null,
};

export const fetchActivityLogs = createAsyncThunk<
    { data: AdminActivityLog[]; total: number },
    ActivityLogFilters | void,
    { rejectValue: string }
>(
    'activityLog/fetchActivityLogs',
    async (filters, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams();
            if (filters?.admin_id) params.set('admin_id', filters.admin_id);
            if (filters?.action) params.set('action', filters.action);
            if (filters?.resource_type) params.set('resource_type', filters.resource_type);
            if (filters?.limit) params.set('limit', String(filters.limit));
            if (filters?.offset) params.set('offset', String(filters.offset));

            const query = params.toString();
            const response = await fetch(`/api/admin/activity-logs${query ? `?${query}` : ''}`);
            const payload = (await response.json()) as {
                data?: AdminActivityLog[];
                total?: number;
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch activity logs');
            return {
                data: payload.data ?? [],
                total: payload.total ?? 0,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch activity logs';
            return rejectWithValue(message);
        }
    }
);

const activityLogSlice = createSlice({
    name: 'activityLog',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchActivityLogs.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchActivityLogs.fulfilled, (state, action) => {
                state.loading = false;
                state.logs = action.payload.data;
                state.total = action.payload.total;
            })
            .addCase(fetchActivityLogs.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Failed to fetch activity logs';
            });
    },
});

export default activityLogSlice.reducer;
