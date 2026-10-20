// src/components/address/AddressCard.tsx
// One saved address. With onSelect it becomes a radio-style option (checkout); actions go in the footer.
import { Home, BriefcaseBusiness, MapPin } from 'lucide-react';
import { SavedAddress } from '../../types';
import { getCountry } from '../../utils/locations';
import { cn } from '../../utils/cn';

const LABEL_ICONS: Record<string, typeof Home> = { Home, Work: BriefcaseBusiness };

export function AddressCard({ address, selected, onSelect, actions }: {
  address:   SavedAddress;
  selected?: boolean;
  onSelect?: () => void;
  actions?:  React.ReactNode;
}) {
  const Icon = LABEL_ICONS[address.label] ?? MapPin;
  const body = (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        {onSelect && (
          <span aria-hidden className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
            selected ? 'border-cactus-600' : 'border-gray-300 dark:border-gray-600')}>
            {selected && <span className="w-2 h-2 rounded-full bg-cactus-600" />}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
          <Icon className="w-3 h-3" aria-hidden />
          {address.label}
        </span>
        {address.isDefault && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300">
            Default
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
        {address.firstName} {address.lastName}
        {address.phone && <span className="font-normal text-gray-500 dark:text-gray-400"> · {address.phone}</span>}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5 break-words">
        {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
        {address.city}, {address.state} {address.zip} · {getCountry(address.country)?.name ?? address.country}
      </p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{address.email}</p>
    </>
  );

  return (
    <div className={cn('rounded-xl border-2 transition-colors bg-white dark:bg-gray-900',
      selected ? 'border-cactus-500 bg-cactus-50/40 dark:bg-cactus-950/40' : 'border-gray-200 dark:border-gray-700')}>
      {onSelect
        ? <button type="button" onClick={onSelect} aria-pressed={selected} className="w-full text-left p-4">{body}</button>
        : <div className="p-4">{body}</div>}
      {actions && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 -mt-1 text-xs font-medium">
          {actions}
        </div>
      )}
    </div>
  );
}
