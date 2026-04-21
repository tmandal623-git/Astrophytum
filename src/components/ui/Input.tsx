import { InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
}

export function Input({ label, error, className, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <input
        {...rest}
        className={cn(
          'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
          'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
          'border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-cactus-500',
          'transition-colors duration-200',
          error && 'border-red-500 focus:ring-red-400',
          className,
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}