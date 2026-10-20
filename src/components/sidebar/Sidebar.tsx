// src/components/sidebar/Sidebar.tsx
// Categories nav item removed.

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Gavel, HandCoins, House, Package, Settings, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

interface SidebarProps {
  mobileOpen: boolean;
  onClose:    () => void;
}

// Desktop: a narrow icon rail that expands over the page while hovered or
// focused. Mobile: a full-width drawer (the lg: classes don't apply).
export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { totalItems } = useCart();
  const { isAdmin }    = useAuth();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const collapsed = !hovered && !focused;

  const NAV_SECTIONS = [
    {
      title: 'Main',
      items: [
        { to: '/home', icon: House, label: 'Home' },
      ],
    },
    {
      title: 'Shopping',
      items: [
        {
          to:    '/my-cart',
          icon:  ShoppingCart,
          label: 'My Cart',
          badge: totalItems > 0 ? totalItems : undefined,
        },
        { to: '/my-orders',
          icon: Package,
          label: 'My Orders',
        },
        { to: '/my-bids', 
          icon: HandCoins,
          label: 'My Bids' 
        },
      ],
    },
    {
      title: 'Trading',
      items: [
        { to: '/auctions', icon: Gavel, label: 'Auctions', badge: undefined as number | undefined },        
      ],
    },
    // Admin link only for admin users
    ...(isAdmin ? [{
      title: 'System',
      items: [
        { to: '/admin', icon: Settings, label: 'Admin' },
      ],
    }] : []),
  ];

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Keyboard focus only, so a clicked link doesn't hold the menu open
      onFocus={e => { if (e.target.matches(':focus-visible')) setFocused(true); }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
      className={cn(
        'fixed top-0 left-0 h-screen supports-[height:100dvh]:h-dvh z-50 flex flex-col',
        'bg-cactus-950 text-cactus-100',
        'transition-all duration-300 ease-in-out overflow-hidden',
        collapsed ? 'lg:w-16' : 'lg:w-60 lg:shadow-2xl lg:shadow-black/40',
        'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10 flex-shrink-0">
        <img
          src="/Images/Logo.jpeg"
          alt="AstrophytumLab logo"
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm"
        />
        <span className={cn(
          'font-display text-xl text-white whitespace-nowrap transition-all duration-200',
          collapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100',
        )}>
          AstrophytumLab
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            <p className={cn(
              'px-5 py-1 text-[10px] font-semibold tracking-[1.5px] uppercase text-white/30 whitespace-nowrap overflow-hidden transition-all duration-200',
              collapsed ? 'lg:opacity-0 lg:h-0 lg:py-0' : 'opacity-100',
            )}>
              {section.title}
            </p>

            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) => cn(
                  'relative flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-green-200/70 hover:text-white hover:bg-white/6',
                )}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-amber-400 rounded-r" />
                    )}
                    <item.icon className="w-5 h-5 mx-0.5 flex-shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className={cn(
                      'whitespace-nowrap transition-all duration-200 flex-1',
                      collapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100',
                    )}>
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span className={cn(
                        'ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full',
                        collapsed && 'lg:hidden',
                        item.to === '/my-cart'
                          ? 'bg-cactus-400 text-white'
                          : 'bg-amber-400 text-amber-900',
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {/* Dot on collapsed cart */}
                    {collapsed && item.badge !== undefined && item.to === '/my-cart' && (
                      <span className="hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 bg-cactus-400 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

    </aside>
  );
}
