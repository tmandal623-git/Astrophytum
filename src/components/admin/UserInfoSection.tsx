// src/components/admin/UserInfoSection.tsx
// Admin: search users by username or email and view one user's profile,
// contact details (from their latest checkout), activity totals and recent orders.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn }          from '../../utils/cn';
import { StatusBadge } from '../ui/StatusBadge';
import { Pagination }  from '../ui/Pagination';
import { TrackingStatus } from '../../utils/orderTracking';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE          = 8;

// ── Types ─────────────────────────────────────────────────────
interface UserSummary {
  id:         string;
  username:   string;
  email:      string;
  role:       string;
  avatar:     string | null;
  createdAt:  string;
  orderCount: number;
}

interface UserPage {
  items:      UserSummary[];
  totalCount: number;
  totalPages: number;
  page:       number;
  pageSize:   number;
}

interface UserContact {
  firstName:    string;
  lastName:     string;
  email:        string;
  phone:        string | null;
  addressLine1: string;
  addressLine2: string | null;
  city:         string;
  state:        string;
  zip:          string;
  country:      string;
}

interface UserOrder {
  id:             number;
  total:          number;
  paymentMethod:  string;
  paymentStatus:  string;
  trackingStatus: TrackingStatus;
  createdAt:      string;
}

interface UserDetail extends UserSummary {
  phone:        string | null;
  totalSpent:   number;
  lastOrderAt:  string | null;
  bidCount:     number;
  reviewCount:  number;
  contact:      UserContact | null;
  recentOrders: UserOrder[];
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: 'Card', paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay / UPI',
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

async function getJson<T>(url: string): Promise<T> {
  const res  = await fetch(url, { credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

// ── Small pieces ──────────────────────────────────────────────
function Avatar({ user, size = 'sm' }: { user: Pick<UserSummary, 'username' | 'avatar'>; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm';
  return user.avatar
    ? <img src={user.avatar} alt="" className={cn(cls, 'rounded-full object-cover flex-shrink-0')} />
    : (
      <div className={cn(cls, 'rounded-full flex-shrink-0 flex items-center justify-center font-semibold bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300')}>
        {user.username.charAt(0).toUpperCase()}
      </div>
    );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      'inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize',
      role === 'admin'
        ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    )}>
      {role === 'admin' ? 'Admin' : 'Customer'}
    </span>
  );
}

function InfoRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-3">
          <span className="text-[11px] sm:text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
          <span className="text-gray-900 dark:text-white sm:text-right [overflow-wrap:anywhere]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</p>;
}

// ── Main section ──────────────────────────────────────────────
export function UserInfoSection() {
  const [search,        setSearch]        = useState('');
  const [users,         setUsers]         = useState<UserSummary[]>([]);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalCount,    setTotalCount]    = useState(0);
  const [listLoading,   setListLoading]   = useState(true);
  const [listError,     setListError]     = useState('');
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [detail,        setDetail]        = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState('');
  // Only the newest request may update state, so slow responses can't overwrite newer ones
  const listRequest   = useRef(0);
  const detailRequest = useRef(0);

  const loadUsers = useCallback(async (term: string, pageNo: number) => {
    const reqId = ++listRequest.current;
    setListLoading(true); setListError('');
    try {
      const body = await getJson<UserPage>(
        `/api/admin/users?search=${encodeURIComponent(term.trim())}&page=${pageNo}&pageSize=${PAGE_SIZE}`);
      if (reqId !== listRequest.current) return;
      // Page past the end (e.g. users removed since) → jump to the last page
      if (body.items.length === 0 && body.totalCount > 0 && pageNo > body.totalPages) { setPage(body.totalPages); return; }
      setUsers(body.items); setTotalPages(body.totalPages); setTotalCount(body.totalCount);
    } catch (err) {
      if (reqId === listRequest.current) setListError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      if (reqId === listRequest.current) setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const reqId = ++detailRequest.current;
    setDetailLoading(true); setDetailError('');
    try {
      const body = await getJson<UserDetail>(`/api/admin/users/${id}`);
      if (reqId === detailRequest.current) setDetail(body);
    } catch (err) {
      if (reqId === detailRequest.current) { setDetail(null); setDetailError(err instanceof Error ? err.message : 'Failed to load user'); }
    } finally {
      if (reqId === detailRequest.current) setDetailLoading(false);
    }
  }, []);

  // Search as the admin types (debounced); an empty box lists the newest users
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    if (search === debouncedSearch) return;
    // A new search starts on page 1 — set together so only one request goes out
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);
  useEffect(() => { loadUsers(debouncedSearch, page); }, [debouncedSearch, page, loadUsers]);

  const selectUser = (id: string) => { setSelectedId(id); loadDetail(id); };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl">👤</span>
          <div>
            <h2 className="font-display text-xl text-gray-900 dark:text-white">User Info</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Search a user by username or email to see their details</p>
          </div>
        </div>
        <button onClick={() => { loadUsers(debouncedSearch, page); if (selectedId) loadDetail(selectedId); }}
          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          ↺ Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">

        {/* ── Search + results ──────────────────────────────── */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 flex flex-col min-w-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search username or email…" aria-label="Search users"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500" />
            <p className="text-[11px] text-gray-400 mt-1.5">
              {listLoading && users.length === 0
                ? 'Loading users…'
                : `${totalCount} ${search.trim() ? 'matching ' : ''}user${totalCount === 1 ? '' : 's'}${search.trim() ? '' : ' · newest first'}`}
            </p>
          </div>

          {listError && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-950 text-sm text-red-600 dark:text-red-400 flex items-center justify-between border-b border-red-100 dark:border-red-900">
              ⚠️ {listError}
              <button onClick={() => loadUsers(debouncedSearch, page)} className="underline text-xs">Retry</button>
            </div>
          )}

          {listLoading && users.length === 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-2.5 w-44 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : !listError && users.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-3xl mb-2 opacity-40">🔍</p>
              <p className="text-sm text-gray-400">
                {search.trim() ? `No users match "${search.trim()}"` : 'No users yet.'}
              </p>
            </div>
          ) : (
            <>
            <ul className={cn('divide-y divide-gray-100 dark:divide-gray-800 transition-opacity', listLoading && 'opacity-60')}>
              {users.map(u => (
                <li key={u.id}>
                  <button type="button" onClick={() => selectUser(u.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      selectedId === u.id
                        ? 'bg-cactus-50 dark:bg-cactus-950/40'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                    )}>
                    <Avatar user={u} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{u.username}</p>
                        {u.role === 'admin' && <RoleBadge role={u.role} />}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {u.orderCount} order{u.orderCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 pb-4">
              <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount}
                pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="users" />
            </div>
            </>
          )}
        </div>

        {/* ── Selected user's details ───────────────────────── */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/40 min-w-0">
          {!selectedId ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center">
              <p className="text-4xl mb-3 opacity-30">👤</p>
              <p className="text-sm text-gray-400">Select a user to view their details.</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-56 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            </div>
          ) : detailError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
              ⚠️ {detailError}
              <button onClick={() => loadDetail(selectedId)} className="underline text-xs">Retry</button>
            </div>
          ) : detail && (
            <div className={cn('flex flex-col gap-5 transition-opacity', detailLoading && 'opacity-60')}>

              {/* Profile header */}
              <div className="flex items-center gap-4">
                <Avatar user={detail} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-xl text-gray-900 dark:text-white truncate">{detail.username}</h3>
                    <RoleBadge role={detail.role} />
                  </div>
                  <p title={detail.email} className="text-sm text-gray-500 dark:text-gray-400 truncate">{detail.email}</p>
                </div>
              </div>

              {/* Activity totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Orders',      value: detail.orderCount },
                  { label: 'Total Spent', value: `₹${detail.totalSpent.toFixed(2)}` },
                  { label: 'Bids',        value: detail.bidCount },
                  { label: 'Reviews',     value: detail.reviewCount },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                    <p className="font-display text-xl text-gray-900 dark:text-white mt-1">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Account */}
                <div className="flex flex-col gap-2">
                  <SectionLabel>Account</SectionLabel>
                  <InfoRows rows={[
                    { label: 'Username',   value: detail.username },
                    { label: 'Email',      value: detail.email },
                    { label: 'Mobile',     value: detail.phone ?? '—' },
                    { label: 'Role',       value: <RoleBadge role={detail.role} /> },
                    { label: 'Status',     value: <span className="text-cactus-600 dark:text-cactus-400 font-medium">Active</span> },
                    { label: 'Joined',     value: formatDate(detail.createdAt) },
                    { label: 'Last Order', value: formatDate(detail.lastOrderAt) },
                  ]} />
                </div>

                {/* Contact (from latest checkout) */}
                <div className="flex flex-col gap-2">
                  <SectionLabel>Contact Details <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(from latest order)</span></SectionLabel>
                  {detail.contact ? (
                    <InfoRows rows={[
                      { label: 'Name',    value: `${detail.contact.firstName} ${detail.contact.lastName}` },
                      { label: 'Email',   value: detail.contact.email },
                      { label: 'Phone',   value: detail.contact.phone ?? '—' },
                      { label: 'Address', value: (
                        <>
                          {detail.contact.addressLine1}
                          {detail.contact.addressLine2 && <>, {detail.contact.addressLine2}</>}
                          <br />
                          {detail.contact.city}, {detail.contact.state} {detail.contact.zip}
                          <br />
                          {detail.contact.country}
                        </>
                      ) },
                    ]} />
                  ) : (
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-400">
                      No orders yet — contact details are collected at checkout.
                    </div>
                  )}
                </div>
              </div>

              {/* Recent orders */}
              <div className="flex flex-col gap-2">
                <SectionLabel>Recent Orders</SectionLabel>
                {detail.recentOrders.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-400">
                    This user hasn't placed any orders.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
                    {detail.recentOrders.map(o => (
                      <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                          CM-{String(o.id).padStart(6, '0')}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(o.createdAt)}</span>
                        <span className="text-xs text-gray-400">{PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                        <span className="ml-auto flex items-center gap-3">
                          <span className="text-sm font-semibold text-cactus-700 dark:text-cactus-400">₹{o.total.toFixed(2)}</span>
                          <StatusBadge status={o.trackingStatus} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
