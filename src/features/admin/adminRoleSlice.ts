import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AdminRole, CreateRolePayload, UpdateRolePayload } from '../../../type/admin';

interface AdminRoleState {
    roles: AdminRole[];
    loading: boolean;
    error: string | null;
}

const initialState: AdminRoleState = {
    roles: [],
    loading: false,
    error: null,
};

export const fetchAdminRoles = createAsyncThunk<AdminRole[], void, { rejectValue: string }>(
    'adminRole/fetchAdminRoles',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/roles');
            const payload = (await response.json()) as { data?: AdminRole[]; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch roles');
            return payload.data ?? [];
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch roles';
            return rejectWithValue(message);
        }
    }
);

export const createAdminRole = createAsyncThunk<AdminRole, CreateRolePayload, { rejectValue: string }>(
    'adminRole/createAdminRole',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = (await response.json()) as { data?: AdminRole; error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to create role');
            if (!result.data) throw new Error('No role data returned');
            return result.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create role';
            return rejectWithValue(message);
        }
    }
);

export const updateAdminRole = createAsyncThunk<AdminRole, UpdateRolePayload, { rejectValue: string }>(
    'adminRole/updateAdminRole',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/roles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = (await response.json()) as { data?: AdminRole; error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to update role');
            if (!result.data) throw new Error('No role data returned');
            return result.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update role';
            return rejectWithValue(message);
        }
    }
);

export const deleteAdminRole = createAsyncThunk<string, string, { rejectValue: string }>(
    'adminRole/deleteAdminRole',
    async (id, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/roles', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const result = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to delete role');
            return id;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete role';
            return rejectWithValue(message);
        }
    }
);

const adminRoleSlice = createSlice({
    name: 'adminRole',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminRoles.pending, (state) => {
                if (state.roles.length === 0) state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminRoles.fulfilled, (state, action) => {
                state.loading = false;
                state.roles = action.payload;
            })
            .addCase(fetchAdminRoles.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Failed to fetch roles';
            })
            .addCase(createAdminRole.fulfilled, (state, action) => {
                state.roles = [...state.roles, action.payload].sort((a, b) => a.name.localeCompare(b.name));
            })
            .addCase(updateAdminRole.fulfilled, (state, action) => {
                const index = state.roles.findIndex((role) => role.id === action.payload.id);
                if (index >= 0) state.roles[index] = action.payload;
            })
            .addCase(deleteAdminRole.fulfilled, (state, action) => {
                state.roles = state.roles.filter((role) => role.id !== action.payload);
            });
    },
});

export default adminRoleSlice.reducer;
