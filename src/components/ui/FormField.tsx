// src/components/ui/FormField.tsx
// Labelled form field with an error line, plus the matching input/select classes.
import { cn } from '../../utils/cn';

export function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export const inputCls = (err?: string) => cn(
  'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
  'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-cactus-500 transition-colors',
  err ? 'border-red-400' : 'border-gray-200 dark:border-gray-700',
);
