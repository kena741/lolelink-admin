import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface Payment {
    id: string;
    providerId: string;
    customerId: string;
    serviceId: string;
    serviceName: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    price: number;
    subTotal: number;
    totalAmount: number;
    bookingDate: string;
    status: string;
    paymentCompleted: boolean;
    paymentStatus: string;
    paymentId: string;
    paidAt: string;
    escrowReleasedAt: string;
    paymentType: string;
    createdAt: string;
}

export interface UpdatePaymentPayload {
    id: string;
    paymentStatus?: string;
    paymentId?: string;
    paidAt?: string;
    escrowReleasedAt?: string;
}

interface PaymentRow {
    id: string;
    provider_id: string;
    customer_id: string;
    service_id?: string;
    serviceName?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    email?: string;
    price?: number;
    subTotal?: number;
    totalAmount?: number;
    bookingDate?: string;
    status: string;
    paymentCompleted?: boolean;
    payment_status?: string;
    payment_id?: string;
    paid_at?: string;
    escrow_released_at?: string;
    paymentType?: string;
    createdAt?: string;
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
        providerId: row.provider_id,
        customerId: row.customer_id,
        serviceId: row.service_id ?? '',
        serviceName: row.serviceName ?? '',
        firstName: row.firstName ?? '',
        lastName: row.lastName ?? '',
        phoneNumber: row.phoneNumber ?? '',
        email: row.email ?? '',
        price: Number(row.price ?? 0),
        subTotal: Number(row.subTotal ?? 0),
        totalAmount: Number(row.totalAmount ?? 0),
        bookingDate: row.bookingDate ?? '',
        status: row.status,
        paymentCompleted: row.paymentCompleted ?? false,
        paymentStatus: row.payment_status ?? 'pending',
        paymentId: row.payment_id ?? '',
        paidAt: row.paid_at ?? '',
        escrowReleasedAt: row.escrow_released_at ?? '',
        paymentType: row.paymentType ?? '',
        createdAt: row.createdAt ?? '',
    }));
}

export const fetchPayments = createAsyncThunk<
    Payment[],
    void,
    { rejectValue: string }
>('payments/fetchPayments', async (_, { rejectWithValue }) => {
    try {
        const { data, error } = await supabase
            .from('booked_service')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return normalizeRows(data as PaymentRow[]);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch payments';
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
            payment_status?: string;
            payment_id?: string;
            paid_at?: string;
            escrow_released_at?: string;
            paymentCompleted?: boolean;
        } = {};

        if (payload.paymentStatus !== undefined) {
            updateData.payment_status = payload.paymentStatus;
            if (payload.paymentStatus === 'paid') updateData.paymentCompleted = true;
            if (payload.paymentStatus !== 'paid') updateData.paymentCompleted = false;
        }
        if (payload.paymentId !== undefined) updateData.payment_id = payload.paymentId;
        if (payload.paidAt !== undefined) updateData.paid_at = payload.paidAt;
        if (payload.escrowReleasedAt !== undefined) updateData.escrow_released_at = payload.escrowReleasedAt;

        const { data, error } = await supabase
            .from('booked_service')
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
