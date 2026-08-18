'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import type { Profile, UserRole } from './types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const profileLoadedForRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    setProfile(profileRes.data as Profile | null);
    setRoles((rolesRes.data || []).map((r: { role: UserRole }) => r.role));
    profileLoadedForRef.current = uid;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    userIdRef.current = null;
    profileLoadedForRef.current = null;
    setProfile(null);
    setRoles([]);
    setUser(null);
    setSession(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      userIdRef.current = nextUser?.id ?? null;
      setSession(data.session);
      setUser(nextUser);
      if (nextUser) {
        loadProfile(nextUser.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (!mounted) return;

        const nextUser = newSession?.user ?? null;
        const nextId = nextUser?.id ?? null;
        const sameUser = nextId === userIdRef.current;

        setSession(newSession);

        // Keep the same user object on token refresh so dependent pages don't refetch.
        if (!sameUser) {
          userIdRef.current = nextId;
          setUser(nextUser);
        }

        if (event === 'SIGNED_OUT' || !nextUser) {
          profileLoadedForRef.current = null;
          setProfile(null);
          setRoles([]);
        } else if (
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          (!sameUser && event !== 'TOKEN_REFRESHED') ||
          profileLoadedForRef.current !== nextUser.id
        ) {
          // Skip profile reload on pure TOKEN_REFRESHED when already loaded
          if (event !== 'TOKEN_REFRESHED' || profileLoadedForRef.current !== nextUser.id) {
            await loadProfile(nextUser.id);
          }
        }

        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
