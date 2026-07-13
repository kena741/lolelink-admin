export type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ServerRouteCoverageEntry {
    file: string;
    methods: HttpMethod[];
    loggingHelpers?: string[];
}

export interface ClientSliceCoverageEntry {
    file: string;
    thunkNames: string[];
}

export const SERVER_ACTIVITY_LOG_ROUTES: ServerRouteCoverageEntry[] = [
    { file: 'src/app/api/banners/route.ts', methods: ['POST', 'PATCH', 'DELETE'] },
    { file: 'src/app/api/job-requests/route.ts', methods: ['PATCH'] },
    { file: 'src/app/api/admin/documents/route.ts', methods: ['POST', 'PATCH', 'DELETE'] },
    { file: 'src/app/api/admin/admins/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/admins/[id]/route.ts', methods: ['PATCH', 'DELETE'] },
    { file: 'src/app/api/admin/roles/route.ts', methods: ['POST', 'PATCH', 'DELETE'] },
    { file: 'src/app/api/admin/customers/[id]/route.ts', methods: ['PATCH', 'DELETE'] },
    { file: 'src/app/api/admin/providers/[id]/route.ts', methods: ['PATCH', 'DELETE'] },
    { file: 'src/app/api/admin/bookings/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/bookings/[id]/route.ts', methods: ['DELETE'] },
    { file: 'src/app/api/admin/bookings/payment/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/bookings/payment/verify/route.ts', methods: ['POST'] },
    { file: 'src/app/api/convert-to-provider/route.ts', methods: ['POST'] },
    { file: 'src/app/api/payout/complete/route.ts', methods: ['POST'] },
    { file: 'src/app/api/payout/chapa-transfer/route.ts', methods: ['POST'] },
    { file: 'src/app/api/payout/chapa-verify-transfer/route.ts', methods: ['POST'] },
    { file: 'src/app/api/payout/create-notification/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/push/notify/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/push/providers/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/push/customers/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/push/providers/[id]/route.ts', methods: ['POST'] },
    { file: 'src/app/api/settings/languages/route.ts', methods: ['POST'] },
    { file: 'src/app/api/sms/send/route.ts', methods: ['POST'] },
    { file: 'src/app/api/provider/activate-payment/route.ts', methods: ['POST'], loggingHelpers: ['handleChapaCheckout', 'handleManualMark'] },
    { file: 'src/app/api/provider/activate-payment/verify/route.ts', methods: ['POST'] },
    { file: 'src/app/api/payout/chapa-webhook/route.ts', methods: ['POST'] },
    { file: 'src/app/api/admin/bookings/payment/webhook/route.ts', methods: ['POST'] },
    { file: 'src/app/api/provider/activate-payment/webhook/route.ts', methods: ['POST'] },
];

export const CLIENT_ACTIVITY_LOG_SLICES: ClientSliceCoverageEntry[] = [
    {
        file: 'src/features/category/categorySlice.ts',
        thunkNames: ['createCategory', 'updateCategory', 'deleteCategory'],
    },
    {
        file: 'src/features/subcategory/subcategorySlice.ts',
        thunkNames: ['createSubCategory', 'updateSubCategory', 'deleteSubCategory'],
    },
    {
        file: 'src/features/coupon/couponSlice.ts',
        thunkNames: ['createCoupon', 'updateCoupon', 'deleteCoupon'],
    },
    {
        file: 'src/features/tax/taxSlice.ts',
        thunkNames: ['createTax', 'updateTax', 'deleteTax'],
    },
    {
        file: 'src/features/handyman/handymanSlice.ts',
        thunkNames: ['createHandyman', 'updateHandyman', 'deleteHandyman'],
    },
    {
        file: 'src/features/service/addServiceSlice.ts',
        thunkNames: ['addService'],
    },
    {
        file: 'src/features/service/editServiceSlice.ts',
        thunkNames: ['updateService'],
    },
    {
        file: 'src/features/service/deleteServiceSlice.ts',
        thunkNames: ['deleteService'],
    },
    {
        file: 'src/features/service/approveServicesSlice.ts',
        thunkNames: [
            'approveServicesByProvider',
            'approveServiceById',
            'approveFeatureRequestById',
            'rejectFeatureRequestById',
            'unfeatureServiceById',
        ],
    },
    {
        file: 'src/features/verifyDocuments/verifyDocumentsSlice.ts',
        thunkNames: [
            'verifyDocument',
            'rejectDocument',
            'approveAllDocuments',
            'reapproveAllRejectedDocuments',
        ],
    },
    {
        file: 'src/features/settings/settingsSlice.ts',
        thunkNames: ['updateSettings'],
    },
    {
        file: 'src/features/provider/providerSlice.ts',
        thunkNames: ['updateProvider', 'createService', 'updateService'],
    },
    {
        file: 'src/features/payout/payoutSlice.ts',
        thunkNames: [
            'approvePayoutRequest',
            'rejectPayoutRequest',
            'completePayoutRequest',
            'sendPayoutViaChapa',
        ],
    },
    {
        file: 'src/features/payments/paymentsSlice.ts',
        thunkNames: ['updatePayment'],
    },
    {
        file: 'src/features/notification/notificationSlice.ts',
        thunkNames: [
            'markNotificationRead',
            'markAllNotificationsRead',
            'deleteNotification',
            'deleteNotificationsBulk',
        ],
    },
];
