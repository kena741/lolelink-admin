import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Banner {
    id: number;
    bannerName?: string;
    image?: string;
    createdAt?: string;
}

interface BannerState {
    banners: Banner[];
    loading: boolean;
    error: string | null;
}

const initialState: BannerState = {
    banners: [],
    loading: false,
    error: null,
};

// DB row shape
type BannerRow = {
    id: number;
    bannerName?: string;
    image?: string;
    created_at?: string;
};

const normalizeRows = (rows: BannerRow[] | null | undefined): Banner[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        bannerName: row.bannerName,
        image: row.image,
        createdAt: row.created_at,
    }));

export const fetchBanners = createAsyncThunk<
    Banner[],
    void,
    { rejectValue: string }
>(
    'banner/fetchBanners',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('banner')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return normalizeRows(data as BannerRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch banners';
            return rejectWithValue(msg);
        }
    }
);

export const createBanner = createAsyncThunk<
    Banner,
    { bannerName: string; image: string },
    { rejectValue: string }
>(
    'banner/createBanner',
    async (bannerData, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('banner')
                .insert({
                    bannerName: bannerData.bannerName,
                    image: bannerData.image,
                })
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as BannerRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create banner';
            return rejectWithValue(msg);
        }
    }
);

export const updateBanner = createAsyncThunk<
    Banner,
    { id: number; bannerName?: string; image?: string },
    { rejectValue: string }
>(
    'banner/updateBanner',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('banner')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as BannerRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update banner';
            return rejectWithValue(msg);
        }
    }
);

export const deleteBanner = createAsyncThunk<
    number,
    number,
    { rejectValue: string }
>(
    'banner/deleteBanner',
    async (id, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from('banner')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete banner';
            return rejectWithValue(msg);
        }
    }
);

const bannerSlice = createSlice({
    name: 'banner',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchBanners.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchBanners.fulfilled, (state, action) => {
                state.loading = false;
                state.banners = action.payload;
            })
            .addCase(fetchBanners.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch banners';
            })
            .addCase(createBanner.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createBanner.fulfilled, (state, action) => {
                state.loading = false;
                state.banners.unshift(action.payload);
            })
            .addCase(createBanner.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to create banner';
            })
            .addCase(updateBanner.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateBanner.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.banners.findIndex((banner) => banner.id === action.payload.id);
                if (index !== -1) {
                    state.banners[index] = action.payload;
                }
            })
            .addCase(updateBanner.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to update banner';
            })
            .addCase(deleteBanner.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteBanner.fulfilled, (state, action) => {
                state.loading = false;
                state.banners = state.banners.filter((banner) => banner.id !== action.payload);
            })
            .addCase(deleteBanner.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete banner';
            });
    },
});

export default bannerSlice.reducer;

