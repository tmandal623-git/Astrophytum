// src/context/AuthContext.tsx
import {
  createContext, useCallback, useContext,
  useEffect, useState, ReactNode,
} from 'react';
import { useToast } from './ToastContext';

// ── Idle auto-logout config ───────────────────────────────────
const IDLE_TIMEOUT_MS   = 5 * 60 * 1000;   // log out after 5 min of inactivity
const IDLE_CHECK_MS     = 10 * 1000;       // how often to check
const ACTIVITY_WRITE_MS = 5 * 1000;        // throttle localStorage writes
const LAST_ACTIVITY_KEY = 'astro:lastActivity';
const ACTIVITY_EVENTS   = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

// Last activity is kept in localStorage so activity in any tab keeps all tabs alive
const readLastActivity = () => {
  try { return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0; } catch { return 0; }
};
const writeLastActivity = (t: number) => {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(t)); } catch { /* storage unavailable */ }
};

// ── Types ─────────────────────────────────────────────────────
export interface AuthUser {
  id:       string;
  username: string;
  email:    string;
  role:     'user' | 'admin';
  avatar:   string | null;
}

interface AuthContextValue {
  user:         AuthUser | null;
  loading:      boolean;          // true while checking session on mount
  isLoggedIn:   boolean;
  isAdmin:      boolean;
  login:        (email: string, password: string) => Promise<void>;
  register:     (username: string, email: string, password: string) => Promise<void>;
  logout:       () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, isLoggedIn: false, isAdmin: false,
  login: async () => {}, register: async () => {}, logout: async () => {},
});

// ── Helper ────────────────────────────────────────────────────
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: 'include',   // send/receive cookies
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast }         = useToast();

  // ── Restore session on mount ──────────────────────────────
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (data) => {
        // Returning after being away longer than the idle timeout → end the session
        const last = readLastActivity();
        if (last && Date.now() - last > IDLE_TIMEOUT_MS) {
          await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          setUser(null);
          showToast('You were logged out due to inactivity', 'info');
          return;
        }
        writeLastActivity(Date.now());
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    writeLastActivity(Date.now());
    setUser(data.user);
  }, []);

  // ── Register ──────────────────────────────────────────────
  const register = useCallback(async (
    username: string, email: string, password: string,
  ) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ username, email, password }),
    });
    writeLastActivity(Date.now());
    setUser(data.user);
  }, []);

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  // ── Idle auto-logout ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_MS) return;
      lastWrite = now;
      writeLastActivity(now);
    };

    const checkIdle = () => {
      if (Date.now() - readLastActivity() > IDLE_TIMEOUT_MS) {
        logout();
        showToast('You were logged out after 5 minutes of inactivity', 'info');
      }
    };

    onActivity();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    // Background tabs throttle timers, so also check when the tab becomes visible again
    const onVisible = () => { if (document.visibilityState === 'visible') checkIdle(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkIdle, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [user, logout, showToast]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isLoggedIn: !!user,
      isAdmin:    user?.role === 'admin',
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
