// src/context/AuthModalContext.tsx
// Provides a global openModal() so any component can trigger
// the auth modal without prop-drilling.

import {
  createContext, useCallback, useContext,
  useState, ReactNode,
} from 'react';
import { AuthModal } from '../components/auth/AuthModal';

interface AuthModalContextValue {
  openModal:  (reason?: string, defaultTab?: 'login' | 'register') => void;
  closeModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openModal:  () => {},
  closeModal: () => {},
});

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open,   setOpen]   = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [tab,    setTab]    = useState<'login' | 'register'>('login');

  const openModal = useCallback((
    r?: string,
    defaultTab: 'login' | 'register' = 'login',
  ) => {
    setReason(r);
    setTab(defaultTab);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <AuthModal
        isOpen={open}
        onClose={closeModal}
        reason={reason}
        defaultTab={tab}
      />
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => useContext(AuthModalContext);