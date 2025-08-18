import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface BookedService {
    id: string;
    provider_id: string;
    customer_id?: string | null;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    serviceName?: string;
    service_id?: string;
    serviceImage?: string;
    price?: number;
    discount?: string;
    totalAmount?: number;
    subTotal?: number;
    quantity?: string;
    bookingDate?: string;
    createdAt?: string;
    status?: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'rejected' | 'cancelled';
    description?: string;
    paymentCompleted?: boolean;
}

interface BookedServiceState {
    items: BookedService[];
    loading: boolean;
    error: string | null;
    single: BookedService | null;
}

const initialState: BookedServiceState = {
    items: [],
    loading: false,
    error: null,
    single: null,
};

// DB row shape (snake_case support)
type BookedServiceRow = BookedService & { created_at?: string };

const normalizeRows = (rows: BookedServiceRow[] | null | undefined): BookedService[] =>
    (rows ?? []).map(({ created_at, ...rest }) => ({
        ...rest,
        createdAt: rest.createdAt ?? created_at,
    }));

export const fetchProviderBookings = createAsyncThunk<
    BookedService[],
    { provider_id?: string; statuses?: string[] },
    { rejectValue: string }
>(
    'bookedService/fetchProviderBookings',
    async ({ statuses } = {}, { rejectWithValue }) => {
        try {
            // Fetch across all providers (no provider_id filter)
            let query = supabase.from('booked_service').select('*');
            console.log('query:', query)
            if (statuses && statuses.length) {
                query = query.in('status', statuses);
            }
            const { data, error } = await query.order('createdAt', { ascending: false });
            if (error) throw error;
            return normalizeRows(data as BookedServiceRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch bookings';
            return rejectWithValue(msg);
        }
    }
);

export const fetchAllBookings = createAsyncThunk<
    BookedService[],
    { statuses?: string[] } | undefined,
    { rejectValue: string }
>(
    'bookedService/fetchAllBookings',
    async (args, { rejectWithValue }) => {
        try {
            let query = supabase.from('booked_service').select('*');
            console.log('query:', query)
            const statuses = args?.statuses;
            if (statuses && statuses.length) {
                query = query.in('status', statuses);
            }
            const { data, error } = await query.order('createdAt', { ascending: false });
            if (error) throw error;
            return normalizeRows(data as BookedServiceRow[]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch bookings';
            return rejectWithValue(msg);
        }
    }
);

export const fetchBookingById = createAsyncThunk<
    BookedService,
    string,
    { rejectValue: string }
>(
    'bookedService/fetchBookingById',
    async (id, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase.from('booked_service').select('*').eq('id', id).single();
            if (error) throw error;
            return data as BookedService;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch booking';
            return rejectWithValue(msg);
        }
    }
);

const bookedServiceSlice = createSlice({
    name: 'bookedService',
    initialState,
    reducers: {
        clearSingle(state) {
            state.single = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProviderBookings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProviderBookings.fulfilled, (state, action: PayloadAction<BookedService[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchProviderBookings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch bookings';
            })
            .addCase(fetchAllBookings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllBookings.fulfilled, (state, action: PayloadAction<BookedService[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchAllBookings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch bookings';
            })
            .addCase(fetchBookingById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.single = null;
            })
            .addCase(fetchBookingById.fulfilled, (state, action: PayloadAction<BookedService>) => {
                state.loading = false;
                state.single = action.payload;
            })
            .addCase(fetchBookingById.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch booking';
            });
    },
});

export const { clearSingle } = bookedServiceSlice.actions;
export default bookedServiceSlice.reducer;
