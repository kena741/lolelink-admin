import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export interface Handyman {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    userName?: string;
    userType?: string;
    category?: string;
    subCategory?: string;
    profileImage?: string;
    providerId?: string;
    fcmToken?: string;
    countryCode?: string;
    address?: string;
    active?: boolean;
    isActive?: boolean;
    createdAt?: string;
    userId?: string;
    categoryId?: string;
    subCategoryId?: string;
    slug?: string;
}

interface HandymanState {
    handymen: Handyman[];
    loading: boolean;
    error: string | null;
}

const initialState: HandymanState = {
    handymen: [],
    loading: false,
    error: null,
};

// DB row shape
type HandymanRow = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    userName?: string;
    userType?: string;
    category?: string;
    subCategory?: string;
    profileImage?: string;
    provider_id?: string;
    fcmToken?: string;
    countryCode?: string;
    address?: string;
    active?: boolean;
    isActive?: boolean;
    createdAt?: string;
    user_id?: string;
    categoryld?: string;
    subCategoryld?: string;
    slug?: string;
};

const normalizeRows = (rows: HandymanRow[] | null | undefined): Handyman[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phoneNumber: row.phoneNumber,
        userName: row.userName,
        userType: row.userType,
        category: row.category,
        subCategory: row.subCategory,
        profileImage: row.profileImage,
        providerId: row.provider_id,
        fcmToken: row.fcmToken,
        countryCode: row.countryCode,
        address: row.address,
        active: row.active,
        isActive: row.isActive,
        createdAt: row.createdAt,
        userId: row.user_id,
        categoryId: row.categoryld,
        subCategoryId: row.subCategoryld,
        slug: row.slug,
    }));

export const fetchHandymen = createAsyncThunk<
    Handyman[],
    void,
    { rejectValue: string }
>(
    'handyman/fetchHandymen',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('handyman')
                .select('*')
                .order('createdAt', { ascending: false });

            if (error) throw error;
            return normalizeRows(data as HandymanRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch handymen';
            return rejectWithValue(msg);
        }
    }
);

export const createHandyman = createAsyncThunk<
    Handyman,
    Partial<Handyman>,
    { rejectValue: string }
>(
    'handyman/createHandyman',
    async (handymanData, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase()
                .from('handyman')
                .insert({
                    firstName: handymanData.firstName,
                    lastName: handymanData.lastName,
                    email: handymanData.email,
                    phoneNumber: handymanData.phoneNumber,
                    userName: handymanData.userName,
                    userType: handymanData.userType,
                    category: handymanData.category,
                    subCategory: handymanData.subCategory,
                    profileImage: handymanData.profileImage,
                    provider_id: handymanData.providerId,
                    fcmToken: handymanData.fcmToken,
                    countryCode: handymanData.countryCode,
                    address: handymanData.address,
                    active: handymanData.active,
                    isActive: handymanData.isActive,
                    user_id: handymanData.userId,
                    categoryld: handymanData.categoryId,
                    subCategoryld: handymanData.subCategoryId,
                    slug: handymanData.slug,
                })
                .select()
                .single();

            if (error) throw error;
            const created = normalizeRows([data as HandymanRow])[0];
            const displayName = [created.firstName, created.lastName].filter(Boolean).join(' ').trim();
            logClientAdminActivity({
                action: 'create',
                resource_type: 'handyman',
                resource_id: created.id,
                summary: `Created handyman ${displayName || created.id}`,
            });
            return created;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create handyman';
            return rejectWithValue(msg);
        }
    }
);

export const updateHandyman = createAsyncThunk<
    Handyman,
    { id: string } & Partial<Handyman>,
    { rejectValue: string }
>(
    'handyman/updateHandyman',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data: existing, error: existingError } = await getSupabase()
                .from('handyman')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;
            if (!existing) return rejectWithValue('Handyman not found');

            const updateData: Partial<HandymanRow> = {};
            if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
            if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.phoneNumber !== undefined) updateData.phoneNumber = updates.phoneNumber;
            if (updates.userName !== undefined) updateData.userName = updates.userName;
            if (updates.userType !== undefined) updateData.userType = updates.userType;
            if (updates.category !== undefined) updateData.category = updates.category;
            if (updates.subCategory !== undefined) updateData.subCategory = updates.subCategory;
            if (updates.profileImage !== undefined) updateData.profileImage = updates.profileImage;
            if (updates.providerId !== undefined) updateData.provider_id = updates.providerId;
            if (updates.fcmToken !== undefined) updateData.fcmToken = updates.fcmToken;
            if (updates.countryCode !== undefined) updateData.countryCode = updates.countryCode;
            if (updates.address !== undefined) updateData.address = updates.address;
            if (updates.active !== undefined) updateData.active = updates.active;
            if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
            if (updates.userId !== undefined) updateData.user_id = updates.userId;
            if (updates.categoryId !== undefined) updateData.categoryld = updates.categoryId;
            if (updates.subCategoryId !== undefined) updateData.subCategoryld = updates.subCategoryId;
            if (updates.slug !== undefined) updateData.slug = updates.slug;

            const { data, error } = await getSupabase()
                .from('handyman')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            const updated = normalizeRows([data as HandymanRow])[0];
            const displayName = [updated.firstName, updated.lastName].filter(Boolean).join(' ').trim();
            logClientAdminActivity({
                action: 'update',
                resource_type: 'handyman',
                resource_id: id,
                summary: `Updated handyman ${displayName || id}`,
                metadata: buildChangeMetadata(
                    existing as Record<string, unknown>,
                    updated as unknown as Record<string, unknown>,
                    Object.keys(updateData)
                ),
            });
            return updated;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update handyman';
            return rejectWithValue(msg);
        }
    }
);

export const deleteHandyman = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>(
    'handyman/deleteHandyman',
    async (id, { rejectWithValue }) => {
        try {
            const { data: existing, error: existingError } = await getSupabase()
                .from('handyman')
                .select('firstName, lastName')
                .eq('id', id)
                .maybeSingle();
            if (existingError) throw existingError;

            const { error } = await getSupabase()
                .from('handyman')
                .delete()
                .eq('id', id);

            if (error) throw error;
            const row = existing as HandymanRow | null;
            const displayName = row ? [row.firstName, row.lastName].filter(Boolean).join(' ').trim() : '';
            logClientAdminActivity({
                action: 'delete',
                resource_type: 'handyman',
                resource_id: id,
                summary: `Deleted handyman ${displayName || id}`,
            });
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete handyman';
            return rejectWithValue(msg);
        }
    }
);

const handymanSlice = createSlice({
    name: 'handyman',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchHandymen.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHandymen.fulfilled, (state, action: PayloadAction<Handyman[]>) => {
                state.loading = false;
                state.handymen = action.payload;
            })
            .addCase(fetchHandymen.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch handymen';
            })
            .addCase(createHandyman.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createHandyman.fulfilled, (state, action: PayloadAction<Handyman>) => {
                state.loading = false;
                state.handymen.unshift(action.payload);
            })
            .addCase(createHandyman.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create handyman';
            })
            .addCase(updateHandyman.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateHandyman.fulfilled, (state, action: PayloadAction<Handyman>) => {
                state.loading = false;
                const index = state.handymen.findIndex(h => h.id === action.payload.id);
                if (index !== -1) {
                    state.handymen[index] = action.payload;
                }
            })
            .addCase(updateHandyman.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update handyman';
            })
            .addCase(deleteHandyman.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteHandyman.fulfilled, (state, action: PayloadAction<string>) => {
                state.loading = false;
                state.handymen = state.handymen.filter(h => h.id !== action.payload);
            })
            .addCase(deleteHandyman.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to delete handyman';
            });
    },
});

export default handymanSlice.reducer;

