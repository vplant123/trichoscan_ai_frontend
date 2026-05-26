// src/app/hair-assessment/HairAssessmentApi.js
import axiosInstance from '@/lib/axiosInstance';

/* ─── PUBLIC tricho-scan calls (no auth needed) ─── */

export const getAssessmentQuestions = async () => {
  const res = await axiosInstance.get('/user/tricho-scan/questions');
  return res.data;
};

export const createSession = async () => {
  const res = await axiosInstance.post('/user/tricho-scan/');
  return res.data;
};

export const updateAnswers = async (sessionId, answersData) => {
  const payload = { answers: Array.isArray(answersData) ? answersData : [answersData] };
  const res = await axiosInstance.patch(`/user/tricho-scan/${sessionId}/answers`, payload);
  return res.data;
};

export const finalizeQuiz = async (sessionId) => {
  const res = await axiosInstance.post(`/user/tricho-scan/${sessionId}/questionnaire/complete`, {});
  return res.data;
};

// photoId param kept in signature for caller compatibility, but NOT sent — backend dropped it.
export const uploadImage = async (sessionId, photoId, file) => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await axiosInstance.post(`/user/tricho-scan/${sessionId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const triggerAnalysis = async (sessionId, skipPhotos = false) => {
  const res = await axiosInstance.post(`/user/tricho-scan/${sessionId}/trigger-analysis`, { skipPhotos });
  return res.data;
};

export const checkSessionStatus = async (sessionId) => {
  const res = await axiosInstance.get(`/user/tricho-scan/${sessionId}/status`);
  return res.data;
};

/* ─── PROTECTED — requires Firebase token (the unlock gate) ─── */

export const fetchFullResult = async (sessionId) => {
  const res = await axiosInstance.get(`/user/tricho-scan/${sessionId}/result`);
  return res.data;
};

/* ─── AUTH + LEAD (new) ─── */

// Called after Firebase phone auth → creates or fetches the Mongo user.
export const authUser = async ({ phone, email, authProvider = 'phone' }) => {
  const res = await axiosInstance.post('/user/users/auth', { phone, email, authProvider });
  return res.data;
};

// Saves the unlock-form lead details onto the session's lead sub-doc.
export const saveLead = async (sessionId, leadData) => {
  const res = await axiosInstance.patch(`/user/tricho-scan/${sessionId}/lead`, leadData);
  return res.data;
};