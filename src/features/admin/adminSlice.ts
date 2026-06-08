import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AdminUser, CreateAdminPayload, UpdateAdminPayload } from '../../../type/admin';

interface AdminState {
    admins: AdminUser[];
    loading: boolean;
    error: string | null;
}

const initialState: AdminState = {
    admins: [],
    loading: false,
    error: null,
};

export const fetchAdmins = createAsyncThunk<AdminUser[], void, { rejectValue: string }>(
    'admin/fetchAdmins',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/admins');
            const payload = (await response.json()) as { data?: AdminUser[]; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch admins');
            return payload.data ?? [];
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch admins';
            return rejectWithValue(message);
        }
    }
);

export const createAdmin = createAsyncThunk<AdminUser, CreateAdminPayload, { rejectValue: string }>(
    'admin/createAdmin',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = (await response.json()) as { data?: AdminUser; error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to create admin');
            if (!result.data) throw new Error('No admin data returned');
            return result.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create admin';
            return rejectWithValue(message);
        }
    }
);

export const updateAdmin = createAsyncThunk<
    AdminUser,
    { id: string; updates: UpdateAdminPayload & { password?: string } },
    { rejectValue: string }
>(
    'admin/updateAdmin',
    async ({ id, updates }, { rejectWithValue }) => {
        try {
            const response = await fetch(`/api/admin/admins/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            const result = (await response.json()) as { data?: AdminUser; error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to update admin');
            if (!result.data) throw new Error('No admin data returned');
            return result.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update admin';
            return rejectWithValue(message);
        }
    }
);

export const deleteAdmin = createAsyncThunk<string, string, { rejectValue: string }>(
    'admin/deleteAdmin',
    async (id, { rejectWithValue }) => {
        try {
            const response = await fetch(`/api/admin/admins/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            const result = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to delete admin');
            return id;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete admin';
            return rejectWithValue(message);
        }
    }
);

const adminSlice = createSlice({
    name: 'admin',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdmins.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdmins.fulfilled, (state, action) => {
                state.loading = false;
                state.admins = action.payload;
            })
            .addCase(fetchAdmins.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Failed to fetch admins';
            })
            .addCase(createAdmin.fulfilled, (state, action) => {
                state.admins = [action.payload, ...state.admins];
            })
            .addCase(updateAdmin.fulfilled, (state, action) => {
                const index = state.admins.findIndex((admin) => admin.id === action.payload.id);
                if (index >= 0) state.admins[index] = { ...state.admins[index], ...action.payload };
            })
            .addCase(deleteAdmin.fulfilled, (state, action) => {
                state.admins = state.admins.filter((admin) => admin.id !== action.payload);
            });
    },
});

export default adminSlice.reducer;
