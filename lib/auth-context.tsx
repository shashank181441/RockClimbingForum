'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Profile, UserRole } from './types';
import {
  fetchMe,
  logout as apiLogout,
  type AuthUser,
} from '@/lib/api/forum';
import { getToken } from '@/lib/api/client';

interface AuthContextValue {
  user: AuthUser | null;
  session: { access_token: string } | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Call after login/register so context picks up the new token */
  setAuthState: (payload: {
    user: AuthUser;
    profile: Profile | null;
    roles: UserRole[];
  }) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  setAuthState: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const setAuthState = useCallback(
    (payload: { user: AuthUser; profile: Profile | null; roles: UserRole[] }) => {
      const token = getToken();
      setUser(payload.user);
      setProfile(payload.profile);
      setRoles(payload.roles);
      setSession(token ? { access_token: token } : null);
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    const me = await fetchMe();
    if (!me) {
      setUser(null);
      setProfile(null);
      setRoles([]);
      setSession(null);
      return;
    }
    setUser(me.user);
    setProfile(me.profile);
    setRoles(me.roles);
    const token = getToken();
    setSession(token ? { access_token: token } : null);
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setSession(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await fetchMe();
        if (!mounted) return;
        if (me) {
          setUser(me.user);
          setProfile(me.profile);
          setRoles(me.roles);
          const token = getToken();
          setSession(token ? { access_token: token } : null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        refreshProfile,
        signOut,
        setAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
