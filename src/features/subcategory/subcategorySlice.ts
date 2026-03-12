import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface SubCategory {
    id: string;
    subCategoryName: string;
    categoryId: string;
    categoryName?: string; // Joined from category table
}

interface SubCategoryState {
    subCategories: SubCategory[];
    loading: boolean;
    error: string | null;
    documentIdsBySubCategoryId: Record<string, string[]>;
}

const initialState: SubCategoryState = {
    subCategories: [],
    loading: false,
    error: null,
    documentIdsBySubCategoryId: {},
};

// DB row shape
type SubCategoryRow = {
    id: string;
    subCategoryName: string;
    categoryId: string;
    category?: {
        categoryName: string;
    };
};

const normalizeRows = (rows: SubCategoryRow[] | null | undefined): SubCategory[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        subCategoryName: row.subCategoryName,
        categoryId: row.categoryId,
        categoryName: row.category?.categoryName,
    }));

export const fetchSubCategories = createAsyncThunk<
    SubCategory[],
    void,
    { rejectValue: string }
>(
    'subcategory/fetchSubCategories',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('sub_category')
                .select(`
                    *,
                    category:categoryId (
                        categoryName
                    )
                `)
                .order('subCategoryName', { ascending: true });

            if (error) throw error;
            return normalizeRows(data as SubCategoryRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch subcategories';
            return rejectWithValue(msg);
        }
    }
);

const JUNCTION_TABLE = 'sub_category_documents';

export const fetchSubCategoryDocumentIds = createAsyncThunk<
    string[],
    string,
    { rejectValue: string }
>(
    'subcategory/fetchSubCategoryDocumentIds',
    async (subCategoryId, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from(JUNCTION_TABLE)
                .select('documentId')
                .eq('subCategoryId', subCategoryId);

            if (error) throw error;
            return (data ?? []).map((row: { documentId: string }) => row.documentId);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch subcategory documents';
            return rejectWithValue(msg);
        }
    }
);

export const fetchAllSubCategoryDocumentIds = createAsyncThunk<
    Record<string, string[]>,
    void,
    { rejectValue: string }
>(
    'subcategory/fetchAllSubCategoryDocumentIds',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from(JUNCTION_TABLE)
                .select('id, subCategoryId, documentId');

            if (error) throw error;
            const bySub: Record<string, string[]> = {};
            for (const row of data ?? []) {
                const subId = (row as { subCategoryId: string }).subCategoryId;
                const docId = (row as { documentId: string }).documentId;
                if (!bySub[subId]) bySub[subId] = [];
                bySub[subId].push(docId);
            }
            return bySub;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch subcategory documents';
            return rejectWithValue(msg);
        }
    }
);

export const createSubCategory = createAsyncThunk<
    SubCategory,
    { subCategoryName: string; categoryId: string; documentIds?: string[] },
    { rejectValue: string }
>(
    'subcategory/createSubCategory',
    async ({ subCategoryName, categoryId, documentIds }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('sub_category')
                .insert({ subCategoryName, categoryId })
                .select(`
                    *,
                    category:categoryId (
                        categoryName
                    )
                `)
                .single();

            if (error) throw error;
            const subCategory = normalizeRows([data as SubCategoryRow])[0];
            if (subCategory.id && documentIds?.length) {
                const { error: junctionError } = await supabase
                    .from(JUNCTION_TABLE)
                    .insert(documentIds.map((documentId) => ({ subCategoryId: subCategory.id, documentId })));
                if (junctionError) throw junctionError;
            }
            return subCategory;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create subcategory';
            return rejectWithValue(msg);
        }
    }
);

export const updateSubCategory = createAsyncThunk<
    SubCategory,
    { id: string; subCategoryName?: string; categoryId?: string; documentIds?: string[] },
    { rejectValue: string }
>(
    'subcategory/updateSubCategory',
    async ({ id, documentIds, ...updates }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('sub_category')
                .update(updates)
                .eq('id', id)
                .select(`
                    *,
                    category:categoryId (
                        categoryName
                    )
                `)
                .single();

            if (error) throw error;
            if (documentIds !== undefined) {
                await supabase.from(JUNCTION_TABLE).delete().eq('subCategoryId', id);
                if (documentIds.length) {
                    const { error: junctionError } = await supabase
                        .from(JUNCTION_TABLE)
                        .insert(documentIds.map((documentId) => ({ subCategoryId: id, documentId })));
                    if (junctionError) throw junctionError;
                }
            }
            return normalizeRows([data as SubCategoryRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update subcategory';
            return rejectWithValue(msg);
        }
    }
);

export const deleteSubCategory = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>(
    'subcategory/deleteSubCategory',
    async (id, { rejectWithValue }) => {
        try {
            await supabase.from(JUNCTION_TABLE).delete().eq('subCategoryId', id);
            const { error } = await supabase
                .from('sub_category')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete subcategory';
            return rejectWithValue(msg);
        }
    }
);

const subcategorySlice = createSlice({
    name: 'subcategory',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSubCategories.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSubCategories.fulfilled, (state, action: PayloadAction<SubCategory[]>) => {
                state.loading = false;
                state.subCategories = action.payload;
            })
            .addCase(fetchSubCategories.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch subcategories';
            })
            .addCase(createSubCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createSubCategory.fulfilled, (state, action: PayloadAction<SubCategory>) => {
                state.loading = false;
                state.subCategories.push(action.payload);
            })
            .addCase(createSubCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create subcategory';
            })
            .addCase(updateSubCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateSubCategory.fulfilled, (state, action: PayloadAction<SubCategory>) => {
                state.loading = false;
                const index = state.subCategories.findIndex(sub => sub.id === action.payload.id);
                if (index !== -1) {
                    state.subCategories[index] = action.payload;
                }
            })
            .addCase(updateSubCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update subcategory';
            })
            .addCase(deleteSubCategory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteSubCategory.fulfilled, (state, action: PayloadAction<string>) => {
                state.loading = false;
                state.subCategories = state.subCategories.filter(sub => sub.id !== action.payload);
            })
            .addCase(deleteSubCategory.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to delete subcategory';
            })
            .addCase(fetchSubCategoryDocumentIds.fulfilled, (state, action) => {
                const subCategoryId = action.meta.arg;
                state.documentIdsBySubCategoryId[subCategoryId] = action.payload;
            })
            .addCase(fetchAllSubCategoryDocumentIds.fulfilled, (state, action) => {
                state.documentIdsBySubCategoryId = { ...state.documentIdsBySubCategoryId, ...action.payload };
            });
    },
});

export default subcategorySlice.reducer;

