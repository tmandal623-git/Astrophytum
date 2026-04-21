import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface SidebarProps {
  collapsed:         boolean;
  mobileOpen:        boolean;
  onToggleCollapse:  () => void;
  onClose:           () => void;
}

interface NavItem {
  to:      string;
  icon:    string;
  label:   string;
  badge?:  number;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { to: '/home',       icon: '🏠', label: 'Home' },
      { to: '/categories', icon: '🏷️', label: 'Categories' },
    ],
  },
  {
    title: 'Trading',
    items: [
      { to: '/auctions', icon: '🔨', label: 'Auctions', badge: 4 },
      { to: '/my-bids',  icon: '📋', label: 'My Bids' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin', icon: '⚙️', label: 'Admin' },
    ],
  },
];

export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onClose }: SidebarProps) {
  return (
    <aside
      className={cn(
        // Base
        'fixed top-0 left-0 h-screen z-50 flex flex-col',
        'bg-[#1a2e1a] text-green-100',
        'transition-all duration-300 ease-in-out overflow-hidden',
        // Desktop width
        collapsed ? 'lg:w-16' : 'lg:w-60',
        // Mobile: hidden by default, slide in when open
        'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
          🌵
        </div>
        <span
          className={cn(
            'font-display text-xl text-white whitespace-nowrap',
            'transition-all duration-200',
            collapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100',
          )}
        >
          AstrophytumLab
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            {/* Section label */}
            <p
              className={cn(
                'px-5 py-1 text-[10px] font-semibold tracking-[1.5px] uppercase text-white/30',
                'whitespace-nowrap overflow-hidden transition-all duration-200',
                collapsed ? 'lg:opacity-0 lg:h-0 lg:py-0' : 'opacity-100',
              )}
            >
              {section.title}
            </p>

            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 px-5 py-2.5 text-sm font-medium',
                    'transition-colors duration-150 group',
                    isActive
                      ? 'text-white bg-white/10'
                      : 'text-green-200/70 hover:text-white hover:bg-white/6',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active left bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-amber-400 rounded-r" />
                    )}

                    <span className="text-lg w-6 text-center flex-shrink-0">{item.icon}</span>

                    <span
                      className={cn(
                        'whitespace-nowrap transition-all duration-200 flex-1',
                        collapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100',
                      )}
                    >
                      {item.label}
                    </span>

                    {item.badge !== undefined && !collapsed && (
                      <span className="ml-auto bg-amber-400 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          'hidden lg:flex items-center gap-3 px-5 py-4',
          'border-t border-white/10 text-green-200/60 hover:text-white',
          'transition-colors duration-150 text-sm flex-shrink-0',
        )}
      >
        <span
          className={cn(
            'text-lg transition-transform duration-300',
            collapsed ? 'rotate-180' : 'rotate-0',
          )}
        >
          ◀
        </span>
        <span
          className={cn(
            'whitespace-nowrap transition-all duration-200',
            collapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100',
          )}
        >
          Collapse
        </span>
      </button>
    </aside>
  );
}
