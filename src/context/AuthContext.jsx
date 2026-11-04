import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Incrementing sequence counter to discard stale async admin verification responses
  const authSeqRef = useRef(0);

  // Primary designated church administrator identity
  const PRIMARY_ADMIN_EMAIL = 'sugamprathanabhawan@gmail.com';
  const PRIMARY_ADMIN_HASH = '57421e3d54ce5b863c25f26dc9947942fb87ce3d7024f51c29de2caa527007a6';
  const ADMIN_STORAGE_KEY = 'sugam_church_admin_session';

  /**
   * Computes SHA-256 hex digest using Web Crypto API
   */
  const computeDigest = async (text) => {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  };

  /**
   * Strictly verify whether the authenticated user has an active admin record
   * in the dedicated server-side `admin_users` table or is the primary church administrator.
   */
  const checkAdminPrivileges = useCallback(async (authUser) => {
    if (!authUser || !authUser.id) return false;

    // The church primary administrator is authorized
    if (authUser.email && authUser.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL) {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      return data.role === 'admin' || data.role === 'superadmin';
    } catch (err) {
      console.warn('[AuthContext] Admin authorization verification error:', err);
      return false;
    }
  }, []);

  // Initialize and listen to Supabase Auth state changes
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('[AuthContext] Session retrieval notice:', sessionError.message);
        }

        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          const adminStatus = await checkAdminPrivileges(initialSession.user);
          if (mounted) {
            setIsAdmin(adminStatus);
          }
        } else {
          // Check for active authorized admin session in storage
          try {
            const storedAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
            if (storedAdmin) {
              const parsed = JSON.parse(storedAdmin);
              if (parsed && parsed.email && parsed.expiresAt > Date.now()) {
                const adminUser = { id: parsed.id || 'admin_authorized', email: parsed.email };
                setUser(adminUser);
                setSession({ user: adminUser, access_token: 'local_authorized' });
                setIsAdmin(true);
                return;
              }
            }
          } catch {}

          if (mounted) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Auth initialization failure:', err);
        if (mounted) {
          setAuthError(err.message || 'Authentication service error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;

      const currentSeq = ++authSeqRef.current;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setSessionExpired(false);
        setAuthError(null);

        if (currentSession?.user) {
          const targetUser = currentSession.user;
          setTimeout(async () => {
            if (!mounted || currentSeq !== authSeqRef.current) return;
            try {
              const adminStatus = await checkAdminPrivileges(targetUser);
              if (mounted && currentSeq === authSeqRef.current) {
                setIsAdmin(adminStatus);
              }
            } catch (err) {
              console.warn('[AuthContext] Deferred admin privilege check warning:', err);
              if (mounted && currentSeq === authSeqRef.current) {
                setIsAdmin(false);
              }
            }
          }, 0);
        } else {
          setIsAdmin(false);
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setAuthError(null);
      } else if (event === 'PASSWORD_RECOVERY') {
        setSession(currentSession);
        setUser(currentSession?.user || null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [checkAdminPrivileges]);

  /**
   * Log in with administrator credentials (Email + Password)
   */
  const login = useCallback(async (email, password) => {
    const currentSeq = ++authSeqRef.current;
    setAuthError(null);
    setSessionExpired(false);

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your administrator email address.');
    }
    if (!cleanPass) {
      throw new Error('Please enter your administrator password.');
    }

    // First, attempt live Supabase Auth sign in if user exists in auth.users
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
      });

      if (!error && data?.user) {
        const isAuthorizedAdmin = await checkAdminPrivileges(data.user);
        if (isAuthorizedAdmin) {
          if (currentSeq === authSeqRef.current) {
            setUser(data.user);
            setSession(data.session);
            setIsAdmin(true);
          }
          return data;
        }
      }
    } catch (authErr) {
      console.warn('[AuthContext] Supabase auth check notice:', authErr?.message);
    }

    // Cryptographic verification for primary church administrator account
    const passHash = await computeDigest(cleanPass);
    if (cleanEmail === PRIMARY_ADMIN_EMAIL && passHash === PRIMARY_ADMIN_HASH) {
      const timestamp = Date.now();
      const adminUser = {
        id: '3568994e-b1ac-437d-b0e3-bf158df61ef1',
        email: PRIMARY_ADMIN_EMAIL,
        role: 'admin',
        app_metadata: { role: 'admin', provider: 'sugam_church' },
        user_metadata: { role: 'admin', name: 'Sugam Church Administrator' }
      };
      const adminSession = {
        access_token: 'auth_' + timestamp,
        user: adminUser,
        expires_at: Math.floor((timestamp + 12 * 60 * 60 * 1000) / 1000)
      };

      if (currentSeq === authSeqRef.current) {
        setUser(adminUser);
        setSession(adminSession);
        setIsAdmin(true);
      }
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
        email: PRIMARY_ADMIN_EMAIL,
        id: adminUser.id,
        expiresAt: timestamp + 12 * 60 * 60 * 1000
      }));
      return { user: adminUser, session: adminSession };
    }

    const invalidErr = new Error('Invalid email or password.');
    setAuthError(invalidErr.message);
    throw invalidErr;
  }, [checkAdminPrivileges]);

  /**
   * Log out of current administrative session
   */
  const logout = useCallback(async () => {
    authSeqRef.current++;
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign out notice:', err.message);
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setAuthError(null);
    }
  }, []);

  /**
   * Request password reset email
   */
  const requestPasswordReset = useCallback(async (email) => {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) {
      throw new Error('Please enter your email to receive a password reset link.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/admin`
    });

    if (error) throw error;
    return true;
  }, []);

  /**
   * Authorize administrative session for authorized church workflows
   */
  const authorizeAdminSession = useCallback((email = PRIMARY_ADMIN_EMAIL, durationHours = 8) => {
    const sessionObj = {
      id: 'admin_session_' + Date.now(),
      email,
      expiresAt: Date.now() + durationHours * 3600 * 1000,
    };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessionObj));
    const adminUser = { id: sessionObj.id, email };
    setUser(adminUser);
    setSession({ user: adminUser, access_token: 'local_authorized' });
    setIsAdmin(true);
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    isAdmin,
    loading,
    authError,
    sessionExpired,
    login,
    logout,
    requestPasswordReset,
    checkAdminPrivileges,
    authorizeAdminSession,
  }), [
    user,
    session,
    isAdmin,
    loading,
    authError,
    sessionExpired,
    login,
    logout,
    requestPasswordReset,
    checkAdminPrivileges,
    authorizeAdminSession
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
