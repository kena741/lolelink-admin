import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Payment {
    id: string;
    bookingId: string;
    customerId: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    provider: string;
    providerRef: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePaymentPayload {
    bookingId: string;
    customerId: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    provider: string;
    providerRef: string;
}

export interface UpdatePaymentPayload {
    id: string;
    status?: string;
    paymentMethod?: string;
    provider?: string;
    providerRef?: string;
}

interface PaymentRow {
    id: string;
    booking_id: string;
    customer_id: string;
    amount: number;
    currency: string;
    status: string;
    payment_method: string;
    provider: string;
    provider_ref: string;
    created_at: string;
    updated_at: string;
}

interface PaymentsState {
    payments: Payment[];
    loading: boolean;
    error: string | null;
}

const initialState: PaymentsState = {
    payments: [],
    loading: false,
    error: null,
};

function normalizeRows(rows: PaymentRow[] | null | undefined): Payment[] {
    return (rows ?? []).map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        customerId: row.customer_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        paymentMethod: row.payment_method,
        provider: row.provider,
        providerRef: row.provider_ref,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}

export const fetchPayments = createAsyncThunk<
    Payment[],
    void,
    { rejectValue: string }
>('payments/fetchPayments', async (_, { rejectWithValue }) => {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return normalizeRows(data as PaymentRow[]);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch payments';
        return rejectWithValue(message);
    }
});

export const createPayment = createAsyncThunk<
    Payment,
    CreatePaymentPayload,
    { rejectValue: string }
>('payments/createPayment', async (payload, { rejectWithValue }) => {
    try {
        const { data, error } = await supabase
            .from('payments')
            .insert({
                booking_id: payload.bookingId,
                customer_id: payload.customerId,
                amount: payload.amount,
                currency: payload.currency,
                status: payload.status,
                payment_method: payload.paymentMethod,
                provider: payload.provider,
                provider_ref: payload.providerRef,
            })
            .select()
            .single();

        if (error) throw error;
        return normalizeRows([data as PaymentRow])[0];
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create payment';
        return rejectWithValue(message);
    }
});

export const updatePayment = createAsyncThunk<
    Payment,
    UpdatePaymentPayload,
    { rejectValue: string }
>('payments/updatePayment', async ({ id, ...payload }, { rejectWithValue }) => {
    try {
        const updateData: {
            status?: string;
            payment_method?: string;
            provider?: string;
            provider_ref?: string;
        } = {};

        if (payload.status !== undefined) updateData.status = payload.status;
        if (payload.paymentMethod !== undefined) updateData.payment_method = payload.paymentMethod;
        if (payload.provider !== undefined) updateData.provider = payload.provider;
        if (payload.providerRef !== undefined) updateData.provider_ref = payload.providerRef;

        const { data, error } = await supabase
            .from('payments')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return normalizeRows([data as PaymentRow])[0];
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update payment';
        return rejectWithValue(message);
    }
});

const paymentsSlice = createSlice({
    name: 'payments',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPayments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayments.fulfilled, (state, action: PayloadAction<Payment[]>) => {
                state.loading = false;
                state.payments = action.payload;
            })
            .addCase(fetchPayments.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch payments';
            })
            .addCase(createPayment.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createPayment.fulfilled, (state, action: PayloadAction<Payment>) => {
                state.loading = false;
                state.payments.unshift(action.payload);
            })
            .addCase(createPayment.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create payment';
            })
            .addCase(updatePayment.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updatePayment.fulfilled, (state, action: PayloadAction<Payment>) => {
                state.loading = false;
                const paymentIndex = state.payments.findIndex((payment) => payment.id === action.payload.id);
                if (paymentIndex !== -1) state.payments[paymentIndex] = action.payload;
            })
            .addCase(updatePayment.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to update payment';
            });
    },
});

export default paymentsSlice.reducer;
