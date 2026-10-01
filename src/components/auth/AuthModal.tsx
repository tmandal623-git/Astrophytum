// src/components/auth/AuthModal.tsx
// Slide-in modal with Login / Register tabs.
// Shown when a protected action is attempted while logged out.

import { useState, useEffect } from 'react';
import { useAuth }             from '../../context/AuthContext';
import { useToast }            from '../../context/ToastContext';
import { cn }                  from '../../utils/cn';

type Tab = 'login' | 'register' | 'forgot';

interface AuthModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  // If provided, we show a contextual message explaining WHY login is needed
  reason?:   string;
  // Which tab to open with
  defaultTab?: Tab;
}

// ── Input field ───────────────────────────────────────────────
export function Field({
  label, type = 'text', value, onChange, error, placeholder, autoComplete,
}: {
  label: string; type?: string; value: string; placeholder?: string;
  onChange: (v: string) => void; error?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            'w-full px-3 py-2.5 text-sm border rounded-lg',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 transition-colors',
            error
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-200 dark:border-gray-700',
            isPassword && 'pr-10',
          )}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs select-none"
          >
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function AuthModal({ isOpen, onClose, reason, defaultTab = 'login' }: AuthModalProps) {
  const { login, register } = useAuth();
  const { showToast }       = useToast();

  const [tab,      setTab]      = useState<Tab>(defaultTab);
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors,   setLoginErrors]   = useState<{ email?: string; password?: string }>({});

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');
  const [regErrors,   setRegErrors]   = useState<{
    username?: string; email?: string; password?: string; confirm?: string;
  }>({});

  // Forgot-password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSent,  setForgotSent]  = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setApiError('');
      setLoginErrors({});
      setRegErrors({});
      setForgotError('');
      setForgotSent(false);
    }
  }, [isOpen, defaultTab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  // ── Login submit ───────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof loginErrors = {};
    if (!loginEmail.trim())    errs.email    = 'Email is required';
    if (!loginPassword)        errs.password = 'Password is required';
    setLoginErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setApiError('');
    try {
      await login(loginEmail.trim(), loginPassword);
      showToast('Welcome back! 🌵');
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Register submit ────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof regErrors = {};
    if (!regUsername.trim())                                      errs.username = 'Username is required';
    if (regUsername.trim().length < 3)                            errs.username = 'At least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail))            errs.email    = 'Valid email required';
    if (regPassword.length < 6)                                   errs.password = 'At least 6 characters';
    if (regPassword !== regConfirm)                               errs.confirm  = 'Passwords do not match';
    setRegErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setApiError('');
    try {
      await register(regUsername.trim(), regEmail.trim(), regPassword);
      showToast('Account created! Welcome to CactusMart 🌵');
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot-password submit ─────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotError('Valid email required');
      return;
    }
    setForgotError('');
    setLoading(true);
    setApiError('');
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: forgotEmail.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setForgotSent(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setLoading(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(loginEmail);   // carry over whatever was typed on the login form
    setForgotSent(false);
    setForgotError('');
    setApiError('');
    setTab('forgot');
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center border-b border-gray-100 dark:border-gray-800">
          <div className="text-4xl mb-1">🌵</div>
          <h2 className="font-display text-2xl text-gray-900 dark:text-white">CactusMart</h2>
          {reason && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-lg px-3 py-2 mt-3 border border-amber-100 dark:border-amber-900">
              {reason}
            </p>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setApiError(''); }}
              className={cn(
                'flex-1 py-3 text-sm font-semibold capitalize transition-colors',
                tab === t
                  ? 'text-cactus-600 dark:text-cactus-400 border-b-2 border-cactus-600 dark:border-cactus-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              )}
            >
              {t === 'login' ? 'Log In' : 'Register'}
            </button>
          ))}
        </div>

        {/* API error banner */}
        {apiError && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <span>⚠️</span> {apiError}
          </div>
        )}

        {/* ── LOGIN FORM ─── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="px-6 py-5 flex flex-col gap-4">
            <Field
              label="Email Address"
              type="email"
              value={loginEmail}
              onChange={setLoginEmail}
              error={loginErrors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={loginPassword}
              onChange={setLoginPassword}
              error={loginErrors.password}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={openForgot}
              className="self-end -mt-2 text-xs text-cactus-600 dark:text-cactus-400 font-medium hover:underline"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Logging in…</>
                : 'Log In'
              }
            </button>

            <p className="text-center text-xs text-gray-400">
              No account?{' '}
              <button
                type="button"
                onClick={() => setTab('register')}
                className="text-cactus-600 dark:text-cactus-400 font-medium hover:underline"
              >
                Register here
              </button>
            </p>
          </form>
        )}

        {/* ── REGISTER FORM ─── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="px-6 py-5 flex flex-col gap-4">
            <Field
              label="Username"
              value={regUsername}
              onChange={setRegUsername}
              error={regErrors.username}
              placeholder="cactus_lover"
              autoComplete="username"
            />
            <Field
              label="Email Address"
              type="email"
              value={regEmail}
              onChange={setRegEmail}
              error={regErrors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={regPassword}
              onChange={setRegPassword}
              error={regErrors.password}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            <Field
              label="Confirm Password"
              type="password"
              value={regConfirm}
              onChange={setRegConfirm}
              error={regErrors.confirm}
              placeholder="Repeat password"
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating account…</>
                : 'Create Account'
              }
            </button>

            <p className="text-center text-xs text-gray-400">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setTab('login')}
                className="text-cactus-600 dark:text-cactus-400 font-medium hover:underline"
              >
                Log in
              </button>
            </p>
          </form>
        )}

        {/* ── FORGOT PASSWORD ─── */}
        {tab === 'forgot' && (
          forgotSent ? (
            <div className="px-6 py-6 flex flex-col gap-4 text-center">
              <div className="text-4xl">📬</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                If an account exists for <span className="font-semibold">{forgotEmail.trim()}</span>,
                we've sent a link to reset your password. It expires in 30 minutes.
              </p>
              <p className="text-xs text-gray-400">Don't see it? Check your spam folder.</p>
              <button
                type="button"
                onClick={() => setTab('login')}
                className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 text-white font-semibold rounded-xl transition-colors"
              >
                Back to Log In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="px-6 py-5 flex flex-col gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email you registered with and we'll send you a link to choose a new password.
              </p>
              <Field
                label="Email Address"
                type="email"
                value={forgotEmail}
                onChange={setForgotEmail}
                error={forgotError}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                  : 'Send Reset Link'
                }
              </button>
              <p className="text-center text-xs text-gray-400">
                Remembered it?{' '}
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-cactus-600 dark:text-cactus-400 font-medium hover:underline"
                >
                  Back to log in
                </button>
              </p>
            </form>
          )
        )}

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 px-6 pb-5">
          You can browse and view items without logging in.<br />
          Login is required to place bids or purchase items.
        </p>
      </div>
    </div>
  );
}