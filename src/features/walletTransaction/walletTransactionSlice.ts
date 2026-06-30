import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WalletTransactionEventId } from '@/lib/wallet-transaction-display';
import type { WalletTransactionIssue } from '@/lib/wallet-transaction-issues';

export interface WalletTransaction {
    id: string;
    amount: string;
    createdDate: string;
    isCredit: boolean;
    note: string;
    paymentType: string;
    paymentDisplayLabel: string;
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
    bookingServiceName: string;
    bookingCustomerName: string;
    bookingTotalAmount: number | null;
    bookingAdminCommission: number | null;
    bookingStatus: string;
    bookingCustomerId: string;
    bookingProviderId: string;
    bookingCustomerUserId: string;
    bookingProviderUserId: string;
    walletEvent: WalletTransactionEventId;
    walletEventLabel: string;
    issues: WalletTransactionIssue[];
}

interface WalletTransactionRow {
    id: string;
    amount?: string | null;
    createdDate?: string | null;
    isCredit?: boolean | null;
    note?: string | null;
    paymentType?: string | null;
    paymentDisplayLabel?: string | null;
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
    bookingServiceName?: string | null;
    bookingCustomerName?: string | null;
    bookingTotalAmount?: number | null;
    bookingAdminCommission?: number | null;
    bookingStatus?: string | null;
    bookingCustomerId?: string | null;
    bookingProviderId?: string | null;
    bookingCustomerUserId?: string | null;
    bookingProviderUserId?: string | null;
    walletEvent?: WalletTransactionEventId | null;
    walletEventLabel?: string | null;
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
        paymentDisplayLabel: row.paymentDisplayLabel ?? row.paymentType ?? '',
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
        bookingServiceName: row.bookingServiceName ?? '',
        bookingCustomerName: row.bookingCustomerName ?? '',
        bookingTotalAmount: row.bookingTotalAmount ?? null,
        bookingAdminCommission: row.bookingAdminCommission ?? null,
        bookingStatus: row.bookingStatus ?? '',
        bookingCustomerId: row.bookingCustomerId ?? '',
        bookingProviderId: row.bookingProviderId ?? '',
        bookingCustomerUserId: row.bookingCustomerUserId ?? '',
        bookingProviderUserId: row.bookingProviderUserId ?? '',
        walletEvent: row.walletEvent ?? 'other',
        walletEventLabel: row.walletEventLabel ?? 'Other',
        issues: [],
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
