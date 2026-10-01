// src/hooks/useRequireAuth.ts
// Returns a function that either runs the callback (if logged in)
// or shows the auth modal with a contextual reason message.
//
// Usage:
//   const requireAuth = useRequireAuth();
//   <button onClick={() => requireAuth(handleBid, 'Please log in to place a bid.')}>
//     Place Bid
//   </button>

import { useCallback } from 'react';
import { useAuth }     from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';

export function useRequireAuth() {
  const { isLoggedIn } = useAuth();
  const { openModal }  = useAuthModal();

  return useCallback(
    (action: () => void, reason?: string) => {
      if (isLoggedIn) {
        action();
      } else {
        openModal(reason ?? 'Please log in to continue.');
      }
    },
    [isLoggedIn, openModal],
  );
}