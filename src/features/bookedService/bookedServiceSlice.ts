import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';

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
    status?:
        | 'booked'
        | 'booked_accepted'
        | 'booked_rejected'
        | 'pending_customer_payment'
        | 'paid_for_service_booked'
        | 'booked_cancelled'
        | 'service_started'
        | 'service_completion_approval'
        | 'service_completion_approved_by_customer'
        | 'completed';
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
            let query = getSupabase().from('booked_service').select('*');
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
            let query = getSupabase().from('booked_service').select('*');
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
            const { data, error } = await getSupabase().from('booked_service').select('*').eq('id', id).single();
            if (error) throw error;
            return data as BookedService;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch booking';
            return rejectWithValue(msg);
        }
    }
);

export type PaymentPath = 'pay_now' | 'pay_later';

export interface CreateBookingInput {
    provider_id: string;
    service_id: string;
    customer_id: string;
    bookingDate?: string;
    quantity?: string;
    description?: string;
    payment_path: PaymentPath;
}

interface CreateBookingResponse {
    data: BookedService;
}

interface InitBookingPaymentResponse {
    checkout_url?: string;
    tx_ref: string;
    booking_id: string;
    amount: number;
}

interface VerifyBookingPaymentResponse {
    status: string;
    message?: string;
    booking_id?: string;
}

async function parseApiError(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    return payload?.error || payload?.message || `Request failed (${response.status})`;
}

export const createBooking = createAsyncThunk<
    BookedService,
    CreateBookingInput,
    { rejectValue: string }
>('bookedService/createBooking', async (input, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        const payload = (await response.json()) as CreateBookingResponse;
        return payload.data;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create booking';
        return rejectWithValue(msg);
    }
});

export const initiateBookingPayment = createAsyncThunk<
    InitBookingPaymentResponse,
    { bookingId: string },
    { rejectValue: string }
>('bookedService/initiateBookingPayment', async ({ bookingId }, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        return (await response.json()) as InitBookingPaymentResponse;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to initialize payment';
        return rejectWithValue(msg);
    }
});

export const verifyBookingPayment = createAsyncThunk<
    VerifyBookingPaymentResponse,
    { bookingId: string },
    { rejectValue: string }
>('bookedService/verifyBookingPayment', async ({ bookingId }, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        });

        const payload = (await response.json()) as VerifyBookingPaymentResponse & { error?: string };

        if (!response.ok) {
            return rejectWithValue(payload.error || payload.message || `Request failed (${response.status})`);
        }

        if (payload.status === 'pending') {
            return rejectWithValue(payload.message || 'Payment not yet confirmed');
        }

        return payload;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to verify payment';
        return rejectWithValue(msg);
    }
});

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
            })
            .addCase(createBooking.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createBooking.fulfilled, (state, action: PayloadAction<BookedService>) => {
                state.loading = false;
                state.items = [action.payload, ...state.items.filter((item) => item.id !== action.payload.id)];
            })
            .addCase(createBooking.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create booking';
            });
    },
});

export const { clearSingle } = bookedServiceSlice.actions;
export default bookedServiceSlice.reducer;
