// src/components/header/Header.tsx
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate }    from 'react-router-dom';
import { useAuth }                     from '../../context/AuthContext';
import { useAuthModal }                from '../../context/AuthModalContext';
import { useToast }                    from '../../context/ToastContext';
import { useCart }                     from '../../context/CartContext';
import { cn }                          from '../../utils/cn';

interface HeaderProps {
  onMenuClick:   () => void;
  theme:         'light' | 'dark';
  onToggleTheme: () => void;
}

const BREADCRUMBS: Record<string, string> = {
  '/home':           'Browse Cacti',
  '/auctions':       'Live Auctions',
  '/my-bids':        'My Bids',
  '/my-cart':        'My Cart',
  '/checkout':       'Checkout',
  '/order-confirmed':'Order Confirmed',
  '/orders':         'Order Details',
  '/admin':          'Admin Dashboard',
  '/profile':        'My Profile',
  '/reset-password': 'Reset Password',
  '/cactus':         'Cactus Detail',
  '/about':          'About Us',
  '/faq':            'FAQ',
  '/shipping':       'Shipping & Returns',
  '/contact':        'Contact Us',
  '/privacy':        'Privacy Policy',
};

export function Header({ onMenuClick, theme, onToggleTheme }: HeaderProps) {
  const location             = useLocation();
  const navigate             = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const { openModal }        = useAuthModal();
  const { showToast }        = useToast();
  const { totalItems }       = useCart();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // Current page label
  const matched  = Object.keys(BREADCRUMBS).find(k => location.pathname.startsWith(k));
  const pageLabel = matched ? BREADCRUMBS[matched] : 'Page';

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    showToast('Logged out successfully.');
    navigate('/home');
  };

  // Avatar initials
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">

      {/* ── Left: hamburger + breadcrumb ──────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <nav className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">CactusMart</span>
          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-white truncate">{pageLabel}</span>
        </nav>
      </div>

      {/* ── Right: theme + cart (mobile) + auth ───────────── */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* Dark/Light toggle */}
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0',
            theme === 'dark' ? 'bg-cactus-600' : 'bg-gray-300',
          )}
        >
          <span className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm flex items-center justify-center text-xs transition-transform duration-300',
            theme === 'dark' ? 'translate-x-6' : 'translate-x-0',
          )}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </span>
        </button>

        {/* Cart (mobile only) */}
        <button
          onClick={() => navigate('/my-cart')}
          aria-label={totalItems > 0 ? `My Cart (${totalItems} items)` : 'My Cart'}
          className="sm:hidden relative p-1.5 rounded-lg text-lg leading-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          🛒
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 bg-cactus-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </button>

        {/* ── Auth area ─────────────────────────────────────── */}
        {isLoggedIn && user ? (

          /* Logged-in: avatar + dropdown */
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Avatar circle */}
              <div className="w-7 h-7 rounded-full bg-cactus-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block max-w-[100px] truncate">
                {user.username}
              </span>
              <svg className={cn('w-3 h-3 text-gray-400 transition-transform', dropdownOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">

                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  {user.role === 'admin' && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>

                {/* Menu items */}
                {[
                  { icon: '👤', label: 'My Profile',  onClick: () => { navigate('/profile');   setDropdownOpen(false); } },
                  // { icon: '📋', label: 'My Bids',     onClick: () => { navigate('/my-bids');   setDropdownOpen(false); } },
                  { icon: '📋', label: 'My Bids',     onClick: () => { navigate('/profile?tab=bids');   setDropdownOpen(false); } },
                  { icon: '🛒', label: 'My Cart',     onClick: () => { navigate('/my-cart');   setDropdownOpen(false); } },
                  { icon: '📦', label: 'My Orders',   onClick: () => { navigate('/profile?tab=orders'); setDropdownOpen(false); } },
                  ...(user.role === 'admin'
                    ? [{ icon: '⚙️', label: 'Admin Dashboard', onClick: () => { navigate('/admin'); setDropdownOpen(false); } }]
                    : []
                  ),
                ].map(({ icon, label, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <span>{icon}</span>{label}
                  </button>
                ))}

                {/* Logout */}
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
                  >
                    <span>🚪</span> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (

          /* Not logged in: Login button */
          <button
            onClick={() => openModal(undefined, 'login')}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">Log In</span>
          </button>
        )}
      </div>
    </header>
  );
}