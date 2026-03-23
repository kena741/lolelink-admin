import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface WalletTransaction {
    id: string;
    amount: string;
    createdDate: string;
    isCredit: boolean;
    note: string;
    paymentType: string;
    transactionId: string;
    type: string;
    userId: string;
}

interface WalletTransactionRow {
    id: string;
    amount?: string | null;
    createdDate?: string | null;
    isCredit?: boolean | null;
    note?: string | null;
    paymentType?: string | null;
    transactionId?: string | null;
    type?: string | null;
    userId?: string | null;
}

interface WalletTransactionState {
    items: WalletTransaction[];
    loading: boolean;
    error: string | null;
}

const initialState: WalletTransactionState = {
    items: [],
    loading: false,
    error: null,
};

function normalizeRows(rows: WalletTransactionRow[] | null | undefined): WalletTransaction[] {
    return (rows ?? []).map((row) => ({
        id: row.id,
        amount: row.amount ?? '0',
        createdDate: row.createdDate ?? '',
        isCredit: row.isCredit ?? false,
        note: row.note ?? '',
        paymentType: row.paymentType ?? '',
        transactionId: row.transactionId ?? '',
        type: row.type ?? '',
        userId: row.userId ?? '',
    }));
}

export const fetchWalletTransactions = createAsyncThunk<
    WalletTransaction[],
    void,
    { rejectValue: string }
>('walletTransaction/fetchWalletTransactions', async (_, { rejectWithValue }) => {
    try {
        const { data, error } = await supabase
            .from('wallet_transaction')
            .select('*')
            .order('createdDate', { ascending: false });

        if (error) throw error;
        return normalizeRows(data as WalletTransactionRow[]);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch wallet transactions';
        return rejectWithValue(msg);
    }
});

const walletTransactionSlice = createSlice({
    name: 'walletTransaction',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchWalletTransactions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWalletTransactions.fulfilled, (state, action: PayloadAction<WalletTransaction[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchWalletTransactions.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch wallet transactions';
            });
    },
});

export default walletTransactionSlice.reducer;
