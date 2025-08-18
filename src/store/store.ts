import { configureStore } from '@reduxjs/toolkit';
import providerReducer from '../features/provider/providerSlice';
import bookedServiceReducer from '../features/bookedService/bookedServiceSlice';
import customerReducer from '../features/customer/customerSlice';

const store = configureStore({
  reducer: {
    provider: providerReducer,
  bookedService: bookedServiceReducer,
  customer: customerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
