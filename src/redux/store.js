import { configureStore } from '@reduxjs/toolkit';
import hairAssessmentReducer from './slices/hairAssessmentSlice';
import reportReducer from './slices/reportSlice';

export const makeStore = () =>
  configureStore({
    reducer: {
      hairAssessment: hairAssessmentReducer,
      report: reportReducer,
    },
  });

export default makeStore;
