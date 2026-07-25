import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Banner {
    id: number;
    bannerName?: string;
    image?: string;
    link?: string;
    active: boolean;
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
    link?: string;
    active?: boolean | null;
    created_at?: string;
};

const normalizeRows = (rows: BannerRow[] | null | undefined): Banner[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        bannerName: row.bannerName,
        image: row.image,
        link: row.link,
        active: row.active !== false,
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
            const response = await fetch('/api/banners');
            const payload = (await response.json()) as { data?: BannerRow[]; error?: string };
            if (!response.ok)
                throw new Error(payload.error || 'Failed to fetch banners');
            return normalizeRows(payload.data ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch banners';
            return rejectWithValue(msg);
        }
    }
);

export const createBanner = createAsyncThunk<
    Banner,
    { bannerName: string; image: string; link?: string; active?: boolean },
    { rejectValue: string }
>(
    'banner/createBanner',
    async (bannerData, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/banners', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bannerData),
            });
            const payload = (await response.json()) as { data?: BannerRow; error?: string };
            if (!response.ok || !payload.data)
                throw new Error(payload.error || 'Failed to create banner');
            return normalizeRows([payload.data])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create banner';
            return rejectWithValue(msg);
        }
    }
);

export const updateBanner = createAsyncThunk<
    Banner,
    { id: number; bannerName?: string; image?: string; link?: string; active?: boolean },
    { rejectValue: string }
>(
    'banner/updateBanner',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/banners', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, ...updates }),
            });
            const payload = (await response.json()) as { data?: BannerRow; error?: string };
            if (!response.ok || !payload.data)
                throw new Error(payload.error || 'Failed to update banner');
            return normalizeRows([payload.data])[0];
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
            const response = await fetch('/api/banners', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });
            const payload = (await response.json()) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok)
                throw new Error(payload.error || 'Failed to delete banner');
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

