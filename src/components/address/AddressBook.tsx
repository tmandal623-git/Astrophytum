// src/components/address/AddressBook.tsx
// "Addresses" tab on the profile page: list, add, edit, remove and pick the default address.
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AddressInput, SavedAddress } from '../../types';
import { addressService } from '../../services/addressService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AddressCard } from './AddressCard';
import { AddressErrors, AddressForm, EMPTY_ADDRESS, toAddressInput, validateAddress } from './AddressForm';

type Editing = { id: number | 'new'; draft: AddressInput; makeDefault: boolean } | null;

export function AddressBook({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<Editing>(null);
  const [errors,    setErrors]    = useState<AddressErrors>({});
  const [saving,    setSaving]    = useState(false);

  const reload = () => addressService.list()
    .then(list => { setAddresses(list); onCountChange?.(list.length); })
    .catch(err => showToast(err.message, 'error'));

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const startNew = () => {
    setErrors({});
    setEditing({ id: 'new', draft: { ...EMPTY_ADDRESS, email: user?.email ?? '' }, makeDefault: addresses.length === 0 });
  };
  const startEdit = (a: SavedAddress) => {
    setErrors({});
    setEditing({ id: a.id, draft: toAddressInput(a), makeDefault: a.isDefault });
  };

  const save = async () => {
    if (!editing) return;
    const e = validateAddress(editing.draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (editing.id === 'new') await addressService.create(editing.draft, editing.makeDefault);
      else                      await addressService.update(editing.id, editing.draft, editing.makeDefault);
      showToast(editing.id === 'new' ? 'Address saved' : 'Address updated');
      setEditing(null);
      await reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save address', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: SavedAddress) => {
    if (!window.confirm(`Remove the address for ${a.firstName} ${a.lastName} (${a.label})?`)) return;
    try {
      await addressService.remove(a.id);
      showToast('Address removed');
      await reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove address', 'error');
    }
  };

  const makeDefault = async (a: SavedAddress) => {
    try {
      await addressService.setDefault(a.id);
      await reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update default address', 'error');
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map(i => <div key={i} className="h-36 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const form = editing && (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 sm:col-span-2">
      <h2 className="font-display text-xl text-gray-900 dark:text-white mb-5">
        {editing.id === 'new' ? 'Add a new address' : 'Edit address'}
      </h2>
      <AddressForm showLabel value={editing.draft} errors={errors}
        onChange={draft => setEditing({ ...editing, draft })} />
      <label className="flex items-start gap-2 mt-5 text-sm text-gray-600 dark:text-gray-400">
        <input type="checkbox" className="w-4 h-4 mt-0.5 flex-shrink-0 accent-cactus-600"
          checked={editing.makeDefault}
          // The only address is always the default, and the default can only move by picking another one
          disabled={(editing.id === 'new' && addresses.length === 0) || addresses.find(a => a.id === editing.id)?.isDefault}
          onChange={e => setEditing({ ...editing, makeDefault: e.target.checked })} />
        Make this my default address
      </label>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={() => setEditing(null)} disabled={saving}
          className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
          {saving ? 'Saving…' : 'Save address'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {editing?.id === 'new' ? form : (
        <button type="button" onClick={startNew}
          className="sm:col-span-2 flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-cactus-600 dark:text-cactus-400 hover:border-cactus-400 hover:bg-cactus-50/50 dark:hover:bg-cactus-950/40 transition-colors">
          <Plus className="w-4 h-4" aria-hidden />
          Add a new address
        </button>
      )}

      {addresses.length === 0 && !editing && (
        <p className="sm:col-span-2 text-center text-sm text-gray-400 py-8">
          No saved addresses yet. Save one here or at checkout to skip typing it next time.
        </p>
      )}

      {addresses.map(a => editing?.id === a.id
        ? <div key={a.id} className="contents">{form}</div>
        : (
          <AddressCard key={a.id} address={a} actions={<>
            <button type="button" onClick={() => startEdit(a)} className="text-cactus-600 dark:text-cactus-400 hover:underline">Edit</button>
            <button type="button" onClick={() => remove(a)} className="text-red-500 hover:underline">Remove</button>
            {!a.isDefault && (
              <button type="button" onClick={() => makeDefault(a)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline">Set as default</button>
            )}
          </>} />
        ))}
    </div>
  );
}
