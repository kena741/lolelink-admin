import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface VerifyDocument {
    id: string;
    providerId: string;
    providerName?: string;
    providerEmail?: string;
    documentId?: string;
    documentName?: string;
    documentImage?: string;
    isVerify: boolean;
    createdAt?: string;
}

interface VerifyDocumentState {
    documents: VerifyDocument[];
    loading: boolean;
    error: string | null;
}

const initialState: VerifyDocumentState = {
    documents: [],
    loading: false,
    error: null,
};

// DB row shape from verify_documents table
type VerifyDocumentRow = {
    id: string;
    providerId: string;
    providerName?: string;
    providerEmail?: string;
    documentId?: string;
    documentName?: string;
    documentImage?: string;
    isVerify: boolean;
    createdAt?: string;
};

const normalizeRows = (rows: VerifyDocumentRow[] | null | undefined): VerifyDocument[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        providerId: row.providerId,
        providerName: row.providerName,
        providerEmail: row.providerEmail,
        documentId: row.documentId,
        documentName: row.documentName,
        documentImage: row.documentImage,
        isVerify: row.isVerify ?? false,
        createdAt: row.createdAt,
    }));

export const fetchVerifyDocuments = createAsyncThunk<
    VerifyDocument[],
    void,
    { rejectValue: string }
>(
    'verifyDocuments/fetchVerifyDocuments',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('verify_documents')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) throw error;

            // Fetch document names from documents table
            const documentIds = [...new Set((data || []).map((row: any) => row.documentId).filter(Boolean))];
            const documentMap: Record<string, string> = {};
            
            if (documentIds.length > 0) {
                const { data: documents, error: docError } = await supabase
                    .from('documents')
                    .select('id, name')
                    .in('id', documentIds);

                if (!docError && documents) {
                    documents.forEach((doc: any) => {
                        documentMap[doc.id] = doc.name || 'Unknown Document';
                    });
                }
            }

            // Add document names to the normalized rows
            const normalized = normalizeRows(data as VerifyDocumentRow[]);
            return normalized.map(doc => ({
                ...doc,
                documentName: doc.documentId ? documentMap[doc.documentId] : undefined,
            }));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch verify documents';
            return rejectWithValue(msg);
        }
    }
);

export const verifyDocument = createAsyncThunk<
    VerifyDocument,
    string,
    { rejectValue: string }
>(
    'verifyDocuments/verifyDocument',
    async (id, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('verify_documents')
                .update({ isVerify: true })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as VerifyDocumentRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to verify document';
            return rejectWithValue(msg);
        }
    }
);

export const rejectDocument = createAsyncThunk<
    VerifyDocument,
    string,
    { rejectValue: string }
>(
    'verifyDocuments/rejectDocument',
    async (id, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('verify_documents')
                .update({ isVerify: false })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as VerifyDocumentRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to reject document';
            return rejectWithValue(msg);
        }
    }
);

export const approveAllDocuments = createAsyncThunk<
    VerifyDocument[],
    string,
    { rejectValue: string }
>(
    'verifyDocuments/approveAllDocuments',
    async (providerId, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('verify_documents')
                .update({ isVerify: true })
                .eq('providerId', providerId)
                .eq('isVerify', false)
                .select();

            if (error) throw error;
            return normalizeRows(data as VerifyDocumentRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to approve all documents';
            return rejectWithValue(msg);
        }
    }
);

const verifyDocumentsSlice = createSlice({
    name: 'verifyDocuments',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchVerifyDocuments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVerifyDocuments.fulfilled, (state, action: PayloadAction<VerifyDocument[]>) => {
                state.loading = false;
                state.documents = action.payload;
            })
            .addCase(fetchVerifyDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch verify documents';
            })
            .addCase(verifyDocument.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(verifyDocument.fulfilled, (state, action: PayloadAction<VerifyDocument>) => {
                state.loading = false;
                const index = state.documents.findIndex(doc => doc.id === action.payload.id);
                if (index !== -1) {
                    state.documents[index] = action.payload;
                }
            })
            .addCase(verifyDocument.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to verify document';
            })
            .addCase(rejectDocument.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(rejectDocument.fulfilled, (state, action: PayloadAction<VerifyDocument>) => {
                state.loading = false;
                const index = state.documents.findIndex(doc => doc.id === action.payload.id);
                if (index !== -1) {
                    state.documents[index] = action.payload;
                }
            })
            .addCase(rejectDocument.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to reject document';
            })
            .addCase(approveAllDocuments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(approveAllDocuments.fulfilled, (state, action: PayloadAction<VerifyDocument[]>) => {
                state.loading = false;
                action.payload.forEach((updatedDoc) => {
                    const index = state.documents.findIndex(doc => doc.id === updatedDoc.id);
                    if (index !== -1) {
                        state.documents[index] = updatedDoc;
                    }
                });
            })
            .addCase(approveAllDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to approve all documents';
            });
    },
});

export default verifyDocumentsSlice.reducer;

