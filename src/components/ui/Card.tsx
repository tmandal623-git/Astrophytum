import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children:   ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?:   () => void;
}

export function Card({ children, className, hoverable, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl',
        hoverable && 'cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}