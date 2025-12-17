import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface PayoutRequest {
    id: string;
    providerId: string;
    provider_name?: string;
    note?: string;
    adminNote?: string;
    amount: string | number;
    paymentStatus: 'pending' | 'approved' | 'rejected' | 'completed';
    createdDate?: string;
    paymentDate?: string;
}

interface PayoutRequestState {
    requests: PayoutRequest[];
    loading: boolean;
    error: string | null;
}

const initialState: PayoutRequestState = {
    requests: [],
    loading: false,
    error: null,
};

// DB row shape from withdrawal_history table
type WithdrawalHistoryRow = {
    id: string;
    providerId: string;
    note?: string;
    adminNote?: string;
    amount: string;
    paymentStatus?: string;
    createdDate?: string;
    paymentDate?: string;
};

const normalizeRows = (rows: WithdrawalHistoryRow[] | null | undefined, providerMap: Record<string, string>): PayoutRequest[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        providerId: row.providerId,
        provider_name: providerMap[row.providerId] || 'Unknown Provider',
        note: row.note,
        adminNote: row.adminNote,
        amount: row.amount,
        paymentStatus: (row.paymentStatus || 'pending') as 'pending' | 'approved' | 'rejected' | 'completed',
        createdDate: row.createdDate,
        paymentDate: row.paymentDate,
    }));

export const fetchPayoutRequests = createAsyncThunk<
    PayoutRequest[],
    void,
    { rejectValue: string }
>(
    'payout/fetchPayoutRequests',
    async (_, { rejectWithValue }) => {
        try {
            // Fetch withdrawal history
            const { data: withdrawalData, error: withdrawalError } = await supabase
                .from('withdrawal_history')
                .select('*')
                .order('createdDate', { ascending: false });

            if (withdrawalError) throw withdrawalError;

            // Get unique provider IDs
            const providerIds = [...new Set((withdrawalData || []).map((row: WithdrawalHistoryRow) => row.providerId).filter(Boolean))];
            
            // Fetch provider info using providerId == id from providers table
            const providerMap: Record<string, string> = {};
            if (providerIds.length > 0) {
                // Query providers where id matches providerId from withdrawal_history
                const { data: providers, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .in('id', providerIds);
                    console.log("providers",providers, providerError);

                if (!providerError && providers) {
                    providers.forEach((provider: { id: string; firstName?: string; lastName?: string }) => {
                        // Match provider.id == providerId from withdrawal_history
                        const first = provider.firstName;
                        const last = provider.lastName;
                        const full = [first, last].filter(Boolean).join(' ');
                        providerMap[provider.id] = full || 'Unknown Provider';
                    });
                }
            }

            return normalizeRows(withdrawalData as WithdrawalHistoryRow[], providerMap);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch payout requests';
            return rejectWithValue(msg);
        }
    }
);

export const approvePayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/approvePayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; paymentDate: string; adminNote?: string } = { 
                paymentStatus: 'approved',
                paymentDate: new Date().toISOString()
            };
            
            if (adminNote) {
                updateData.adminNote = adminNote;
            }

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Fetch provider name using providerId == id from providers table
            const providerMap: Record<string, string> = {};
            if (data.providerId) {
                const { data: provider, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .eq('id', data.providerId)
                    .single();
                
                if (!providerError && provider) {
                    const first = provider.firstName;
                    const last = provider.lastName;
                    const full = [first, last].filter(Boolean).join(' ');
                    providerMap[provider.id] = full || 'Unknown Provider';
                }
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to approve payout request';
            return rejectWithValue(msg);
        }
    }
);

export const rejectPayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/rejectPayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; adminNote?: string } = { 
                paymentStatus: 'rejected'
            };
            
            if (adminNote) {
                updateData.adminNote = adminNote;
            }

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Fetch provider name using providerId == id from providers table
            const providerMap: Record<string, string> = {};
            if (data.providerId) {
                const { data: provider, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .eq('id', data.providerId)
                    .single();
                
                if (!providerError && provider) {
                    const first = provider.firstName;
                    const last = provider.lastName;
                    const full = [first, last].filter(Boolean).join(' ');
                    providerMap[provider.id] = full || 'Unknown Provider';
                }
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to reject payout request';
            return rejectWithValue(msg);
        }
    }
);

const payoutSlice = createSlice({
    name: 'payout',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPayoutRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayoutRequests.fulfilled, (state, action: PayloadAction<PayoutRequest[]>) => {
                state.loading = false;
                state.requests = action.payload;
            })
            .addCase(fetchPayoutRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch payout requests';
            })
            .addCase(approvePayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(approvePayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(approvePayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to approve payout request';
            })
            .addCase(rejectPayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(rejectPayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(rejectPayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to reject payout request';
            });
    },
});

export default payoutSlice.reducer;

