import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Header } from '../components/header/Header';
import { useTheme } from '../context/ThemeContext';

const FOOTER_LINKS = [
  { to: '/about',    label: 'About'    },
  { to: '/faq',      label: 'FAQ'      },
  { to: '/shipping', label: 'Shipping' },
  { to: '/contact',  label: 'Contact'  },
  { to: '/privacy',  label: 'Privacy'  },
];

export function MainLayout() {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  // Start each page at the top (e.g. after clicking a footer link)
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className={`flex min-h-screen bg-stone-50 dark:bg-gray-950 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
      }`}>
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </main>
        <footer className="border-t border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400 text-center">
          <span className="font-display text-base text-gray-700 dark:text-gray-300">🌵 AstrophytumLab</span>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {FOOTER_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} className="hover:text-cactus-600 transition-colors">{label}</Link>
            ))}
          </div>
          <span>© 2026 AstrophytumLab</span>
        </footer>
      </div>
    </div>
  );
}
