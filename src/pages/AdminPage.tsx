import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cactusService } from '../services/cactusService';
import { categoryService } from '../services/categoryService';
import { CactusListItem, Category } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { cn } from '../utils/cn';
import { ImageUpload } from '../components/common/ImageUpload';

// ── Types ──────────────────────────────────────────────────
interface AdminStat {
  label: string;
  value: string | number;
  trend: string;
  icon:  string;
}

type ModalMode = 'add' | 'edit' | null;

interface CactusForm {
  name:        string;
  description: string;
  categoryId:  string;
  basePrice:   string;
  images: File[]; // New field
}

const EMPTY_FORM: CactusForm = { 
  name: '', 
  description: '', 
  categoryId: '', 
  basePrice: '', 
  images: []   // New field
};

// Bar chart heights (%) for Mon–Sun
const CHART_DATA = [
  { day: 'Mon', pct: 62, value: 620  },
  { day: 'Tue', pct: 45, value: 450  },
  { day: 'Wed', pct: 78, value: 780  },
  { day: 'Thu', pct: 55, value: 550  },
  { day: 'Fri', pct: 91, value: 910  },
  { day: 'Sat', pct: 83, value: 830  },
  { day: 'Sun', pct: 67, value: 670  },
];

// ── Component ──────────────────────────────────────────────
export function AdminPage() {
  const navigate        = useNavigate();
  const { showToast }   = useToast();

  const [cacti,      setCacti]      = useState<CactusListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [modalMode,  setModalMode]  = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<CactusListItem | null>(null);
  const [form,       setForm]       = useState<CactusForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<CactusForm>>({});
  const [saving,     setSaving]     = useState(false);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);

  // Load data
  useEffect(() => {
    Promise.all([
      cactusService.getAll(1, 50),
      categoryService.getAll(),
    ]).then(([paged, cats]) => {
      setCacti(paged.items);
      setCategories(cats);
    }).catch(() => showToast('Failed to load admin data.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Stats ──────────────────────────────────────────────
  const stats: AdminStat[] = [
    { label: 'Total Species',     value: cacti.length,                           icon: '🌵', trend: '↑ 3 this month' },
    { label: 'Live Auctions',     value: cacti.filter(c => c.hasAuction).length, icon: '🔨', trend: '● Active now'    },
    { label: 'Bids Today',        value: '$892',                                 icon: '💰', trend: '↑ 18% vs yesterday' },
    { label: 'Registered Bidders',value: 38,                                     icon: '👤', trend: '↑ 5 new today'  },
  ];

  // ── Filtered list ──────────────────────────────────────
  const filtered = cacti.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.categoryName.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Form helpers ───────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalMode('add');
  };

  const openEdit = (c: CactusListItem) => {
    setEditTarget(c);
    setForm({
      name:        c.name,
      description: c.description ?? '',
      categoryId:  String(categories.find(cat => cat.name === c.categoryName)?.id ?? ''),
      basePrice:   String(c.basePrice),
      images:      [], // Initialize as empty for new uploads during this edit session
    });
    setFormErrors({});
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditTarget(null); };

  const validate = (): boolean => {
    const errs: Partial<CactusForm> = {};
    if (!form.name.trim())       errs.name       = 'Name is required.';
    if (!form.categoryId)        errs.categoryId  = 'Please select a category.';
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price < 0) errs.basePrice = 'Enter a valid price ≥ 0.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId:  parseInt(form.categoryId, 10),
        basePrice:   parseFloat(form.basePrice),
      };

      if (modalMode === 'add') {
        const created = await cactusService.create(payload);
        setCacti((prev) => [
          { ...created, categoryName: categories.find(c => c.id === created.categoryId)?.name ?? '', hasAuction: false, thumbnailUrl: null },
          ...prev,
        ]);
        showToast('Cactus added successfully!');
      } else if (editTarget) {
        // 1. Send the FormData to your service
  // Your service should return the updated cactus object from the database
  const updatedCactus = await cactusService.update(editTarget.id, FormData);

  // 2. Update the local state using the server's response
  setCacti((prev) =>
    prev.map((c) => (c.id === editTarget.id ? { 
      ...c, 
      ...updatedCactus,
      // Ensure the category name is mapped if the backend only returns the ID
      categoryName: categories.find(cat => cat.id === updatedCactus.categoryId)?.name ?? c.categoryName 
    } : c))
  );

  showToast('Cactus updated successfully!');
}
      closeModal();
    } catch {
      showToast('Save failed. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteId(id);
    try {
      await cactusService.delete(id);
      setCacti((prev) => prev.filter((c) => c.id !== id));
      showToast('Cactus deleted.');
    } catch {
      showToast('Delete failed.', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900 dark:text-white mb-1">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your cactus inventory and auctions.</p>
        </div>
        <Button onClick={openAdd}>+ Add Cactus</Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, trend, icon }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
              <span className="text-xl">{icon}</span>
            </div>
            <p className="font-display text-3xl text-gray-900 dark:text-white">{value}</p>
            <p className="text-[11px] text-cactus-600 dark:text-cactus-400 mt-1">{trend}</p>
          </div>
        ))}
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Weekly Auction Revenue</p>
          <p className="text-xs text-gray-400">Past 7 days</p>
        </div>
        <div className="flex items-end gap-2 h-28">
          {CHART_DATA.map(({ day, pct, value }, i) => {
            const isFriday = day === 'Fri'; // highlight peak
            return (
              <div key={day} className="flex flex-col items-center gap-1 flex-1 group">
                <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  ${value}
                </span>
                <div
                  title={`${day}: $${value}`}
                  style={{ height: `${pct}%` }}
                  className={cn(
                    'w-full rounded-t transition-all duration-300 cursor-pointer',
                    isFriday
                      ? 'bg-amber-400 hover:bg-amber-500'
                      : 'bg-cactus-400 hover:bg-cactus-500 dark:bg-cactus-600 dark:hover:bg-cactus-500',
                  )}
                />
                <span className="text-[11px] text-gray-400">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display text-xl text-gray-900 dark:text-white flex-1">Inventory</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or category..."
          className="
            w-56 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700
            rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500
          "
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No results"
          description={search ? `No cacti match "${search}".` : 'No cacti in inventory yet.'}
          action={{ label: 'Add Cactus', onClick: openAdd }}
        />
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Base Price</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Auction</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-cactus-50 dark:bg-cactus-900 flex items-center justify-center text-lg flex-shrink-0">
                          {c.thumbnailUrl
                            ? <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                            : '🌵'
                          }
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-[11px] text-gray-400 line-clamp-1">{c.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <Badge variant="success">{c.categoryName}</Badge>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                      ${c.basePrice.toFixed(2)}
                    </td>

                    {/* Auction status */}
                    <td className="px-4 py-3 text-center">
                      {c.hasAuction
                        ? <Badge variant="danger" pulse>Live</Badge>
                        : <Badge variant="outline">None</Badge>
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/cactus/${c.id}`)}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                          title="View"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-cactus-50 dark:hover:bg-cactus-900 hover:border-cactus-300 text-gray-500 hover:text-cactus-600 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete "${c.name}"?`)) handleDelete(c.id); }}
                          disabled={deleteId === c.id}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          {deleteId === c.id
                            ? <span className="w-3.5 h-3.5 block border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-display text-xl text-gray-900 dark:text-white">
                {modalMode === 'add' ? 'Add New Cactus' : `Edit "${editTarget?.name}"`}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                ✕
              </button>
            </div>
            

            {/* Form */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <Input
                label="Name"
                placeholder="e.g. Golden Barrel"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={formErrors.name}
              />
              <ImageUpload
                files={form.images}
                onChange={(newFiles) => setForm({ ...form, images: newFiles })}
                maxFiles={5}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className={cn(
                    'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
                    'text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cactus-500 cursor-pointer',
                    formErrors.categoryId
                      ? 'border-red-400'
                      : 'border-gray-200 dark:border-gray-700',
                  )}
                >
                  <option value="">Select a category…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {formErrors.categoryId && <p className="text-xs text-red-500">{formErrors.categoryId}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the cactus species, care requirements, etc."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="
                    w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg
                    bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500
                    resize-none
                  "
                />
              </div>

              <Input
                label="Base Price ($)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                error={formErrors.basePrice}
              />
              
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>
                {modalMode === 'add' ? 'Save Cactus' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
