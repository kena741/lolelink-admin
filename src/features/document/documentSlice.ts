import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Document {
    id: string;
    name?: string;
    active?: boolean;
    description?: string;
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

interface DocumentRow {
    id: string;
    name?: string;
    active?: boolean;
    description?: string;
}

function readBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
    }
    return fallback;
}

const normalizeRows = (rows: DocumentRow[] | null | undefined): Document[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        active: readBoolean(row.active, false),
        description: row.description,
    }));

export const fetchDocuments = createAsyncThunk<
    Document[],
    void,
    { rejectValue: string }
>(
    'document/fetchDocuments',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/documents');
            const payload = (await response.json()) as { data?: DocumentRow[]; error?: string };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to fetch documents');
            }
            return normalizeRows(payload.data ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch documents';
            return rejectWithValue(msg);
        }
    }
);

export const createDocument = createAsyncThunk<
    Document,
    { name: string; active?: boolean; description?: string },
    { rejectValue: string }
>(
    'document/createDocument',
    async (documentData, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(documentData),
            });
            const payload = (await response.json()) as { data?: DocumentRow; error?: string };
            if (!response.ok || !payload.data) {
                throw new Error(payload.error || 'Failed to create document');
            }
            return normalizeRows([payload.data])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create document';
            return rejectWithValue(msg);
        }
    }
);

export const updateDocument = createAsyncThunk<
    Document,
    { id: string; name?: string; active?: boolean; description?: string },
    { rejectValue: string }
>(
    'document/updateDocument',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/admin/documents', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
            const payload = (await response.json()) as { data?: DocumentRow; error?: string };
            if (!response.ok || !payload.data) {
                throw new Error(payload.error || 'Failed to update document');
            }
            return normalizeRows([payload.data])[0];
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
            const response = await fetch('/api/admin/documents', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const payload = (await response.json()) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || 'Failed to delete document');
            }
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
                if (state.documents.length === 0) state.loading = true;
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
