import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export interface CountryTax {
    id: number;
    country?: string;
    name?: string;
    value?: number;
    active?: boolean;
    type?: string; // 'percentage' or 'fixed'
    isFix?: boolean; // Keep for backward compatibility
    createdAt?: string;
}

interface TaxState {
    taxes: CountryTax[];
    loading: boolean;
    error: string | null;
}

const initialState: TaxState = {
    taxes: [],
    loading: false,
    error: null,
};

// DB row shape
type TaxRow = {
    id: number;
    country?: string;
    name?: string;
    value?: number;
    active?: boolean;
    type?: string;
    isFix?: boolean;
    created_at?: string;
};

const normalizeRows = (rows: TaxRow[] | null | undefined): CountryTax[] =>
    (rows ?? []).map((row) => {
        const parsedValue = row.value != null ? Number(row.value) : undefined;
        const type = row.type || (row.isFix ? 'fixed' : 'percentage');

        return {
            id: row.id,
            country: row.country,
            name: row.name,
            value: Number.isFinite(parsedValue) ? parsedValue : undefined,
            active: row.active ?? false,
            type,
            isFix: row.isFix ?? type === 'fixed',
            createdAt: row.created_at,
        };
    });

export const fetchTaxes = createAsyncThunk<
    CountryTax[],
    void,
    { rejectValue: string }
>(
    'tax/fetchTaxes',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('country_tax')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return normalizeRows(data as TaxRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch taxes';
            return rejectWithValue(msg);
        }
    }
);

export const createTax = createAsyncThunk<
    CountryTax,
    { country?: string; name?: string; value?: number; active?: boolean; type?: string },
    { rejectValue: string }
>(
    'tax/createTax',
    async (taxData, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('country_tax')
                .insert({
                    country: taxData.country,
                    name: taxData.name,
                    value: taxData.value,
                    active: taxData.active ?? false,
                    type: taxData.type || 'percentage',
                    isFix: taxData.type === 'fixed',
                })
                .select()
                .single();

            if (error) throw error;
            const created = normalizeRows([data as TaxRow])[0];
            logClientAdminActivity({
                action: 'create',
                resource_type: 'tax',
                resource_id: String(created.id),
                summary: `Created tax ${created.name || created.country || created.id}`,
            });
            return created;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create tax';
            return rejectWithValue(msg);
        }
    }
);

export const updateTax = createAsyncThunk<
    CountryTax,
    { id: number; country?: string; name?: string; value?: number; active?: boolean; type?: string },
    { rejectValue: string }
>(
    'tax/updateTax',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data: existing, error: existingError } = await getSupabase()
                .from('country_tax')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;
            if (!existing) return rejectWithValue('Tax not found');

            const { data, error } = await getSupabase()
                .from('country_tax')
                .update({
                    ...updates,
                    ...(updates.type != null ? { isFix: updates.type === 'fixed' } : {}),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            const updated = normalizeRows([data as TaxRow])[0];
            logClientAdminActivity({
                action: 'update',
                resource_type: 'tax',
                resource_id: String(id),
                summary: `Updated tax ${updated.name || updated.country || id}`,
                metadata: buildChangeMetadata(
                    existing as Record<string, unknown>,
                    updated as unknown as Record<string, unknown>,
                    Object.keys(updates)
                ),
            });
            return updated;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update tax';
            return rejectWithValue(msg);
        }
    }
);

export const deleteTax = createAsyncThunk<
    number,
    number,
    { rejectValue: string }
>(
    'tax/deleteTax',
    async (id, { rejectWithValue }) => {
        try {
            const { data: existing, error: existingError } = await getSupabase()
                .from('country_tax')
                .select('name, country')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;

            const { error } = await getSupabase()
                .from('country_tax')
                .delete()
                .eq('id', id);

            if (error) throw error;
            const row = existing as TaxRow | null;
            logClientAdminActivity({
                action: 'delete',
                resource_type: 'tax',
                resource_id: String(id),
                summary: `Deleted tax ${row?.name || row?.country || id}`,
            });
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete tax';
            return rejectWithValue(msg);
        }
    }
);

const taxSlice = createSlice({
    name: 'tax',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTaxes.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTaxes.fulfilled, (state, action: PayloadAction<CountryTax[]>) => {
                state.loading = false;
                state.taxes = action.payload;
            })
            .addCase(fetchTaxes.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch taxes';
            })
            .addCase(createTax.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createTax.fulfilled, (state, action: PayloadAction<CountryTax>) => {
                state.loading = false;
                state.taxes.unshift(action.payload);
            })
            .addCase(createTax.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create tax';
            })
            .addCase(updateTax.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateTax.fulfilled, (state, action: PayloadAction<CountryTax>) => {
                state.loading = false;
                const index = state.taxes.findIndex(t => t.id === action.payload.id);
                if (index !== -1) {
                    state.taxes[index] = action.payload;
                }
            })
            .addCase(updateTax.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update tax';
            })
            .addCase(deleteTax.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteTax.fulfilled, (state, action: PayloadAction<number>) => {
                state.loading = false;
                state.taxes = state.taxes.filter(t => t.id !== action.payload);
            })
            .addCase(deleteTax.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to delete tax';
            });
    },
});

export default taxSlice.reducer;

