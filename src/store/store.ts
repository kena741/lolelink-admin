import { configureStore } from '@reduxjs/toolkit';
import providerReducer from '../features/provider/providerSlice';
import bookedServiceReducer from '../features/bookedService/bookedServiceSlice';
import customerReducer from '../features/customer/customerSlice';
import { addServiceModalSliceReducer } from '../features/service/addServiceSlice';
import editServiceReducer from '../features/service/editServiceSlice';
import deleteServiceReducer from '../features/service/deleteServiceSlice';
import approveServicesReducer from '../features/service/approveServicesSlice';

const store = configureStore({
    reducer: {
        provider: providerReducer,
        bookedService: bookedServiceReducer,
        customer: customerReducer,
        addServiceModal: addServiceModalSliceReducer,
        editService: editServiceReducer,
        deleteService: deleteServiceReducer,
        approveServices: approveServicesReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
