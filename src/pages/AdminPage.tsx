// src/pages/AdminPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, AdminStats } from '../services/adminService';
import { categoryService }          from '../services/categoryService';
import { CactusListItem, Category } from '../types';
import { Badge }    from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../context/ToastContext';
import { cn }       from '../utils/cn';
import { compressImage, MAX_UPLOAD_BYTES } from '../utils/compressImage';
import { PaymentVerificationSection }  from '../components/admin/PaymentVerificationSection';



// ── Types ─────────────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | null;

interface CactusForm {
  name:         string;
  description:  string;
  categoryId:   string;
  basePrice:    string;
  forAuction:   boolean;
  startPrice:   string;
  bidIncrement: string;
  auctionHours: string;
  videoUrl:     string;
}

const EMPTY_FORM: CactusForm = {
  name: '', description: '', categoryId: '', basePrice: '',
  forAuction: false, startPrice: '', bidIncrement: '2.50',
  auctionHours: '48', videoUrl: '',
};

const inputCls = (err?: string) => cn(
  'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
  'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-cactus-500 transition-colors',
  err ? 'border-red-400' : 'border-gray-200 dark:border-gray-700',
);

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Image preview grid ────────────────────────────────────────
function ImagePreviewGrid({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  const MAX = 5;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Species Photos <span className="text-gray-400">({files.length}/{MAX})</span>
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
        {files.map((file, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
            <img src={URL.createObjectURL(file)} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => onRemove(i)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity">
              ✕
            </button>
            {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-cactus-600 text-white text-[9px] text-center py-0.5 font-medium">MAIN</span>}
          </div>
        ))}
        {Array.from({ length: MAX - files.length }).map((_, i) => (
          <div key={`e${i}`} className="aspect-square rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-600 text-xl">+</div>
        ))}
      </div>
    </div>
  );
}
// ── Payment verification types ────────────────────────────────
interface PendingOrderItem { name: string; quantity: number; unitPrice: number; }
interface PendingOrder {
  id: number; userId: string; username: string; email: string; total: number;
  paymentMethod: string; transactionId: string | null; paymentStatus: string;
  orderStatus: string; createdAt: string; firstName: string; lastName: string;
  phone: string | null; city: string; country: string; items: PendingOrderItem[] | null;
}
interface AuditEntry { id: number; action: string; note: string | null; createdAt: string; adminUsername: string; }

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  pending_verification: { label: 'Pending Verification', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  paid: { label: 'Paid', cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
};

function PayStatusBadge({ status }: { status: string }) {
  const c = PAY_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  return <span className={cn('inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border', c.cls)}>{c.label}</span>;
}

const INVENTORY_PAGE_SIZE = 6;

// ── Main AdminPage ────────────────────────────────────────────
export function AdminPage() {
  const navigate      = useNavigate();
  const { showToast } = useToast();
// ── Stats ─────────────────────────────────────────────────
  const [stats,        setStats]        = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  // ── Inventory ─────────────────────────────────────────────
  const [cacti,        setCacti]        = useState<CactusListItem[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [invLoading,   setInvLoading]   = useState(true);
  const [invError,     setInvError]     = useState('');
  const [search,       setSearch]       = useState('');
  const [invPage,      setInvPage]      = useState(1);
  const [deleteId,     setDeleteId]     = useState<number | null>(null);
  // ── Modal ─────────────────────────────────────────────────
  const [modalMode,    setModalMode]    = useState<ModalMode>(null);
  const [editTarget,   setEditTarget]   = useState<CactusListItem | null>(null);
  const [form,         setForm]         = useState<CactusForm>(EMPTY_FORM);
  const [formErrors,   setFormErrors]   = useState<Partial<Record<keyof CactusForm, string>>>({});
  const [imageFiles,   setImageFiles]   = useState<File[]>([]);
  const [saving,       setSaving]       = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  // ── Payment verification ──────────────────────────────────
  const [pendingOrders,  setPendingOrders]  = useState<PendingOrder[]>([]);
  const [pvLoading,      setPvLoading]      = useState(true);
  const [pvError,        setPvError]        = useState('');
  const [pvExpanded,     setPvExpanded]     = useState<number|null>(null);
  const [auditLogs,      setAuditLogs]      = useState<Record<number,AuditEntry[]>>({});
  const [rejectNotes,    setRejectNotes]    = useState<Record<number,string>>({});
  const [acting,         setActing]         = useState<number|null>(null);
  const [processed,      setProcessed]      = useState<Set<number>>(new Set());
// ── Load stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await adminService.getStats()); }
    catch { /* show zeros */ }
    finally { setStatsLoading(false); }
  }, []);
// ── Load inventory ────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    setInvLoading(true); setInvError('');
    try {
      const [paged, cats] = await Promise.all([
        fetch('/api/cactus?limit=100').then(r => r.json()),
        categoryService.getAll(),
      ]);
      setCacti(paged.items ?? []); setCategories(cats);
    } catch (err) { setInvError(err instanceof Error ? err.message : 'Failed'); }
    finally { setInvLoading(false); }
  }, []);
  // ── Load pending payments ─────────────────────────────────
  const loadPendingPayments = useCallback(async () => {
    setPvLoading(true); setPvError('');
    try {
      const res  = await fetch('/api/admin/pending-payments', { credentials:'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPendingOrders(Array.isArray(body) ? body : []);
    } catch (err) { setPvError(err instanceof Error ? err.message : 'Failed to load pending payments'); }
    finally { setPvLoading(false); }
  }, []);

  useEffect(() => { loadStats(); loadInventory(); loadPendingPayments(); }, []);

  const filtered = cacti.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.categoryName.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Inventory pagination (client-side) ────────────────────
  const invTotalPages = Math.max(1, Math.ceil(filtered.length / INVENTORY_PAGE_SIZE));
  // Clamp so deleting the last item on the last page doesn't leave an empty page
  const invCurrentPage = Math.min(invPage, invTotalPages);
  const pagedCacti = filtered.slice(
    (invCurrentPage - 1) * INVENTORY_PAGE_SIZE,
    invCurrentPage * INVENTORY_PAGE_SIZE,
  );
// ── Image handling ────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setImageFiles(prev => [...prev, ...selected].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
// ── Modal helpers ─────────────────────────────────────────
  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormErrors({}); setImageFiles([]); setModalMode('add'); };
  const openEdit = (c: CactusListItem) => {
    setEditTarget(c);
    setForm({ ...EMPTY_FORM, name: c.name, description: c.description ?? '', categoryId: String(categories.find(cat => cat.name === c.categoryName)?.id ?? ''), basePrice: String(c.basePrice), forAuction: c.hasAuction });
    setFormErrors({}); setImageFiles([]); setModalMode('edit');
  };
  const closeModal = () => { setModalMode(null); setEditTarget(null); setImageFiles([]); };

  const validate = () => {
    const errs: typeof formErrors = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.categoryId) errs.categoryId = 'Select a category.';
    if (isNaN(parseFloat(form.basePrice)) || parseFloat(form.basePrice) < 0) errs.basePrice = 'Enter a valid price ≥ 0.';
    if (form.forAuction && isNaN(parseFloat(form.startPrice))) errs.startPrice = 'Starting price required.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim()); fd.append('description', form.description.trim());
      fd.append('categoryId', form.categoryId); fd.append('basePrice', form.basePrice);
      fd.append('forAuction', String(form.forAuction));
      if (form.forAuction) { fd.append('startPrice', form.startPrice || form.basePrice); fd.append('bidIncrement', form.bidIncrement || '2.50'); fd.append('auctionHours', form.auctionHours || '48'); }
      if (form.videoUrl.trim()) fd.append('videoUrl', form.videoUrl.trim());
      // Resize large photos in the browser — the hosting platform caps a request at 4.5 MB
      const photos     = await Promise.all(imageFiles.map(compressImage));
      const totalBytes = photos.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > MAX_UPLOAD_BYTES) {
        throw new Error(`Photos are too large together (${(totalBytes / 1024 / 1024).toFixed(1)} MB). Upload fewer photos at a time.`);
      }
      photos.forEach(file => fd.append('images', file));
      const url = modalMode === 'add' ? '/api/cactus' : `/api/cactus/${editTarget?.id}`;
      const res = await fetch(url, { method: modalMode === 'add' ? 'POST' : 'PUT', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      showToast(modalMode === 'add' ? '🌵 Cactus added!' : 'Cactus updated!');
      closeModal(); await Promise.all([loadInventory(), loadStats()]);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/cactus/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setCacti(prev => prev.filter(c => c.id !== id));
      showToast(`"${name}" deleted.`); loadStats();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); }
    finally { setDeleteId(null); }
  };
  // ── Payment verification handlers ─────────────────────────
  const loadAudit = async (orderId: number) => {
    try {
      const res = await fetch(`/api/admin/payment-audit/${orderId}`, { credentials: 'include' });
      const body = await res.json();
      if (res.ok) setAuditLogs(prev => ({ ...prev, [orderId]: body }));
    } catch { /* non-fatal */ }
  };

  const togglePvExpand = (id: number) => {
    if (pvExpanded === id) { setPvExpanded(null); return; }
    setPvExpanded(id); loadAudit(id);
  };

  const handleVerify = async (orderId: number, action: 'approved' | 'rejected') => {
    const note = rejectNotes[orderId]?.trim();
    if (action === 'rejected' && !note) { alert('Please enter a rejection reason.'); return; }
    if (!window.confirm(action === 'approved' ? `Approve payment for order #${orderId}?` : `Reject payment for order #${orderId}?`)) return;
    setActing(orderId);
    try {
      const res = await fetch('/api/admin/verify-payment', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setProcessed(prev => new Set([...prev, orderId]));
      showToast(action === 'approved' ? `✅ Order #${orderId} approved!` : `❌ Order #${orderId} rejected.`);
      setTimeout(() => {
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        setProcessed(prev => { const s = new Set(prev); s.delete(orderId); return s; });
      }, 2000);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Action failed', 'error'); }
    finally { setActing(null); }
  };
  // ── Weekly chart max ──────────────────────────────────────
  const chartData  = stats?.weeklyChart ?? Array.from({ length: 7 }, (_, i) => ({ day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], revenue: 0, bidCount: 0 }));
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
  const todayDay   = new Date().toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Tue"
// ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Manage inventory, monitor auctions, track revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { loadStats(); loadInventory(); loadPendingPayments(); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            ↺ Refresh
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors">
            + Add Cactus
          </button>
        </div>
      </div>

      {/* ── Top row: 4 stat cards LEFT + Revenue chart RIGHT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Stat cards 2×2 grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* TOTAL SPECIES — green accent */}
          <div className="bg-cactus-600 rounded-xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-cactus-100 uppercase tracking-widest">Total Species</p>
              <span className="text-2xl opacity-80">🌵</span>
            </div>
            {statsLoading
              ? <div className="h-10 w-16 bg-cactus-500 rounded animate-pulse mt-2" />
              : <p className="font-display text-5xl text-white mt-1">{stats?.totalSpecies ?? 0}</p>
            }
            <p className="text-sm text-cactus-200 mt-1">
              {cacti.filter(c => !c.hasAuction).length} buy-now
            </p>
          </div>

          {/* LIVE AUCTIONS */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Auctions</p>
              <span className="text-2xl opacity-60">🔨</span>
            </div>
            {statsLoading
              ? <div className="h-10 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mt-2" />
              : <p className="font-display text-5xl text-gray-900 dark:text-white mt-1">{stats?.liveAuctions ?? 0}</p>
            }
            <p className="text-sm text-cactus-600 dark:text-cactus-400 mt-1">active right now</p>
          </div>

          {/* BIDS TODAY */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bids Today</p>
              <span className="text-2xl opacity-60">💰</span>
            </div>
            {statsLoading
              ? <div className="h-10 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mt-2" />
              : <p className="font-display text-5xl text-gray-900 dark:text-white mt-1">{stats?.bidsToday ?? 0}</p>
            }
            <p className="text-sm text-cactus-600 dark:text-cactus-400 mt-1">
              ₹{(stats?.bidsTodayValue ?? 0).toFixed(0)} total value
            </p>
          </div>

          {/* REGISTERED BIDDERS */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Registered Bidders</p>
              <span className="text-2xl opacity-60">👤</span>
            </div>
            {statsLoading
              ? <div className="h-10 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mt-2" />
              : <p className="font-display text-5xl text-gray-900 dark:text-white mt-1">{stats?.uniqueBidders ?? 0}</p>
            }
            <p className="text-sm text-cactus-600 dark:text-cactus-400 mt-1">all time</p>
          </div>
        </div>

        {/* Revenue chart — right panel */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Weekly Auction Revenue</p>
              <p className="text-xs text-gray-400 mt-0.5">Past 7 days</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl text-gray-900 dark:text-white">
                ₹{chartData.reduce((s, d) => s + d.revenue, 0).toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">total this week</p>
            </div>
          </div>

          {/* Bars */}
          {/* Fixed height so the bars' percentage heights have something to resolve against */}
          <div className="flex items-end gap-2 h-40 mt-auto pt-4">
            {statsLoading
              ? [62,45,75,50,90,80,65].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ height: `${h}%` }} />
                ))
              : chartData.map(({ day, revenue, bidCount }) => {
                  const pct     = Math.max(Math.round((revenue / maxRevenue) * 100), revenue > 0 ? 4 : 0);
                  const isToday = day === todayDay;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1 flex-1 h-full group">
                      <div className="relative w-full flex-1 min-h-0 flex items-end">
                        <div
                          title={`${day}: ₹${revenue.toFixed(0)} (${bidCount} bids)`}
                          style={{ height: pct > 0 ? `${pct}%` : '3px' }}
                          className={cn(
                            'w-full rounded-t transition-all duration-500 cursor-pointer',
                            isToday
                              ? 'bg-amber-400 hover:bg-amber-500'
                              : 'bg-cactus-400 dark:bg-cactus-600 hover:bg-cactus-500',
                          )}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                          <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap shadow">
                            ₹{revenue.toFixed(0)} · {bidCount} bid{bidCount !== 1 ? 's' : ''}
                          </div>
                          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-white" />
                        </div>
                      </div>
                      <span className={cn(
                        'text-[10px]',
                        isToday ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-gray-400',
                      )}>{day}</span>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* ── Inventory table ───────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl text-gray-900 dark:text-white">Inventory</h2>
            {!invLoading && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full font-medium">
                {filtered.length} items
              </span>
            )}
          </div>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setInvPage(1); }}
            placeholder="Search name or category…"
            className="w-full sm:w-52 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500" />
        </div>

        {invError && (
          <div className="px-5 py-3 bg-red-50 dark:bg-red-950 border-b border-red-100 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
            ⚠️ {invError} <button onClick={loadInventory} className="underline text-xs">Retry</button>
          </div>
        )}

        {invLoading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3 opacity-30">🌵</p>
            <p className="text-gray-400 text-sm">
              {search ? `No cacti match "${search}"` : 'No cacti yet — add one!'}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  {['Name','Category','Price','Rating','Auction','Actions'].map(h => (
                    <th key={h} className={cn(
                      'px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider',
                      h === 'Price' || h === 'Rating' ? 'text-right' : h === 'Auction' ? 'text-center' : 'text-left',
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {pagedCacti.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center">
                          {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <span>🌵</span>}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-[11px] text-gray-400 line-clamp-1 max-w-[160px]">{c.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="success">{c.categoryName}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">₹{Number(c.basePrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.ratingCount > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{Number(c.rating).toFixed(1)}</span>
                          <span className="text-[11px] text-gray-400">({c.ratingCount})</span>
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.hasAuction ? <Badge variant="danger" pulse>Live</Badge> : <Badge variant="outline">Buy Now</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => navigate(`/cactus/${c.id}`)} title="View"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button onClick={() => openEdit(c)} title="Edit"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-cactus-50 dark:hover:bg-cactus-900 hover:border-cactus-300 text-gray-500 hover:text-cactus-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(c.id, c.name)} disabled={deleteId === c.id} title="Delete"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40">
                          {deleteId === c.id
                            ? <span className="w-3.5 h-3.5 block border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-5">
            <Pagination
              currentPage={invCurrentPage}
              totalPages={invTotalPages}
              totalCount={filtered.length}
              pageSize={INVENTORY_PAGE_SIZE}
              onPageChange={setInvPage}
            />
          </div>
          </>
        )}
      </div>
      {/* ════════════════════════════════════════════════════════
          PAYMENT VERIFICATION SECTION
      ════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <div>
              <h2 className="font-display text-xl text-gray-900 dark:text-white">Payment Verification</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manually verify Google Pay / UPI transactions</p>
            </div>
            {pendingOrders.length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingOrders.length} pending
              </span>
            )}
          </div>
          <button onClick={loadPendingPayments}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            ↺ Refresh
          </button>
        </div>

        {/* Error */}
        {pvError && (
          <div className="px-5 py-3 bg-red-50 dark:bg-red-950 text-sm text-red-600 dark:text-red-400 flex items-center justify-between border-b border-red-100 dark:border-red-900">
            ⚠️ {pvError}
            <button onClick={loadPendingPayments} className="underline text-xs">Retry</button>
          </div>
        )}

        {/* Loading */}
        {pvLoading && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-5">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!pvLoading && pendingOrders.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-medium text-gray-500 dark:text-gray-400">No pending payments</p>
            <p className="text-sm text-gray-400 mt-1">All Google Pay orders have been verified.</p>
          </div>
        )}

        {/* Pending orders list */}
        {!pvLoading && pendingOrders.map(order => {
          const isExpanded = pvExpanded === order.id;
          const isDone = processed.has(order.id);
          return (
            <div key={order.id} className={cn('border-b border-gray-100 dark:border-gray-800 last:border-0 transition-all', isDone && 'opacity-50')}>

              {/* Row */}
              <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                      CM-{String(order.id).padStart(6, '0')}
                    </span>
                    <PayStatusBadge status={order.paymentStatus} />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {order.firstName} {order.lastName}
                    <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
                    {order.email}
                  </p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-sm font-semibold text-cactus-700 dark:text-cactus-400">₹{order.total.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString()}</span>
                    {order.transactionId && (
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                        UTR: {order.transactionId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => togglePvExpand(order.id)}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {isExpanded ? 'Hide ▲' : 'Details ▼'}
                  </button>
                  <button onClick={() => handleVerify(order.id, 'approved')} disabled={!!acting || isDone}
                    className="px-4 py-1.5 text-xs font-semibold bg-cactus-600 hover:bg-cactus-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5">
                    {acting === order.id ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✓'}
                    Approve
                  </button>
                  <button onClick={() => handleVerify(order.id, 'rejected')} disabled={!!acting || isDone}
                    className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                    ✕ Reject
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">

                    {/* Customer + payment details */}
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Details</p>
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 text-sm">
                        {[
                          { label: 'Name', value: `${order.firstName} ${order.lastName}` },
                          { label: 'Email', value: order.email },
                          { label: 'Phone', value: order.phone ?? '—' },
                          { label: 'City', value: `${order.city}, ${order.country}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-start justify-between gap-2">
                            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
                            <span className="text-gray-900 dark:text-white text-right">{value}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Details</p>
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 text-sm">
                        {[
                          { label: 'Method', value: 'Google Pay / UPI' },
                          { label: 'Amount', value: `₹${order.total.toFixed(2)}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-start justify-between gap-2">
                            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
                            <span className="text-gray-900 dark:text-white text-right">{value}</span>
                          </div>
                        ))}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">Transaction ID</span>
                          <span className={cn('text-right font-mono text-xs px-1.5 py-0.5 rounded', order.transactionId ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-red-500')}>
                            {order.transactionId ?? '⚠️ Not provided'}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">Status</span>
                          <PayStatusBadge status={order.paymentStatus} />
                        </div>
                      </div>
                    </div>

                    {/* Items + rejection note + audit */}
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Order Items</p>
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2">
                        {(order.items ?? []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                            <span className="font-medium text-gray-900 dark:text-white">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                          </div>
                        ))}
                        {(!order.items || order.items.length === 0) && <p className="text-sm text-gray-400">No items found</p>}
                      </div>

                      {/* Rejection reason */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Rejection Reason <span className="normal-case font-normal text-gray-300">(required if rejecting)</span>
                        </p>
                        <textarea rows={2} placeholder="e.g. Transaction ID not found in bank records…"
                          value={rejectNotes[order.id] ?? ''}
                          onChange={e => setRejectNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 resize-none" />
                      </div>

                      {/* Audit log */}
                      {auditLogs[order.id] && auditLogs[order.id].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Audit Log</p>
                          <div className="flex flex-col gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                            {auditLogs[order.id].map(entry => (
                              <div key={entry.id} className="flex items-start gap-2 text-xs">
                                <span className={cn('font-bold mt-0.5', entry.action === 'approved' ? 'text-cactus-600 dark:text-cactus-400' : 'text-red-500')}>
                                  {entry.action === 'approved' ? '✓' : '✕'}
                                </span>
                                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{entry.action}</span>
                                <span className="text-gray-400">by <span className="font-medium">{entry.adminUsername}</span></span>
                                <span className="text-gray-300 dark:text-gray-600 ml-auto">{new Date(entry.createdAt).toLocaleString()}</span>
                                {entry.note && <span className="text-gray-500 col-span-full">· {entry.note}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isDone && (
                        <div className="p-3 bg-cactus-50 dark:bg-cactus-950 border border-cactus-100 dark:border-cactus-900 rounded-lg text-sm text-cactus-700 dark:text-cactus-300 font-medium text-center">
                          ✓ Action completed — removing from queue…
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] max-h-[92dvh] flex flex-col">

            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="font-display text-xl text-gray-900 dark:text-white">
                  {modalMode === 'add' ? '🌵 Add New Cactus' : `Edit "${editTarget?.name}"`}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMode === 'add' ? 'Fill in the details to list a new species.' : 'Update the cactus information below.'}
                </p>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 flex flex-col gap-5">

              <Field label="Name" required error={formErrors.name}>
                <input type="text" placeholder="e.g. Golden Barrel Cactus" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls(formErrors.name)} />
              </Field>

              <div>
                <ImagePreviewGrid files={imageFiles} onRemove={i => setImageFiles(prev => prev.filter((_, idx) => idx !== i))} />
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={imageFiles.length >= 5}
                  className={cn('w-full py-2.5 border-2 border-dashed rounded-lg text-sm font-medium transition-colors',
                    imageFiles.length >= 5
                      ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'border-cactus-300 dark:border-cactus-700 text-cactus-600 dark:text-cactus-400 hover:bg-cactus-50 dark:hover:bg-cactus-950 cursor-pointer')}>
                  {imageFiles.length >= 5 ? '5/5 photos uploaded' : '+ Upload Photos'}
                </button>
                {modalMode === 'edit' && <p className="text-[11px] text-gray-400 mt-1">Leave empty to keep existing photos.</p>}
              </div>

              <Field label="Category" required error={formErrors.categoryId}>
                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className={inputCls(formErrors.categoryId)}>
                  <option value="">Select a category…</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </Field>

              <Field label="Description" hint="Describe the species, care requirements, origin, etc.">
                <textarea rows={3} placeholder="A magnificent columnar cactus native to the Sonoran Desert…"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inputCls() + ' resize-none'} />
              </Field>

              <Field label="Base Price (₹)" required error={formErrors.basePrice}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: e.target.value })}
                    className={cn(inputCls(formErrors.basePrice), 'pl-7')} />
                </div>
              </Field>

              <Field label="Care Guide Video URL" hint="YouTube embed URL (optional)">
                <input type="url" placeholder="https://www.youtube.com/embed/..." value={form.videoUrl}
                  onChange={e => setForm({ ...form, videoUrl: e.target.value })} className={inputCls()} />
              </Field>

              {/* Auction toggle */}
              <div className="flex flex-col gap-3">
                <div onClick={() => setForm({ ...form, forAuction: !form.forAuction })}
                  className={cn('flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all',
                    form.forAuction ? 'border-red-400 bg-red-50 dark:bg-red-950' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800')}>
                  <div>
                    <p className={cn('text-sm font-semibold', form.forAuction ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300')}>
                      🔨 Enable Live Auction
                    </p>
                    <p className={cn('text-xs mt-0.5', form.forAuction ? 'text-red-500' : 'text-gray-400')}>
                      {form.forAuction ? 'This cactus will be listed for bidding.' : 'Toggle on to list for auction.'}
                    </p>
                  </div>
                  <div className={cn('w-11 h-6 rounded-full relative transition-colors flex-shrink-0', form.forAuction ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600')}>
                    <div className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', form.forAuction ? 'translate-x-5' : 'translate-x-0.5')} />
                  </div>
                </div>

                {form.forAuction && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border border-red-100 dark:border-red-900 rounded-xl bg-white dark:bg-gray-900">
                    <Field label="Starting Bid (₹)" required error={formErrors.startPrice}>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={form.startPrice}
                          onChange={e => setForm({ ...form, startPrice: e.target.value })}
                          className={cn(inputCls(formErrors.startPrice), 'pl-6 text-xs py-2')} />
                      </div>
                    </Field>
                    <Field label="Increment (₹)">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input type="number" min="0.50" step="0.50" placeholder="2.50" value={form.bidIncrement}
                          onChange={e => setForm({ ...form, bidIncrement: e.target.value })}
                          className={cn(inputCls(), 'pl-6 text-xs py-2')} />
                      </div>
                    </Field>
                    <Field label="Duration (hrs)" error={formErrors.auctionHours}>
                      <input type="number" min="1" max="168" step="1" placeholder="48" value={form.auctionHours}
                        onChange={e => setForm({ ...form, auctionHours: e.target.value })}
                        className={cn(inputCls(formErrors.auctionHours), 'text-xs py-2')} />
                    </Field>
                    <p className="col-span-3 text-[11px] text-gray-400">
                      Auction ends in {form.auctionHours || '?'} hours from now.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
              <p className="text-xs text-gray-400">
                {modalMode === 'add' && imageFiles.length === 0 && <span className="text-amber-500">⚠ No photos selected</span>}
                {imageFiles.length > 0 && <span className="text-cactus-600 dark:text-cactus-400">{imageFiles.length} photo{imageFiles.length > 1 ? 's' : ''} ready</span>}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                    : modalMode === 'add' ? '🌵 Add Cactus' : 'Save Changes'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}