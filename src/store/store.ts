import { configureStore } from '@reduxjs/toolkit';
import providerReducer from '../features/provider/providerSlice';
import bookedServiceReducer from '../features/bookedService/bookedServiceSlice';
import customerReducer from '../features/customer/customerSlice';
import { addServiceModalSliceReducer } from '../features/service/addServiceSlice';
import editServiceReducer from '../features/service/editServiceSlice';
import deleteServiceReducer from '../features/service/deleteServiceSlice';
import approveServicesReducer from '../features/service/approveServicesSlice';
import payoutReducer from '../features/payout/payoutSlice';
import verifyDocumentsReducer from '../features/verifyDocuments/verifyDocumentsSlice';
import settingsReducer from '../features/settings/settingsSlice';
import categoryReducer from '../features/category/categorySlice';
import subcategoryReducer from '../features/subcategory/subcategorySlice';
import handymanReducer from '../features/handyman/handymanSlice';
import taxReducer from '../features/tax/taxSlice';
import documentReducer from '../features/document/documentSlice';
import bannerReducer from '../features/banner/bannerSlice';
import couponReducer from '../features/coupon/couponSlice';

const store = configureStore({
    reducer: {
        provider: providerReducer,
        bookedService: bookedServiceReducer,
        customer: customerReducer,
        addServiceModal: addServiceModalSliceReducer,
        editService: editServiceReducer,
        deleteService: deleteServiceReducer,
        approveServices: approveServicesReducer,
        payout: payoutReducer,
        verifyDocuments: verifyDocumentsReducer,
        settings: settingsReducer,
        category: categoryReducer,
        subcategory: subcategoryReducer,
        handyman: handymanReducer,
        tax: taxReducer,
        document: documentReducer,
        banner: bannerReducer,
        coupon: couponReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
