import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  ShieldAlert, 
  ArrowLeft, 
  LogOut, 
  KeyRound,
  CheckCircle2
} from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { 
    user, 
    session, 
    isAdmin, 
    loading, 
    authError, 
    sessionExpired, 
    login, 
    logout, 
    requestPasswordReset 
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // 1. Initial Auth Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#173a4b] via-[#214b60] to-[#122b37] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl mb-4">
          <Loader2 className="w-8 h-8 text-[#7cc5dc] animate-spin" />
        </div>
        <h2 className="text-xl font-bold font-serif tracking-wide mb-1">Sugam Church Portal</h2>
        <p className="text-xs text-[#a2d5e5] font-medium tracking-wider uppercase animate-pulse">
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  // 2. Authenticated but Unauthorized (Non-Admin User)
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-red-200/80 p-8 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 font-serif mb-2">Unauthorized Access</h2>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            You are signed in as <strong className="text-slate-800 font-semibold">{user.email}</strong>, but this account is not registered as an authorized church administrator.
          </p>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 text-left mb-6">
            <strong>Need Admin Access?</strong> Contact the senior church leadership or system administrator at <span className="underline">sugamprathanabhawan@gmail.com</span> to request admin privileges.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => logout()}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <Link
              to="/"
              className="flex-1 py-3 px-4 bg-[#285c73] hover:bg-[#214b60] text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated: Render Admin Login Form
  if (!user || !session) {
    const handleLoginSubmit = async (e) => {
      e.preventDefault();
      setErrorMessage('');
      setSubmitting(true);

      try {
        await login(email, password);
      } catch (err) {
        setErrorMessage(err.message || 'Invalid administrator login credentials.');
      } finally {
        setSubmitting(false);
      }
    };

    const handlePasswordResetSubmit = async (e) => {
      e.preventDefault();
      setResetError('');
      setResetSending(true);

      try {
        await requestPasswordReset(resetEmail || email);
        setResetSuccess(true);
      } catch (err) {
        setResetError(err.message || 'Failed to send password reset email.');
      } finally {
        setResetSending(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#122b37] via-[#173a4b] to-[#214b60] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/40 p-8 sm:p-10 relative z-10 animate-scale-in">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#214b60] to-[#4b9fb9] text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#285c73]/20">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">Admin Portal</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Sugam Prathana Bhawan • Official Management
            </p>
          </div>

          {/* Session Expired Notice */}
          {sessionExpired && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Session Expired</strong>
                Your administrative session has timed out. Please sign in again to continue managing church content.
              </div>
            </div>
          )}

          {/* Error Notice */}
          {(errorMessage || authError) && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">
                {errorMessage || authError}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sugamchurch.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#285c73] rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#285c73]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowResetModal(true);
                  }}
                  className="text-[11px] font-semibold text-[#285c73] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-4 pr-11 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#285c73] rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#285c73]/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-[#214b60] to-[#285c73] hover:from-[#173a4b] hover:to-[#214b60] text-white text-sm font-bold rounded-2xl shadow-lg shadow-[#285c73]/25 hover:shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-[#285c73] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Website</span>
            </Link>
            <span className="text-[11px] text-slate-400 font-mono">
              Protected by Supabase Auth
            </span>
          </div>
        </div>

        {/* Password Reset Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-in">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#285c73] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-center text-slate-900 mb-1">Reset Password</h3>
              <p className="text-xs text-center text-slate-500 mb-4">
                Enter your administrative email to receive a secure recovery link.
              </p>

              {resetSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-emerald-800 mb-3">
                    Password reset link sent! Please check your inbox.
                  </p>
                  <button
                    onClick={() => {
                      setShowResetModal(false);
                      setResetSuccess(false);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
                  {resetError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                      {resetError}
                    </div>
                  )}
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@sugamchurch.com"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#285c73]/20"
                  />
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetSending}
                      className="flex-1 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      {resetSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Authenticated & Authorized: Render the Protected Admin Page
  return <>{children}</>;
}
