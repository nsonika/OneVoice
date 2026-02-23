import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';
import i18n from './i18n';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
};

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  preferredLanguage: string;
};

type SessionContextType = {
  token: string | null;
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  refreshMe: () => Promise<void>;
  updateMe: (patch: Partial<Pick<SessionUser, 'name' | 'preferredLanguage'>>) => Promise<void>;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signin', { email, password });
      i18n.locale = data.user?.preferredLanguage || 'en';
      setToken(data.token);
      setAuthToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', input);
      i18n.locale = data.user?.preferredLanguage || 'en';
      setToken(data.token);
      setAuthToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get('/users/me');
      i18n.locale = data?.preferredLanguage || 'en';
      setUser(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateMe = useCallback(async (patch: Partial<Pick<SessionUser, 'name' | 'preferredLanguage'>>) => {
    const { data } = await api.patch('/users/me', patch);
    i18n.locale = data?.preferredLanguage || 'en';
    setUser(data);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    i18n.locale = 'en';
  }, []);

  useEffect(() => {
    if (user?.preferredLanguage) {
      i18n.locale = user.preferredLanguage;
    }
  }, [user?.preferredLanguage]);

  const value = useMemo(
    () => ({ token, user, loading, signIn, signUp, refreshMe, updateMe, signOut }),
    [token, user, loading, signIn, signUp, refreshMe, updateMe, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
