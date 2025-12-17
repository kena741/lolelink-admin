import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Coupon {
    id: number;
    title?: string;
    code?: string;
    amount?: number;
    minAmount?: number;
    active?: boolean;
    isPrivate?: boolean;
    isFix?: boolean;
    expiredAt?: string;
    createdAt?: string;
}

interface CouponState {
    coupons: Coupon[];
    loading: boolean;
    error: string | null;
}

const initialState: CouponState = {
    coupons: [],
    loading: false,
    error: null,
};

// DB row shape
type CouponRow = {
    id: number;
    title?: string;
    code?: string;
    amount?: number;
    minAmount?: number;
    active?: boolean;
    isPrivate?: boolean;
    isFix?: boolean;
    expiredAt?: string;
    created_at?: string;
};

const normalizeRows = (rows: CouponRow[] | null | undefined): Coupon[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        code: row.code,
        amount: row.amount,
        minAmount: row.minAmount,
        active: row.active ?? false,
        isPrivate: row.isPrivate ?? false,
        isFix: row.isFix ?? false,
        expiredAt: row.expiredAt,
        createdAt: row.created_at,
    }));

export const fetchCoupons = createAsyncThunk<
    Coupon[],
    void,
    { rejectValue: string }
>(
    'coupon/fetchCoupons',
    async (_, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('coupon')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return normalizeRows(data as CouponRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch coupons';
            return rejectWithValue(msg);
        }
    }
);

export const createCoupon = createAsyncThunk<
    Coupon,
    { 
        title: string; 
        code: string; 
        amount?: number; 
        minAmount?: number; 
        active?: boolean; 
        isPrivate?: boolean; 
        isFix?: boolean; 
        expiredAt?: string;
    },
    { rejectValue: string }
>(
    'coupon/createCoupon',
    async (couponData, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('coupon')
                .insert({
                    title: couponData.title,
                    code: couponData.code,
                    amount: couponData.amount,
                    minAmount: couponData.minAmount,
                    active: couponData.active ?? true,
                    isPrivate: couponData.isPrivate ?? false,
                    isFix: couponData.isFix ?? false,
                    expiredAt: couponData.expiredAt || null,
                })
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as CouponRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to create coupon';
            return rejectWithValue(msg);
        }
    }
);

export const updateCoupon = createAsyncThunk<
    Coupon,
    { 
        id: number; 
        title?: string; 
        code?: string; 
        amount?: number; 
        minAmount?: number; 
        active?: boolean; 
        isPrivate?: boolean; 
        isFix?: boolean; 
        expiredAt?: string;
    },
    { rejectValue: string }
>(
    'coupon/updateCoupon',
    async ({ id, ...updates }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from('coupon')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return normalizeRows([data as CouponRow])[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update coupon';
            return rejectWithValue(msg);
        }
    }
);

export const deleteCoupon = createAsyncThunk<
    number,
    number,
    { rejectValue: string }
>(
    'coupon/deleteCoupon',
    async (id, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from('coupon')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to delete coupon';
            return rejectWithValue(msg);
        }
    }
);

const couponSlice = createSlice({
    name: 'coupon',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCoupons.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCoupons.fulfilled, (state, action) => {
                state.loading = false;
                state.coupons = action.payload;
            })
            .addCase(fetchCoupons.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch coupons';
            })
            .addCase(createCoupon.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createCoupon.fulfilled, (state, action) => {
                state.loading = false;
                state.coupons.unshift(action.payload);
            })
            .addCase(createCoupon.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to create coupon';
            })
            .addCase(updateCoupon.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateCoupon.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.coupons.findIndex((coupon) => coupon.id === action.payload.id);
                if (index !== -1) {
                    state.coupons[index] = action.payload;
                }
            })
            .addCase(updateCoupon.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to update coupon';
            })
            .addCase(deleteCoupon.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteCoupon.fulfilled, (state, action) => {
                state.loading = false;
                state.coupons = state.coupons.filter((coupon) => coupon.id !== action.payload);
            })
            .addCase(deleteCoupon.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete coupon';
            });
    },
});

export default couponSlice.reducer;

