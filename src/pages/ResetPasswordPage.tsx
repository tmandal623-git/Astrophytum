// src/pages/ResetPasswordPage.tsx
// Landing page for the emailed reset link: /reset-password?token=...
// On success, sends the user home and opens the login modal.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Field }        from '../components/auth/AuthModal';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast }     from '../context/ToastContext';
import { useAuth }      from '../context/AuthContext';

export function ResetPasswordPage() {
  const [params]      = useSearchParams();
  const token         = params.get('token') ?? '';
  const navigate      = useNavigate();
  const { openModal } = useAuthModal();
  const { showToast } = useToast();
  const { logout }    = useAuth();

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState<{ password?: string; confirm?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (password.length < 6)   errs.password = 'At least 6 characters';
    if (password !== confirm)  errs.confirm  = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setApiError('');
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      // The reset revoked every existing session server-side; drop this tab's in-memory user too
      await logout();
      showToast('Password updated 🌵');
      navigate('/home', { replace: true });
      openModal('Your password was updated — log in with your new password.', 'login');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center border-b border-gray-100 dark:border-gray-800">
          <div className="text-4xl mb-1">🔑</div>
          <h1 className="font-display text-2xl text-gray-900 dark:text-white">Choose a new password</h1>
        </div>

        {!token ? (
          <div className="px-6 py-6 text-center flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This reset link is incomplete. Please use the link from your email, or request a new one.
            </p>
            <button
              onClick={() => { navigate('/home', { replace: true }); openModal(undefined, 'login'); }}
              className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 text-white font-semibold rounded-xl transition-colors"
            >
              Back to Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            {apiError && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <span>⚠️</span> {apiError}
              </div>
            )}
            <Field
              label="New Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            <Field
              label="Confirm New Password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                : 'Update Password'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
