import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    authUserId: string;
    userIdStoredAsProfile: boolean;
    provider_id: string;
    customer_id: string;
    providerProfileId: string;
    providerName: string;
    providerEmail: string;
    providerPhone: string;
    customerProfileId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    authUserName: string;
    authUserEmail: string;
    authUserPhone: string;
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
    authUserId?: string | null;
    userIdStoredAsProfile?: boolean | null;
    provider_id?: string | null;
    customer_id?: string | null;
    providerProfileId?: string | null;
    providerName?: string | null;
    providerEmail?: string | null;
    providerPhone?: string | null;
    customerProfileId?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    authUserName?: string | null;
    authUserEmail?: string | null;
    authUserPhone?: string | null;
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
        authUserId: row.authUserId ?? row.userId ?? '',
        userIdStoredAsProfile: row.userIdStoredAsProfile ?? false,
        provider_id: row.provider_id ?? '',
        customer_id: row.customer_id ?? '',
        providerProfileId: row.providerProfileId ?? '',
        providerName: row.providerName ?? '',
        providerEmail: row.providerEmail ?? '',
        providerPhone: row.providerPhone ?? '',
        customerProfileId: row.customerProfileId ?? '',
        customerName: row.customerName ?? '',
        customerEmail: row.customerEmail ?? '',
        customerPhone: row.customerPhone ?? '',
        authUserName: row.authUserName ?? '',
        authUserEmail: row.authUserEmail ?? '',
        authUserPhone: row.authUserPhone ?? '',
    }));
}

export const fetchWalletTransactions = createAsyncThunk<
    WalletTransaction[],
    void,
    { rejectValue: string }
>('walletTransaction/fetchWalletTransactions', async (_, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/wallet-transactions');
        const payload = (await response.json()) as { data?: WalletTransactionRow[]; error?: string };
        if (!response.ok || payload.error) {
            throw new Error(payload.error || 'Failed to fetch wallet transactions');
        }
        return normalizeRows(payload.data);
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
