import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';
import { setAuthToken } from '../api/client';

export type AuthUser = { id: string; name: string; email: string; avatar?: string; phone?: string; tier?: string };

type AuthValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: (payload: { token: string; user: AuthUser }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>(null as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    (async () => {
      const [[, t], [, u]] = await AsyncStorage.multiGet([STORAGE_KEYS.token, STORAGE_KEYS.user]);
      if (t) { setToken(t); setAuthToken(t); }
      if (u) { try { setUser(JSON.parse(u)); } catch {} }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async ({ token: t, user: u }: { token: string; user: AuthUser }) => {
    setToken(t); setUser(u); setAuthToken(t);
    await AsyncStorage.multiSet([[STORAGE_KEYS.token, t], [STORAGE_KEYS.user, JSON.stringify(u)]]);
  }, []);

  const signOut = useCallback(async () => {
    setToken(null); setUser(null); setAuthToken(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
  }, []);

  const value = useMemo(() => ({ ready, token, user, signIn, signOut }), [ready, token, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
