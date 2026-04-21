import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onMenuClick:   () => void;
  theme:         'light' | 'dark';
  onToggleTheme: () => void;
}

const BREADCRUMBS: Record<string, { root: string; page: string }> = {
  '/home':       { root: 'CactusMart', page: 'Browse Cacti' },
  '/categories': { root: 'CactusMart', page: 'Categories' },
  '/auctions':   { root: 'CactusMart', page: 'Live Auctions' },
  '/my-bids':    { root: 'CactusMart', page: 'My Bids' },
  '/admin':      { root: 'CactusMart', page: 'Admin Dashboard' },
};

export function Header({ onMenuClick, theme, onToggleTheme }: HeaderProps) {
  const location = useLocation();

  // Match by prefix so /cactus/5 works too
  const matched  = Object.keys(BREADCRUMBS).find((k) => location.pathname.startsWith(k));
  const crumb    = matched
    ? BREADCRUMBS[matched]
    : { root: 'CactusMart', page: 'Page' };

  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">

      {/* Left — hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
          <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">{crumb.root}</span>
          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-white">{crumb.page}</span>
        </nav>
      </div>

      {/* Right — search + theme toggle */}
      <div className="flex items-center gap-3">

        {/* Search bar (decorative — hook up to router search if needed) */}
        <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 cursor-pointer hover:border-cactus-400 transition-colors min-w-[180px]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          Search cacti...
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className={`
            relative w-12 h-6 rounded-full transition-colors duration-300
            ${isDark ? 'bg-cactus-600' : 'bg-gray-300'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
              flex items-center justify-center text-xs
              transition-transform duration-300
              ${isDark ? 'translate-x-6' : 'translate-x-0'}
            `}
          >
            {isDark ? '🌙' : '☀️'}
          </span>
        </button>
      </div>
    </header>
  );
}
