// src/components/info/InfoPage.tsx
// Shared shell for the static info pages (About, FAQ, Shipping, Contact, Privacy).
import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function InfoPage({ icon, title, subtitle, updated, children }: {
  icon:      string;
  title:     string;
  subtitle?: string;
  updated?:  string;
  children:  ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-4xl mb-3">{icon}</p>
        <h1 className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white mb-2">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {updated && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Last updated: {updated}</p>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function InfoSection({ title, icon, className, children }: {
  title?:     string;
  icon?:      string;
  className?: string;
  children:   ReactNode;
}) {
  return (
    <section className={cn(
      'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 sm:p-6',
      className,
    )}>
      {title && (
        <h2 className="font-display text-xl text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          {title}
        </h2>
      )}
      <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 space-y-3">{children}</div>
    </section>
  );
}

export function InfoList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-cactus-500">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
