import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';
import { checkSessionStatus, fetchFullResult, downloadReport } from '@/app/hair-assessment/HairAssessmentApi';
import { toApiErrorMessage } from '@/lib/axiosInstance';

const rejectWithMessage = (thunkApi, error) => thunkApi.rejectWithValue(toApiErrorMessage(error));

export const checkSessionStatusThunk = createAsyncThunk(
  'report/checkSessionStatus',
  async (sessionId, thunkApi) => {
    try {
      return await checkSessionStatus(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const fetchFullResultThunk = createAsyncThunk(
  'report/fetchFullResult',
  async (sessionId, thunkApi) => {
    try {
      return await fetchFullResult(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const downloadReportThunk = createAsyncThunk(
  'report/downloadReport',
  async (sessionId, thunkApi) => {
    try {
      return await downloadReport(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

const trackedThunks = [checkSessionStatusThunk, fetchFullResultThunk, downloadReportThunk];

const reportSlice = createSlice({
  name: 'report',
  initialState: {
    loading: {},
    errors: {},
  },
  reducers: {
    clearReportError(state, action) {
      const key = action.payload;
      if (!key) {
        state.errors = {};
        return;
      }
      delete state.errors[key];
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        isAnyOf(...trackedThunks.map((thunk) => thunk.pending)),
        (state, action) => {
          const key = action.type.replace('/pending', '');
          state.loading[key] = true;
          state.errors[key] = null;
        }
      )
      .addMatcher(
        isAnyOf(...trackedThunks.map((thunk) => thunk.fulfilled)),
        (state, action) => {
          const key = action.type.replace('/fulfilled', '');
          state.loading[key] = false;
        }
      )
      .addMatcher(
        isAnyOf(...trackedThunks.map((thunk) => thunk.rejected)),
        (state, action) => {
          const key = action.type.replace('/rejected', '');
          state.loading[key] = false;
          state.errors[key] = action.payload || action.error?.message || 'Request failed';
        }
      );
  },
});

export const { clearReportError } = reportSlice.actions;

export const selectReportState = (state) => state.report;
export const selectReportLoadingByKey = (state, key) =>
  Boolean(state.report?.loading?.[key]);
export const selectReportErrorByKey = (state, key) =>
  state.report?.errors?.[key] ?? null;

export const selectReportDownloadLoading = (state) =>
  selectReportLoadingByKey(state, 'report/downloadReport');
export const selectReportDownloadError = (state) =>
  selectReportErrorByKey(state, 'report/downloadReport');
export const selectReportDataLoading = (state) =>
  selectReportLoadingByKey(state, 'report/checkSessionStatus') ||
  selectReportLoadingByKey(state, 'report/fetchFullResult');

export default reportSlice.reducer;
