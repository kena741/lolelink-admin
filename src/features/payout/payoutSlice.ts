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
    bankDetails?: {
        bankName?: string;
        accountNumber?: string;
        holderName?: string;
        swiftCode?: string;
        branchCity?: string;
        branchCountry?: string;
    } | null;
}

interface PayoutRequestState {
    requests: PayoutRequest[];
    loading: boolean;
    error: string | null;
    bookingPayoutStatus: Record<string, boolean>;
    bookingPayoutLoading: boolean;
    chapaCheckoutUrlById: Record<string, string>;
}

const initialState: PayoutRequestState = {
    requests: [],
    loading: false,
    error: null,
    bookingPayoutStatus: {},
    bookingPayoutLoading: false,
    chapaCheckoutUrlById: {},
};

interface BookingPaymentRow {
    id: string;
    provider_id: string;
    totalAmount?: number;
    price?: number;
    paymentCompleted?: boolean;
    payment_status?: string;
    status?: string;
}

interface WalletTransactionRow {
    id: string;
}

interface BookingPayoutStatusPayload {
    bookingId: string;
    isProcessed: boolean;
}

interface ProcessBookingPayoutPayload {
    bookingId: string;
    processed: boolean;
}

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

function normalizePaymentStatus(value?: string): 'pending' | 'approved' | 'rejected' | 'completed' {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'completed') return 'completed';
    return 'pending';
}

type BankDetailsRow = {
    providerID: string;
    bankName?: string;
    accountNumber?: string;
    holderName?: string;
    swiftCode?: string;
    branchCity?: string;
    branchCountry?: string;
};

function toErrorMessage(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim())
        return value;
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

const normalizeRows = (
    rows: WithdrawalHistoryRow[] | null | undefined,
    providerMap: Record<string, string>,
    bankMap: Record<string, PayoutRequest['bankDetails']>
): PayoutRequest[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        providerId: row.providerId,
        provider_name: providerMap[row.providerId] || 'Unknown Provider',
        note: row.note,
        adminNote: row.adminNote,
        amount: row.amount,
        paymentStatus: normalizePaymentStatus(row.paymentStatus),
        createdDate: row.createdDate,
        paymentDate: row.paymentDate,
        bankDetails: bankMap[row.providerId] || null,
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
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
            if (providerIds.length > 0) {
                const { data: providers, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .in('id', providerIds);

                if (!providerError && providers) {
                    providers.forEach((provider: { id: string; firstName?: string; lastName?: string }) => {
                        const first = provider.firstName;
                        const last = provider.lastName;
                        const full = [first, last].filter(Boolean).join(' ');
                        providerMap[provider.id] = full || 'Unknown Provider';
                    });
                }

                const { data: banks, error: bankError } = await supabase
                    .from('bank_details')
                    .select('providerID, bankName, accountNumber, holderName, swiftCode, branchCity, branchCountry')
                    .in('providerID', providerIds);

                if (!bankError && banks) {
                    (banks as BankDetailsRow[]).forEach((bank) => {
                        bankMap[bank.providerID] = {
                            bankName: bank.bankName,
                            accountNumber: bank.accountNumber,
                            holderName: bank.holderName,
                            swiftCode: bank.swiftCode,
                            branchCity: bank.branchCity,
                            branchCountry: bank.branchCountry,
                        };
                    });
                }
            }

            return normalizeRows(withdrawalData as WithdrawalHistoryRow[], providerMap, bankMap);
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

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
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

                const { data: bank, error: bankError } = await supabase
                    .from('bank_details')
                    .select('providerID, bankName, accountNumber, holderName, swiftCode, branchCity, branchCountry')
                    .eq('providerID', data.providerId)
                    .maybeSingle();

                if (!bankError && bank) {
                    const bankRow = bank as BankDetailsRow;
                    bankMap[bankRow.providerID] = {
                        bankName: bankRow.bankName,
                        accountNumber: bankRow.accountNumber,
                        holderName: bankRow.holderName,
                        swiftCode: bankRow.swiftCode,
                        branchCity: bankRow.branchCity,
                        branchCountry: bankRow.branchCountry,
                    };
                }
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
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

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
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

                const { data: bank, error: bankError } = await supabase
                    .from('bank_details')
                    .select('providerID, bankName, accountNumber, holderName, swiftCode, branchCity, branchCountry')
                    .eq('providerID', data.providerId)
                    .maybeSingle();

                if (!bankError && bank) {
                    const bankRow = bank as BankDetailsRow;
                    bankMap[bankRow.providerID] = {
                        bankName: bankRow.bankName,
                        accountNumber: bankRow.accountNumber,
                        holderName: bankRow.holderName,
                        swiftCode: bankRow.swiftCode,
                        branchCity: bankRow.branchCity,
                        branchCountry: bankRow.branchCountry,
                    };
                }
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to reject payout request';
            return rejectWithValue(msg);
        }
    }
);

export const completePayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/completePayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; paymentDate: string; adminNote?: string } = {
                paymentStatus: 'completed',
                paymentDate: new Date().toISOString(),
            };

            if (adminNote)
                updateData.adminNote = adminNote;

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
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

                const { data: bank, error: bankError } = await supabase
                    .from('bank_details')
                    .select('providerID, bankName, accountNumber, holderName, swiftCode, branchCity, branchCountry')
                    .eq('providerID', data.providerId)
                    .maybeSingle();

                if (!bankError && bank) {
                    const bankRow = bank as BankDetailsRow;
                    bankMap[bankRow.providerID] = {
                        bankName: bankRow.bankName,
                        accountNumber: bankRow.accountNumber,
                        holderName: bankRow.holderName,
                        swiftCode: bankRow.swiftCode,
                        branchCity: bankRow.branchCity,
                        branchCountry: bankRow.branchCountry,
                    };
                }
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to complete payout request';
            return rejectWithValue(msg);
        }
    }
);

export const sendPayoutViaChapa = createAsyncThunk<
    { id: string; txRef: string; checkoutUrl: string | null },
    { id: string },
    { rejectValue: string }
>(
    'payout/sendPayoutViaChapa',
    async ({ id }, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/payout/chapa-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId: id }),
            });

            const payload = (await response.json()) as {
                error?: unknown;
                tx_ref?: string;
                checkout_url?: string | null;
            };

            if (!response.ok)
                return rejectWithValue(toErrorMessage(payload.error, 'Failed to send payout via Chapa'));

            return {
                id,
                txRef: payload.tx_ref || '',
                checkoutUrl: payload.checkout_url || null,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to send payout via Chapa';
            return rejectWithValue(msg);
        }
    }
);

export const fetchBookingPayoutStatus = createAsyncThunk<
    BookingPayoutStatusPayload,
    { bookingId: string },
    { rejectValue: string }
>(
    'payout/fetchBookingPayoutStatus',
    async ({ bookingId }, { rejectWithValue }) => {
        try {
            const transactionId = `provider-payout:${bookingId}`;
            const { data, error } = await supabase
                .from('wallet_transaction')
                .select('id')
                .eq('transactionId', transactionId)
                .eq('type', 'provider_payout')
                .maybeSingle();

            if (error) throw error;
            return {
                bookingId,
                isProcessed: Boolean((data as WalletTransactionRow | null)?.id),
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch booking payout status';
            return rejectWithValue(msg);
        }
    }
);

export const processBookingPayout = createAsyncThunk<
    ProcessBookingPayoutPayload,
    { bookingId: string },
    { rejectValue: string }
>(
    'payout/processBookingPayout',
    async ({ bookingId }, { rejectWithValue }) => {
        try {
            const { data: bookingData, error: bookingError } = await supabase
                .from('booked_service')
                .select('id, provider_id, totalAmount, price, paymentCompleted, payment_status, status')
                .eq('id', bookingId)
                .single();

            if (bookingError) throw bookingError;
            const booking = bookingData as BookingPaymentRow;

            const normalizedBookingStatus = (booking.status ?? '').toString().trim().toLowerCase();
            const isCompleted =
                normalizedBookingStatus === 'completed' ||
                normalizedBookingStatus === 'service_completion_approved_by_customer';
            if (!isCompleted) return rejectWithValue('Booking is not completed yet');

            const isCustomerPaymentDone =
                booking.paymentCompleted === true ||
                (booking.payment_status ?? '').toString().trim().toLowerCase() === 'payment_completed' ||
                [
                    'paid_for_service_booked',
                    'service_started',
                    'service_completion_approval',
                    'service_completion_approved_by_customer',
                    'completed',
                ].includes(normalizedBookingStatus);
            if (!isCustomerPaymentDone) return rejectWithValue('Customer payment is not completed yet');

            if (!booking.provider_id) return rejectWithValue('Provider is missing for this booking');

            const transactionId = `provider-payout:${bookingId}`;
            const { data: existing, error: existingError } = await supabase
                .from('wallet_transaction')
                .select('id')
                .eq('transactionId', transactionId)
                .eq('type', 'provider_payout')
                .maybeSingle();

            if (existingError) throw existingError;
            if ((existing as WalletTransactionRow | null)?.id) {
                return { bookingId, processed: true };
            }

            const payoutAmount = Number(booking.totalAmount ?? booking.price ?? 0);
            if (payoutAmount <= 0) return rejectWithValue('Invalid payout amount');

            const { error: insertError } = await supabase.from('wallet_transaction').insert({
                amount: payoutAmount.toFixed(2),
                createdDate: new Date().toISOString(),
                isCredit: true,
                note: `Payout for booking ${bookingId}`,
                paymentType: 'wallet_topup',
                transactionId,
                type: 'provider_payout',
                userId: booking.provider_id,
            });

            if (insertError) throw insertError;
            return { bookingId, processed: true };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to process booking payout';
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
            })
            .addCase(completePayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(completePayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(completePayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to complete payout request';
            })
            .addCase(sendPayoutViaChapa.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(sendPayoutViaChapa.fulfilled, (state, action) => {
                state.loading = false;
                if (action.payload.checkoutUrl) {
                    state.chapaCheckoutUrlById[action.payload.id] = action.payload.checkoutUrl;
                }
            })
            .addCase(sendPayoutViaChapa.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to send payout via Chapa';
            })
            .addCase(fetchBookingPayoutStatus.pending, (state) => {
                state.bookingPayoutLoading = true;
            })
            .addCase(fetchBookingPayoutStatus.fulfilled, (state, action: PayloadAction<BookingPayoutStatusPayload>) => {
                state.bookingPayoutLoading = false;
                state.bookingPayoutStatus[action.payload.bookingId] = action.payload.isProcessed;
            })
            .addCase(fetchBookingPayoutStatus.rejected, (state, action) => {
                state.bookingPayoutLoading = false;
                state.error = (action.payload as string) || 'Failed to fetch booking payout status';
            })
            .addCase(processBookingPayout.pending, (state) => {
                state.bookingPayoutLoading = true;
                state.error = null;
            })
            .addCase(processBookingPayout.fulfilled, (state, action: PayloadAction<ProcessBookingPayoutPayload>) => {
                state.bookingPayoutLoading = false;
                state.bookingPayoutStatus[action.payload.bookingId] = action.payload.processed;
            })
            .addCase(processBookingPayout.rejected, (state, action) => {
                state.bookingPayoutLoading = false;
                state.error = (action.payload as string) || 'Failed to process booking payout';
            });
    },
});

export default payoutSlice.reducer;

