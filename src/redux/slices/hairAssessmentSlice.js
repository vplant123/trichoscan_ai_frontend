import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';
import {
  getAssessmentQuestions,
  createSession,
  updateAnswers,
  finalizeQuiz,
  uploadImage,
  triggerAnalysis,
  checkSessionStatus,
  createLead,
  fetchReport,
  verifyOtp,
  resendOtp,
} from '@/app/hair-assessment/HairAssessmentApi';
import { toApiErrorMessage } from '@/lib/axiosInstance';

const rejectWithMessage = (thunkApi, error) => thunkApi.rejectWithValue(toApiErrorMessage(error));

export const fetchAssessmentQuestionsThunk = createAsyncThunk(
  'hairAssessment/fetchQuestions',
  async (_, thunkApi) => {
    try {
      return await getAssessmentQuestions();
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const createSessionThunk = createAsyncThunk(
  'hairAssessment/createSession',
  async (_, thunkApi) => {
    try {
      return await createSession();
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const updateAnswersThunk = createAsyncThunk(
  'hairAssessment/updateAnswers',
  async ({ sessionId, answersData }, thunkApi) => {
    try {
      return await updateAnswers(sessionId, answersData);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const finalizeQuizThunk = createAsyncThunk(
  'hairAssessment/finalizeQuiz',
  async (sessionId, thunkApi) => {
    try {
      return await finalizeQuiz(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const uploadImageThunk = createAsyncThunk(
  'hairAssessment/uploadImage',
  async ({ sessionId, photoId, file }, thunkApi) => {
    try {
      return await uploadImage(sessionId, photoId, file);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const triggerAnalysisThunk = createAsyncThunk(
  'hairAssessment/triggerAnalysis',
  async ({ sessionId, skipPhotos = false }, thunkApi) => {
    try {
      return await triggerAnalysis(sessionId, skipPhotos);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const checkSessionStatusThunk = createAsyncThunk(
  'hairAssessment/checkSessionStatus',
  async (sessionId, thunkApi) => {
    try {
      return await checkSessionStatus(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const createLeadThunk = createAsyncThunk(
  'hairAssessment/createLead',
  async (leadData, thunkApi) => {
    try {
      return await createLead(leadData);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const fetchReportThunk = createAsyncThunk(
  'hairAssessment/fetchReport',
  async (sessionId, thunkApi) => {
    try {
      return await fetchReport(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const verifyOtpThunk = createAsyncThunk(
  'hairAssessment/verifyOtp',
  async ({ sessionId, otp }, thunkApi) => {
    try {
      return await verifyOtp(sessionId, otp);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

export const resendOtpThunk = createAsyncThunk(
  'hairAssessment/resendOtp',
  async (sessionId, thunkApi) => {
    try {
      return await resendOtp(sessionId);
    } catch (error) {
      return rejectWithMessage(thunkApi, error);
    }
  }
);

const trackedThunks = [
  fetchAssessmentQuestionsThunk,
  createSessionThunk,
  updateAnswersThunk,
  finalizeQuizThunk,
  uploadImageThunk,
  triggerAnalysisThunk,
  checkSessionStatusThunk,
  createLeadThunk,
  fetchReportThunk,
  verifyOtpThunk,
  resendOtpThunk,
];

const initialState = {
  loading: {},
  errors: {},
};

const hairAssessmentSlice = createSlice({
  name: 'hairAssessment',
  initialState,
  reducers: {
    clearHairAssessmentError(state, action) {
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

export const { clearHairAssessmentError } = hairAssessmentSlice.actions;

export const selectHairAssessmentState = (state) => state.hairAssessment;
export const selectHairAssessmentLoadingByKey = (state, key) =>
  Boolean(state.hairAssessment?.loading?.[key]);
export const selectHairAssessmentErrorByKey = (state, key) =>
  state.hairAssessment?.errors?.[key] ?? null;

export const selectCreateSessionLoading = (state) =>
  selectHairAssessmentLoadingByKey(state, 'hairAssessment/createSession');
export const selectCreateSessionError = (state) =>
  selectHairAssessmentErrorByKey(state, 'hairAssessment/createSession');

export default hairAssessmentSlice.reducer;
