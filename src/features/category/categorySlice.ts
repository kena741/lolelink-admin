import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Category {
    id: string;
    categoryName: string;
    image?: string;
    active: boolean;
}

interface CategoryState {
    categories: Category[];
    loading: boolean;
    error: string | null;
}

const initialState: CategoryState = {
    categories: [],
    loading: false,
    error: null,
};

// DB row shape
type CategoryRow = {
    id: string;
    categoryName: string;
    image?: string;
    active: boolean;
};

const normalizeRows = (rows: CategoryRow[] | null | undefined): Category[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        categoryName: row.categoryName,
        image: row.image,
        active: row.active ?? true,
    }));

export const fetchCategories = createAsyncThunk<
    Category[],
    void,
    { rejectValue: string }
>(
    'category/fetchCategories',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('category')
                .select('*')
                .order('categoryName', { ascending: true });

            if (error) throw error;
            return normalizeRows(data as CategoryRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch categories';
            return rejectWithValue(msg);
        }
    }
);

export const createCategory = createAsyncThunk<
    Category,
    { categoryName: string; image?: string; active?: boolean },
    { rejectValue: string }
>(
    'category/createCategory',
    async ({ categoryName, image, active = true }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('category')
                .insert({ categoryName, image, active })
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as CategoryRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create category';
            return rejectWithValue(msg);
        }
    }
);

export const updateCategory = createAsyncThunk<
    Category,
    { id: string; categoryName?: string; image?: string; active?: boolean },
    { rejectValue: string }
>(
    'category/updateCategory',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('category')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as CategoryRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update category';
            return rejectWithValue(msg);
        }
    }
);

export const deleteCategory = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>(
    'category/deleteCategory',
    async (id, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from('category')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete category';
            return rejectWithValue(msg);
        }
    }
);

const categorySlice = createSlice({
    name: 'category',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCategories.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
                state.loading = false;
                state.categories = action.payload;
            })
            .addCase(fetchCategories.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch categories';
            })
            .addCase(createCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createCategory.fulfilled, (state, action: PayloadAction<Category>) => {
                state.loading = false;
                state.categories.push(action.payload);
            })
            .addCase(createCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create category';
            })
            .addCase(updateCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
                state.loading = false;
                const index = state.categories.findIndex(cat => cat.id === action.payload.id);
                if (index !== -1) {
                    state.categories[index] = action.payload;
                }
            })
            .addCase(updateCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update category';
            })
            .addCase(deleteCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteCategory.fulfilled, (state, action: PayloadAction<string>) => {
                state.loading = false;
                state.categories = state.categories.filter(cat => cat.id !== action.payload);
            })
            .addCase(deleteCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to delete category';
            });
    },
});

export default categorySlice.reducer;

