'use client';

import { useEffect, useMemo, useRef } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { useAppDispatch } from '@/store/hooks';
import { fetchProviders } from '@/features/provider/providerSlice';
import { fetchAllBookings } from '@/features/bookedService/bookedServiceSlice';
import { fetchAllCustomers } from '@/features/customer/customerSlice';
import { fetchServices } from '@/features/service/approveServicesSlice';
import { fetchPayoutRequests } from '@/features/payout/payoutSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import { fetchSettings } from '@/features/settings/settingsSlice';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchAllSubCategoryDocumentIds } from '@/features/subcategory/subcategorySlice';
import { fetchHandymen } from '@/features/handyman/handymanSlice';
import { fetchTaxes } from '@/features/tax/taxSlice';
import { fetchDocuments } from '@/features/document/documentSlice';
import { fetchBanners } from '@/features/banner/bannerSlice';
import { fetchCoupons } from '@/features/coupon/couponSlice';
import { fetchPayments } from '@/features/payments/paymentsSlice';
import { fetchWalletTransactions } from '@/features/walletTransaction/walletTransactionSlice';
import { fetchNotifications } from '@/features/notification/notificationSlice';

const SYNC_DEBOUNCE_MS = 500;

export function RealtimeDataSync() {
    const dispatch = useAppDispatch();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refetchAll = useMemo(
        () => () => {
            dispatch(fetchProviders());
            dispatch(fetchAllBookings({ includeArchived: true }));
            dispatch(fetchAllCustomers());
            dispatch(fetchServices());
            dispatch(fetchPayoutRequests());
            dispatch(fetchVerifyDocuments());
            dispatch(fetchSettings());
            dispatch(fetchCategories());
            dispatch(fetchAllSubCategoryDocumentIds());
            dispatch(fetchHandymen());
            dispatch(fetchTaxes());
            dispatch(fetchDocuments());
            dispatch(fetchBanners());
            dispatch(fetchCoupons());
            dispatch(fetchPayments());
            dispatch(fetchWalletTransactions());
            dispatch(fetchNotifications());
        },
        [dispatch]
    );

    useEffect(() => {
        const supabase = getSupabase();
        const channel = supabase
            .channel('admin-realtime-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                },
                () => {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(() => {
                        refetchAll();
                    }, SYNC_DEBOUNCE_MS);
                }
            )
            .subscribe();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [refetchAll]);

    return null;
}
