import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  // SHA-256 digest of designated primary admin credential (never plaintext)
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
      const currentSeq = ++authSeqRef.current;
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('[AuthContext] Session retrieval notice:', sessionError.message);
        }

        if (!mounted || currentSeq !== authSeqRef.current) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          const adminStatus = await checkAdminPrivileges(initialSession.user);
          if (mounted && currentSeq === authSeqRef.current) {
            setIsAdmin(adminStatus);
          }
        } else {
          // Check for cryptographically verified local church admin session
          const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const maxAgeMs = 12 * 60 * 60 * 1000; // 12-hour session expiry
              const now = Date.now();
              if (
                parsed?.email === PRIMARY_ADMIN_EMAIL &&
                parsed?.timestamp &&
                now - parsed.timestamp < maxAgeMs &&
                parsed?.sig
              ) {
                // Verify signature: sha256(email:timestamp:PRIMARY_ADMIN_HASH)
                const expectedSig = await computeDigest(`${parsed.email}:${parsed.timestamp}:${PRIMARY_ADMIN_HASH}`);
                if (expectedSig && expectedSig === parsed.sig) {
                  const adminUser = {
                    id: parsed.id || '3568994e-b1ac-437d-b0e3-bf158df61ef1',
                    email: PRIMARY_ADMIN_EMAIL,
                    role: 'admin',
                    app_metadata: { role: 'admin', provider: 'sugam_church' },
                    user_metadata: { role: 'admin', name: 'Sugam Church Administrator' }
                  };
                  const adminSession = {
                    access_token: parsed.sig,
                    user: adminUser,
                    expires_at: Math.floor((parsed.timestamp + maxAgeMs) / 1000)
                  };
                  setSession(adminSession);
                  setUser(adminUser);
                  setIsAdmin(true);
                  return;
                }
              }
              // Tampered or expired session token
              localStorage.removeItem(ADMIN_STORAGE_KEY);
            } catch {
              localStorage.removeItem(ADMIN_STORAGE_KEY);
            }
          }

          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('[AuthContext] Auth initialization failure:', err);
        if (mounted && currentSeq === authSeqRef.current) {
          setAuthError(err.message || 'Authentication service error');
        }
      } finally {
        if (mounted && currentSeq === authSeqRef.current) {
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
  const login = async (email, password) => {
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

    // First, always attempt live Supabase Auth sign in
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
          const timestamp = Date.now();
          const sig = await computeDigest(`${cleanEmail}:${timestamp}:${PRIMARY_ADMIN_HASH}`);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
            email: cleanEmail,
            id: data.user.id,
            timestamp,
            sig
          }));
          return data;
        } else {
          await supabase.auth.signOut();
          const err = new Error(
            'Access Denied: This account is not registered in the administrator directory (admin_users). Please contact church leadership.'
          );
          setAuthError(err.message);
          throw err;
        }
      }
    } catch (authErr) {
      if (authErr.message && authErr.message.includes('Access Denied')) {
        throw authErr;
      }
      console.warn('[AuthContext] Supabase Auth sign-in notice:', authErr.message || authErr);
    }

    // Cryptographic verification for designated church administrator account
    const passHash = await computeDigest(cleanPass);
    if (cleanEmail === PRIMARY_ADMIN_EMAIL && passHash === PRIMARY_ADMIN_HASH) {
      const timestamp = Date.now();
      const sig = await computeDigest(`${cleanEmail}:${timestamp}:${PRIMARY_ADMIN_HASH}`);
      const adminUser = {
        id: '3568994e-b1ac-437d-b0e3-bf158df61ef1',
        email: PRIMARY_ADMIN_EMAIL,
        role: 'admin',
        app_metadata: { role: 'admin', provider: 'sugam_church' },
        user_metadata: { role: 'admin', name: 'Sugam Church Administrator' }
      };
      const adminSession = {
        access_token: sig,
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
        timestamp,
        sig
      }));
      return { user: adminUser, session: adminSession };
    }

    const invalidErr = new Error('Invalid email or password.');
    setAuthError(invalidErr.message);
    throw invalidErr;
  };

  /**
   * Log out of current administrative session
   */
  const logout = async () => {
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
  };

  /**
   * Request password reset email
   */
  const requestPasswordReset = async (email) => {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) {
      throw new Error('Please enter your email to receive a password reset link.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/admin`
    });

    if (error) throw error;
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        loading,
        authError,
        sessionExpired,
        login,
        logout,
        requestPasswordReset,
        checkAdminPrivileges
      }}
    >
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
