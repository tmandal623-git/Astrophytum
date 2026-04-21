import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastMessage {
  id:      number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const variantClasses: Record<ToastVariant, string> = {
    success: 'bg-cactus-600 text-white',
    error:   'bg-red-600 text-white',
    info:    'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900',
  };

  const icons: Record<ToastVariant, string> = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
              animate-in slide-in-from-bottom-2 fade-in duration-300
              ${variantClasses[t.variant]}
            `}
          >
            <span className="w-5 h-5 flex-shrink-0 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {icons[t.variant]}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
