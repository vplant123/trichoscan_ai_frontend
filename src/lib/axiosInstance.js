// src/lib/axiosInstance.js
import axios from 'axios';
import { auth } from '@/lib/firebase';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

const axiosInstance = axios.create({
  baseURL,
  timeout: 30000,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    // Attach a fresh Firebase ID token IF the user is signed in.
    // Anonymous questionnaire/upload calls simply send no token (public routes).
    try {
      if (typeof window !== 'undefined' && auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (e) {
      // token fetch failed — proceed without it (public routes still work)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const toApiErrorMessage = (error) => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Something went wrong while calling API';
  return String(message);
};

export default axiosInstance;