import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';
import { buildChangeMetadata } from '@/lib/activity-log-changes';
import { requestPushNotify } from '@/lib/push/requestPushNotify';

export interface VerifyDocument {
    id: string;
    providerId: string;
    providerName?: string;
    providerEmail?: string;
    documentId?: string;
    documentName?: string;
    documentImage?: string;
    isVerify: boolean | null;
    createdAt?: string;
    subCategoryName?: string;
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
    isVerify?: boolean | null;
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
        isVerify: row.isVerify ?? null,
        createdAt: row.createdAt,
    }));

async function fetchSubCategoryIdsForDocumentIds(documentIds: string[]): Promise<string[]> {
    const unique = [...new Set(documentIds.filter(Boolean))];
    if (unique.length === 0) return [];

    const { data: links, error } = await getSupabase()
        .from('sub_category_documents')
        .select('subCategoryId')
        .in('documentId', unique);

    if (error) throw error;

    const ids = new Set<string>();
    for (const row of links ?? []) {
        const subId = (row as { subCategoryId: string | null }).subCategoryId;
        if (subId) ids.add(subId);
    }
    return [...ids];
}

async function mergeProviderVerifiedSubcategoryIds(providerId: string, newIds: string[]): Promise<void> {
    const uniqueNew = [...new Set(newIds.filter(Boolean))];
    if (uniqueNew.length === 0) return;

    const { data: row, error: selectError } = await getSupabase()
        .from('provider')
        .select('verified_subcategory_ids')
        .eq('id', providerId)
        .single();

    if (selectError) throw selectError;

    const existingRaw = row as { verified_subcategory_ids: string[] | null } | null;
    const existing = Array.isArray(existingRaw?.verified_subcategory_ids)
        ? existingRaw.verified_subcategory_ids
        : [];

    const merged = [...new Set([...existing, ...uniqueNew])];

    const { error: updateError } = await getSupabase()
        .from('provider')
        .update({ verified_subcategory_ids: merged })
        .eq('id', providerId);

    if (updateError) throw updateError;
}

async function removeOrphanedVerifiedSubcategoryIds(
    providerId: string,
    documentId: string
): Promise<void> {
    const subIds = await fetchSubCategoryIdsForDocumentIds([documentId]);
    if (subIds.length === 0) return;

    const { data: links, error: linkError } = await getSupabase()
        .from('sub_category_documents')
        .select('documentId, subCategoryId')
        .in('subCategoryId', subIds);

    if (linkError) throw linkError;

    const { data: approvedRows, error: approvedError } = await getSupabase()
        .from('verify_documents')
        .select('documentId')
        .eq('providerId', providerId)
        .eq('isVerify', true);

    if (approvedError) throw approvedError;

    const approvedDocumentIds = new Set(
        (approvedRows ?? [])
            .map((row) => (row as { documentId: string | null }).documentId)
            .filter((id): id is string => Boolean(id))
    );

    const subIdsToRemove = subIds.filter((subId) => {
        const documentIdsInSub = (links ?? [])
            .filter((row) => (row as { subCategoryId: string | null }).subCategoryId === subId)
            .map((row) => (row as { documentId: string | null }).documentId)
            .filter((id): id is string => Boolean(id));

        return !documentIdsInSub.some((id) => approvedDocumentIds.has(id));
    });

    if (subIdsToRemove.length === 0) return;

    const { data: row, error: selectError } = await getSupabase()
        .from('provider')
        .select('verified_subcategory_ids')
        .eq('id', providerId)
        .single();

    if (selectError) throw selectError;

    const existingRaw = row as { verified_subcategory_ids: string[] | null } | null;
    const existing = Array.isArray(existingRaw?.verified_subcategory_ids)
        ? existingRaw.verified_subcategory_ids
        : [];

    const removeSet = new Set(subIdsToRemove);
    const next = existing.filter((id) => !removeSet.has(id));

    const { error: updateError } = await getSupabase()
        .from('provider')
        .update({ verified_subcategory_ids: next })
        .eq('id', providerId);

    if (updateError) throw updateError;
}

export const fetchVerifyDocuments = createAsyncThunk<
    VerifyDocument[],
    void,
    { rejectValue: string }
>(
    'verifyDocuments/fetchVerifyDocuments',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('verify_documents')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) throw error;

            // Fetch document names from documents table
            const documentIds = [...new Set((data || []).map((row: VerifyDocumentRow) => row.documentId).filter(Boolean))];
            const documentMap: Record<string, string> = {};
            const documentToSubCategoryName: Record<string, string> = {};
            
            if (documentIds.length > 0) {
                const { data: documents, error: docError } = await getSupabase()
                    .from('documents')
                    .select('id, name')
                    .in('id', documentIds);

                if (!docError && documents) {
                    documents.forEach((doc: { id: string; name?: string }) => {
                        documentMap[doc.id] = doc.name || 'Unknown Document';
                    });
                }

                // Fetch subcategory names via junction table
                const { data: links, error: linkError } = await getSupabase()
                    .from('sub_category_documents')
                    .select('documentId, subCategoryId')
                    .in('documentId', documentIds);

                if (linkError) {
                    throw linkError;
                }

                const subCategoryIds = [
                    ...new Set(
                        (links || [])
                            .map((row: { subCategoryId: string | null }) => row.subCategoryId)
                            .filter((id): id is string => Boolean(id))
                    ),
                ];

                if (subCategoryIds.length > 0) {
                    const { data: subCategories, error: subError } = await getSupabase()
                        .from('sub_category')
                        .select('id, subCategoryName')
                        .in('id', subCategoryIds);

                    if (!subError && subCategories) {
                        const subCategoryNameById: Record<string, string> = {};
                        subCategories.forEach((sub: { id: string; subCategoryName: string }) => {
                            subCategoryNameById[sub.id] = sub.subCategoryName;
                        });

                        (links || []).forEach((row: { documentId: string; subCategoryId: string | null }) => {
                            if (row.documentId && row.subCategoryId && subCategoryNameById[row.subCategoryId]) {
                                documentToSubCategoryName[row.documentId] =
                                    subCategoryNameById[row.subCategoryId];
                            }
                        });
                    }
                }
            }

            // Add document names to the normalized rows
            const normalized = normalizeRows(data as VerifyDocumentRow[]);
            return normalized.map(doc => ({
                ...doc,
                documentName: doc.documentId ? documentMap[doc.documentId] : undefined,
                subCategoryName: doc.documentId ? documentToSubCategoryName[doc.documentId] : undefined,
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
            const { data: existingDocument, error: existingError } = await getSupabase()
                .from('verify_documents')
                .select('id, isVerify, providerId, documentId')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;
            if (!existingDocument) return rejectWithValue('Document not found');

            const { data, error } = await getSupabase()
                .from('verify_documents')
                .update({ isVerify: true })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            const row = data as VerifyDocumentRow;

            try {
                const subIds = row.documentId
                    ? await fetchSubCategoryIdsForDocumentIds([row.documentId])
                    : [];
                await mergeProviderVerifiedSubcategoryIds(row.providerId, subIds);
            } catch (providerErr) {
                await getSupabase().from('verify_documents').update({ isVerify: null }).eq('id', id);
                const msg =
                    providerErr instanceof Error
                        ? providerErr.message
                        : 'Failed to update provider verified subcategories';
                return rejectWithValue(msg);
            }

            logClientAdminActivity({
                action: 'verify',
                resource_type: 'document',
                resource_id: id,
                summary: `Verified provider document ${id}`,
                metadata: {
                    ...buildChangeMetadata(
                        existingDocument as Record<string, unknown>,
                        row as Record<string, unknown>,
                        ['isVerify']
                    ),
                    provider_id: row.providerId,
                },
            });

            return normalizeRows([row])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to verify document';
            return rejectWithValue(msg);
        }
    }
);

export const rejectDocument = createAsyncThunk<
    VerifyDocument,
    { id: string; rejectionReason: string; providerName?: string; documentName?: string },
    { rejectValue: string }
>(
    'verifyDocuments/rejectDocument',
    async ({ id, rejectionReason, providerName, documentName }, { rejectWithValue }) => {
        try {
            const trimmedReason = rejectionReason.trim();
            if (!trimmedReason) return rejectWithValue('Rejection reason is required');

            const { data: existingDocument, error: existingError } = await getSupabase()
                .from('verify_documents')
                .select('id, isVerify, providerId, documentId')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;
            if (!existingDocument) return rejectWithValue('Document not found');

            const wasApproved = existingDocument.isVerify === true;
            const rowProviderId = (existingDocument as { providerId: string }).providerId;
            const rowDocumentId = (existingDocument as { documentId?: string | null }).documentId;

            const { data, error } = await getSupabase()
                .from('verify_documents')
                .update({ isVerify: false })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            if (wasApproved && rowProviderId && rowDocumentId) {
                try {
                    await removeOrphanedVerifiedSubcategoryIds(rowProviderId, rowDocumentId);
                } catch (providerErr) {
                    await getSupabase().from('verify_documents').update({ isVerify: true }).eq('id', id);
                    const msg =
                        providerErr instanceof Error
                            ? providerErr.message
                            : 'Failed to update provider verified subcategories';
                    return rejectWithValue(msg);
                }
            }

            const normalized = normalizeRows([data as VerifyDocumentRow])[0];

            logClientAdminActivity({
                action: 'reject',
                resource_type: 'document',
                resource_id: id,
                summary: wasApproved
                    ? `Revoked approval for provider document ${id}`
                    : `Rejected provider document ${id}`,
                metadata: {
                    ...buildChangeMetadata(
                        existingDocument as Record<string, unknown>,
                        data as Record<string, unknown>,
                        ['isVerify']
                    ),
                    provider_id: rowProviderId,
                    revoked_approval: wasApproved,
                    rejection_reason: trimmedReason,
                },
            });

            await requestPushNotify({
                providerId: rowProviderId,
                event: 'document_rejected',
                providerName: providerName ?? normalized.providerName ?? '',
                documentName: documentName ?? normalized.documentName ?? 'document',
                title: 'Document rejected',
                body: trimmedReason,
                rejectionReason: trimmedReason,
            });

            return normalized;
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
            const { data, error } = await getSupabase()
                .from('verify_documents')
                .update({ isVerify: true })
                .eq('providerId', providerId)
                .is('isVerify', null)
                .select();

            if (error) throw error;
            const rows = (data ?? []) as VerifyDocumentRow[];
            const rowIds = rows.map((r) => r.id);

            try {
                const docIds = [
                    ...new Set(rows.map((r) => r.documentId).filter((did): did is string => Boolean(did))),
                ];
                const subIds = await fetchSubCategoryIdsForDocumentIds(docIds);
                await mergeProviderVerifiedSubcategoryIds(providerId, subIds);
            } catch (providerErr) {
                if (rowIds.length > 0) {
                    await getSupabase().from('verify_documents').update({ isVerify: null }).in('id', rowIds);
                }
                const msg =
                    providerErr instanceof Error
                        ? providerErr.message
                        : 'Failed to update provider verified subcategories';
                return rejectWithValue(msg);
            }

            logClientAdminActivity({
                action: 'verify',
                resource_type: 'document',
                resource_id: providerId,
                summary: `Approved all pending documents for provider ${providerId}`,
                metadata: { count: rows.length },
            });

            return normalizeRows(rows);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to approve all documents';
            return rejectWithValue(msg);
        }
    }
);

export const reapproveAllRejectedDocuments = createAsyncThunk<
    VerifyDocument[],
    string,
    { rejectValue: string }
>(
    'verifyDocuments/reapproveAllRejectedDocuments',
    async (providerId, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('verify_documents')
                .update({ isVerify: true })
                .eq('providerId', providerId)
                .eq('isVerify', false)
                .select();

            if (error) throw error;
            const rows = (data ?? []) as VerifyDocumentRow[];
            const rowIds = rows.map((r) => r.id);

            try {
                const docIds = [
                    ...new Set(rows.map((r) => r.documentId).filter((did): did is string => Boolean(did))),
                ];
                const subIds = await fetchSubCategoryIdsForDocumentIds(docIds);
                await mergeProviderVerifiedSubcategoryIds(providerId, subIds);
            } catch (providerErr) {
                if (rowIds.length > 0) {
                    await getSupabase().from('verify_documents').update({ isVerify: false }).in('id', rowIds);
                }
                const msg =
                    providerErr instanceof Error
                        ? providerErr.message
                        : 'Failed to update provider verified subcategories';
                return rejectWithValue(msg);
            }

            logClientAdminActivity({
                action: 'verify',
                resource_type: 'document',
                resource_id: providerId,
                summary: `Re-approved rejected documents for provider ${providerId}`,
                metadata: { count: rows.length },
            });

            return normalizeRows(rows);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to re-approve rejected documents';
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
                if (state.documents.length === 0) state.loading = true;
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
            })
            .addCase(reapproveAllRejectedDocuments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(reapproveAllRejectedDocuments.fulfilled, (state, action: PayloadAction<VerifyDocument[]>) => {
                state.loading = false;
                action.payload.forEach((updatedDoc) => {
                    const index = state.documents.findIndex((doc) => doc.id === updatedDoc.id);
                    if (index !== -1) {
                        state.documents[index] = updatedDoc;
                    }
                });
            })
            .addCase(reapproveAllRejectedDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to re-approve rejected documents';
            });
    },
});

export default verifyDocumentsSlice.reducer;

