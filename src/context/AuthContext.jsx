// src/context/AuthContext.jsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, sendPhoneOtp } from '@/lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Always returns a FRESH id token (Firebase auto-refreshes if expired).
  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  // Step 1 of phone auth — sends OTP, returns confirmationResult.
  const startPhoneAuth = useCallback(async (e164Phone) => {
    return sendPhoneOtp(e164Phone);
  }, []);

  // Step 2 — confirm the 6-digit code. On success, onAuthStateChanged fires.
  const confirmPhoneOtp = useCallback(async (confirmationResult, code) => {
    const cred = await confirmationResult.confirm(code);
    return cred.user; // has .uid, .phoneNumber
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, authReady, isAuthenticated: !!firebaseUser, getIdToken, startPhoneAuth, confirmPhoneOtp, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}