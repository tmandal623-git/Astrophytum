// src/components/address/AddressForm.tsx
// Delivery address fields (country → state → city pickers), shared by checkout and the profile address book.
import { useState } from 'react';
import { AddressInput, SavedAddress } from '../../types';
import { Field, inputCls } from '../ui/FormField';
import { cn } from '../../utils/cn';
import { SORTED_COUNTRIES, getCities, getStates } from '../../utils/locations';

const OTHER_CITY = '__other__';
const LABELS     = ['Home', 'Work', 'Other'];

export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

export const EMPTY_ADDRESS: AddressInput = {
  label:'Home', firstName:'', lastName:'', email:'', phone:'',
  line1:'', line2:'', city:'', state:'', zip:'', country:'IN',
};

export const toAddressInput = (a: SavedAddress): AddressInput => ({
  label: a.label, firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone ?? '',
  line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, zip: a.zip, country: a.country,
});

export function validateAddress(a: AddressInput): AddressErrors {
  const e: AddressErrors = {};
  if (!a.firstName.trim()) e.firstName = 'Required';
  if (!a.lastName.trim())  e.lastName  = 'Required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) e.email = 'Valid email required';
  if (!a.line1.trim())     e.line1     = 'Required';
  if (!a.city.trim())      e.city      = 'Required';
  if (!a.state.trim())     e.state     = 'Required';
  if (!a.zip.trim())       e.zip       = 'Required';
  return e;
}

export function AddressForm({ value, onChange, errors = {}, showLabel = false }: {
  value:      AddressInput;
  onChange:   (next: AddressInput) => void;
  errors?:    AddressErrors;
  showLabel?: boolean;    // Home / Work / Other picker (for saved addresses)
}) {
  // A saved city that isn't in the list (typed in by hand) opens on the free-text box
  const [cityOther, setCityOther] = useState(
    () => !!value.city && !getCities(value.country, value.state).includes(value.city));
  const set = (patch: Partial<AddressInput>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {showLabel && (
        <div className="sm:col-span-2">
          <Field label="Save as">
            <div className="flex gap-2">
              {LABELS.map(l => (
                <button key={l} type="button" onClick={() => set({ label: l })}
                  className={cn('px-4 py-1.5 rounded-full border text-sm font-medium transition-colors',
                    value.label === l
                      ? 'border-cactus-500 bg-cactus-50 dark:bg-cactus-950 text-cactus-700 dark:text-cactus-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300')}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
      <Field label="First Name" error={errors.firstName}>
        <input className={inputCls(errors.firstName)} placeholder="First Name" value={value.firstName} onChange={e => set({ firstName: e.target.value })} />
      </Field>
      <Field label="Last Name" error={errors.lastName}>
        <input className={inputCls(errors.lastName)} placeholder="Last Name" value={value.lastName} onChange={e => set({ lastName: e.target.value })} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input type="email" className={inputCls(errors.email)} placeholder="email@gmail.com" value={value.email} onChange={e => set({ email: e.target.value })} />
      </Field>
      <Field label="Phone">
        <input type="tel" className={inputCls()} placeholder="+91 78223 77667" value={value.phone} onChange={e => set({ phone: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address Line 1" error={errors.line1}>
          <input className={inputCls(errors.line1)} placeholder="Address Line 1" value={value.line1} onChange={e => set({ line1: e.target.value })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Address Line 2 (optional)">
          <input className={inputCls()} placeholder="Address Line 2…" value={value.line2} onChange={e => set({ line2: e.target.value })} />
        </Field>
      </div>
      <Field label="Country">
        <select
          className={inputCls()}
          value={value.country}
          onChange={e => { setCityOther(false); set({ country: e.target.value, state: '', city: '' }); }}
        >
          {SORTED_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="State / Province" error={errors.state}>
        <select
          className={inputCls(errors.state)}
          value={value.state}
          onChange={e => { setCityOther(false); set({ state: e.target.value, city: '' }); }}
        >
          <option value="">Select state</option>
          {getStates(value.country).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="City" error={errors.city}>
        <select
          className={inputCls(errors.city)}
          value={cityOther ? OTHER_CITY : value.city}
          disabled={!value.state}
          onChange={e => {
            const other = e.target.value === OTHER_CITY;
            setCityOther(other);
            set({ city: other ? '' : e.target.value });
          }}
        >
          <option value="">{value.state ? 'Select city' : 'Select state first'}</option>
          {getCities(value.country, value.state).map(c => <option key={c} value={c}>{c}</option>)}
          {value.state && <option value={OTHER_CITY}>Other (not listed)</option>}
        </select>
        {cityOther && (
          <input className={inputCls(errors.city)} placeholder="Enter your city / town" value={value.city} onChange={e => set({ city: e.target.value })} />
        )}
      </Field>
      <Field label="ZIP / PIN" error={errors.zip}>
        <input className={inputCls(errors.zip)} placeholder="ZIP / PIN" value={value.zip} onChange={e => set({ zip: e.target.value })} />
      </Field>
    </div>
  );
}
