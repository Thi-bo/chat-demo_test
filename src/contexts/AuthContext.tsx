import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../api/auth';
import * as authApi from '../api/auth';
import { api } from '../api/client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to authenticate using stored user state and session cookies
    setLoading(true);
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = async (email: string, password: string) => {
    // Initialiser le contexte CSRF si Sanctum est configuré ainsi (par sécurité)
    try {
      await api.get('/sanctum/csrf-cookie', { baseURL: import.meta.env.VITE_API_URL || '' });
    } catch (e) {
      // Ignore errors (might fail if the route doesn't exist)
    }
    const data = await authApi.login(email, password);
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
