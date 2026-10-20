// src/components/header/Header.tsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate }           from 'react-router-dom';
import { HandCoins, LogOut, MapPin, Moon, Package, Search, Settings, ShoppingCart, Sun, UserRound } from 'lucide-react';
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

// Past this scroll offset the header gets its shadow, and on phones may slide away
const SCROLL_SHADOW_PX = 8;
const SCROLL_HIDE_PX   = 80;

export function Header({ onMenuClick, theme, onToggleTheme }: HeaderProps) {
  const navigate             = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const { openModal }        = useAuthModal();
  const { showToast }        = useToast();
  const { totalItems }       = useCart();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // ── Search (tablet/desktop; results open on the Home page via ?q=) ──
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    navigate(`/home?q=${encodeURIComponent(term)}`);
    setQuery('');
  };

  // ── Scroll: shadow once scrolled; on phones hide while scrolling down, show on scroll up ──
  const [scrolled, setScrolled] = useState(false);
  const [hidden,   setHidden]   = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > SCROLL_SHADOW_PX);
      if (y < SCROLL_HIDE_PX)  setHidden(false);
      else if (y > lastY + 4)  setHidden(true);
      else if (y < lastY - 4)  setHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Never slide away while the account menu is open
  const slideAway = hidden && !dropdownOpen;

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
    <header className={cn(
      'sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 h-14 px-3 sm:px-6',
      // Frosted glass — falls back to solid where backdrop blur isn't supported
      'bg-white dark:bg-gray-900 supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-gray-900/75 backdrop-blur-md',
      'border-b transition-[transform,box-shadow,border-color] duration-300',
      scrolled
        ? 'border-gray-200/80 dark:border-gray-800/80 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)]'
        : 'border-gray-200 dark:border-gray-800',
      slideAway && 'max-md:-translate-y-full',
    )}>

      {/* ── Left: hamburger + logo (until the sidebar shows) + search ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo — the sidebar (which carries it on desktop) is hidden below lg */}
        <Link to="/home" className="lg:hidden flex items-center gap-2 min-w-0">
          <img src="/Images/Logo.jpeg" alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <span className="font-display text-base sm:text-lg text-gray-900 dark:text-white whitespace-nowrap truncate max-[339px]:hidden">Astrophytum Lab</span>
        </Link>

        {/* Search (tablet/desktop) */}
        <form onSubmit={submitSearch} role="search" className="hidden md:block flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search cacti, cultivars, seeds…" aria-label="Search cacti"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 focus:bg-white dark:focus:bg-gray-900 transition-colors" />
          </div>
        </form>
      </div>

      {/* ── Right: theme + cart + auth ───────────────────── */}
      <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">

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
            {theme === 'dark'
              ? <Moon className="w-3 h-3 text-cactus-700" aria-hidden />
              : <Sun  className="w-3 h-3 text-amber-500" aria-hidden />}
          </span>
        </button>

        {/* Cart */}
        <button
          onClick={() => navigate('/my-cart')}
          aria-label={totalItems > 0 ? `My Cart (${totalItems} items)` : 'My Cart'}
          className="relative p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" aria-hidden />
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
              aria-label="Account menu"
              className="flex items-center gap-2 p-1 sm:pl-2 sm:pr-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Avatar circle */}
              <div className="w-7 h-7 rounded-full bg-cactus-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block max-w-[100px] truncate">
                {user.username}
              </span>
              <svg className={cn('hidden sm:block w-3 h-3 text-gray-400 transition-transform', dropdownOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                  { icon: UserRound,    label: 'My Profile',  onClick: () => { navigate('/profile');   setDropdownOpen(false); } },
                  // { icon: '📋', label: 'My Bids',     onClick: () => { navigate('/my-bids');   setDropdownOpen(false); } },
                  { icon: HandCoins,    label: 'My Bids',     onClick: () => { navigate('/profile?tab=bids');   setDropdownOpen(false); } },
                  { icon: ShoppingCart, label: 'My Cart',     onClick: () => { navigate('/my-cart');   setDropdownOpen(false); } },
                  { icon: Package,      label: 'My Orders',   onClick: () => { navigate('/profile?tab=orders'); setDropdownOpen(false); } },
                  { icon: MapPin,       label: 'My Addresses', onClick: () => { navigate('/profile?tab=addresses'); setDropdownOpen(false); } },
                  ...(user.role === 'admin'
                    ? [{ icon: Settings, label: 'Admin Dashboard', onClick: () => { navigate('/admin'); setDropdownOpen(false); } }]
                    : []
                  ),
                ].map(({ icon: Icon, label, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.75} aria-hidden />{label}
                  </button>
                ))}

                {/* Logout */}
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} aria-hidden /> Log Out
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