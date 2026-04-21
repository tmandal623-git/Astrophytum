import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Header } from '../components/header/Header';
import { useTheme } from '../context/ThemeContext';

export function MainLayout() {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

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

      <div className={`flex flex-col flex-1 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
      }`}>
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
        <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between text-sm text-gray-400">
          <span className="font-display text-base text-gray-700 dark:text-gray-300">🌵 AstrophytumLab</span>
          <div className="flex gap-4">
            {['About','FAQ','Shipping','Contact','Privacy'].map((l) => (
              <a key={l} className="hover:text-cactus-600 transition-colors cursor-pointer">{l}</a>
            ))}
          </div>
          <span>© 2026 AstrophytumLab</span>
        </footer>
      </div>
    </div>
  );
}
