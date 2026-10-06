// src/components/cactus/CactusCard.tsx
// Image keeps its category / Live Bid badges; body shows name, customer rating, price and Live/Buy status.
// No cart actions on the card — everything is on the detail page.
// Clicking anywhere on the card navigates to /cactus/:id

import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { CactusListItem } from '../../types';
import { Badge } from '../ui/Badge';
import { isSoldOut } from '../../utils/stock';

interface CactusCardProps {
  cactus: CactusListItem;
}

// ── Customer rating ────────────────────────────────────────────
const STAR_PATH = 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z';

function StarRating({ rating, count }: { rating: number; count: number }) {
  // Unique gradient id per card — a shared id would make every half-star
  // reference the first card's gradient.
  const gradId = useId();

  if (count === 0) return null;

  const full = Math.floor(rating);
  const half = rating - full >= 0.5;

  return (
    <div className="flex items-center gap-1.5" title={`${rating.toFixed(1)} out of 5 from ${count} ratings`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const isFull = i < full;
          const isHalf = !isFull && half && i === full;
          return (
            <svg key={i} className="w-3.5 h-3.5" viewBox="0 0 20 20" aria-hidden="true">
              {isHalf && (
                <defs>
                  <linearGradient id={gradId}>
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#d1d5db" />
                  </linearGradient>
                </defs>
              )}
              <path
                d={STAR_PATH}
                fill={isFull ? '#fbbf24' : isHalf ? `url(#${gradId})` : '#d1d5db'}
              />
            </svg>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{rating.toFixed(1)}</span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500">
        ({count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})
      </span>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────
export function CactusCard({ cactus }: CactusCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/cactus/${cactus.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-cactus-200 dark:hover:border-cactus-800 flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-cactus-500"
    >
      {/* ── Image ─────────────────────────────────────────── */}
      <div className="relative h-40 bg-cactus-50 dark:bg-cactus-950 overflow-hidden flex items-center justify-center flex-shrink-0">
        {cactus.thumbnailUrl ? (
          <img
            src={cactus.thumbnailUrl}
            alt={cactus.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="text-7xl select-none">🌵</span>
        )}

        {/* Category badge — top left */}
        <div className="absolute top-3 left-3">
          <Badge variant="gold">{cactus.categoryName}</Badge>
        </div>

        {/* Live auction badge — top right */}
        {cactus.hasAuction && (
          <div className="absolute top-3 right-3">
            <Badge variant="danger" pulse>Live Bid</Badge>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 flex items-end justify-center pb-4">
          <span className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
            {cactus.hasAuction ? '🔨 View Auction' : '👁 View Details'}
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="px-3.5 py-3 flex flex-col flex-1 gap-1.5">

        {/* Name */}
        <h3 className="font-display text-lg text-gray-900 dark:text-white leading-snug line-clamp-1">
          {cactus.name}
        </h3>

        {/* Customer rating */}
        <StarRating rating={cactus.rating} count={cactus.ratingCount} />

        {/* ── Footer: price + cta hint ────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 mt-auto">

          {/* Price */}
          <div>
            {cactus.hasAuction ? (
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">starts at</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  ₹{Number(cactus.basePrice).toFixed(2)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">price</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  ₹{Number(cactus.basePrice).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Status pill */}
          {cactus.hasAuction ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-950 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live
            </span>
          ) : isSoldOut(cactus.quantity) ? (
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              Sold Out
            </span>
          ) : (
            <span className="text-[11px] font-medium text-cactus-600 dark:text-cactus-400 group-hover:underline">
              Buy →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
