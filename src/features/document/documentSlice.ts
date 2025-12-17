import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Document {
    id: string;
    name?: string;
    active?: boolean;
}

interface DocumentState {
    documents: Document[];
    loading: boolean;
    error: string | null;
}

const initialState: DocumentState = {
    documents: [],
    loading: false,
    error: null,
};

// DB row shape
type DocumentRow = {
    id: string;
    name?: string;
    active?: boolean;
};

const normalizeRows = (rows: DocumentRow[] | null | undefined): Document[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        active: row.active ?? false,
    }));

export const fetchDocuments = createAsyncThunk<
    Document[],
    void,
    { rejectValue: string }
>(
    'document/fetchDocuments',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return normalizeRows(data as DocumentRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch documents';
            return rejectWithValue(msg);
        }
    }
);

export const createDocument = createAsyncThunk<
    Document,
    { name: string; active?: boolean },
    { rejectValue: string }
>(
    'document/createDocument',
    async (documentData, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .insert({
                    name: documentData.name,
                    active: documentData.active ?? true,
                })
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as DocumentRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create document';
            return rejectWithValue(msg);
        }
    }
);

export const updateDocument = createAsyncThunk<
    Document,
    { id: string; name?: string; active?: boolean },
    { rejectValue: string }
>(
    'document/updateDocument',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as DocumentRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update document';
            return rejectWithValue(msg);
        }
    }
);

export const deleteDocument = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>(
    'document/deleteDocument',
    async (id, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete document';
            return rejectWithValue(msg);
        }
    }
);

const documentSlice = createSlice({
    name: 'document',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDocuments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDocuments.fulfilled, (state, action) => {
                state.loading = false;
                state.documents = action.payload;
            })
            .addCase(fetchDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch documents';
            })
            .addCase(createDocument.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createDocument.fulfilled, (state, action) => {
                state.loading = false;
                state.documents.push(action.payload);
            })
            .addCase(createDocument.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to create document';
            })
            .addCase(updateDocument.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateDocument.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.documents.findIndex((doc) => doc.id === action.payload.id);
                if (index !== -1) {
                    state.documents[index] = action.payload;
                }
            })
            .addCase(updateDocument.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to update document';
            })
            .addCase(deleteDocument.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteDocument.fulfilled, (state, action) => {
                state.loading = false;
                state.documents = state.documents.filter((doc) => doc.id !== action.payload);
            })
            .addCase(deleteDocument.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete document';
            });
    },
});

export default documentSlice.reducer;

