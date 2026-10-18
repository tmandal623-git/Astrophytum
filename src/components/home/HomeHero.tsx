// src/components/home/HomeHero.tsx
// Home page banner: brand line, calls to action, store promises and a photo
// collage of the newest listings (so it stays current without hard-coded images).
import { Link }      from 'react-router-dom';
import { ArrowRight, Gavel, RotateCcw, ShieldCheck, Sprout, Truck } from 'lucide-react';
import { useCacti }  from '../../hooks/useCacti';
import { STORE, RETURN_WINDOW_DAYS, DAMAGE_REPORT_HOURS } from '../../config/store';
import { cn }        from '../../utils/cn';

const PROMISES = [
  { icon: Truck,       label: 'Packed with care & tracked' },
  { icon: ShieldCheck, label: `Live plant guarantee (${DAMAGE_REPORT_HOURS}h)` },
  { icon: RotateCcw,   label: `${RETURN_WINDOW_DAYS}-day returns` },
];

export function HomeHero({ onShopClick }: { onShopClick: () => void }) {
  // Unfiltered newest listings — independent of the search/category filters below
  const { data, loading } = useCacti({ page: 1, pageSize: 6 });
  const photos = (data?.items ?? []).filter(c => c.thumbnailUrl).slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-cactus-950 text-white mb-10">
      {/* Soft background glow */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-cactus-600/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-1/3 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 p-6 sm:p-10 lg:p-12">

        {/* ── Copy + actions ─────────────────────────────── */}
        <div className="flex flex-col justify-center">
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-cactus-100">
            <Sprout className="w-3.5 h-3.5" aria-hidden />
            Rare &amp; collectible Astrophytum
          </span>

          <h1 className="font-display text-4xl sm:text-5xl leading-[1.1] mt-5">
            Rare cacti,<br />grown with care.
          </h1>
          <p className="text-base text-cactus-100/80 mt-4 max-w-md leading-relaxed">
            Hand-picked Astrophytum cultivars, grafts and seeds from the {STORE.name} nursery.
            Buy today, or bid on rare plants in live auctions.
          </p>

          <div className="flex flex-wrap gap-3 mt-7">
            <button type="button" onClick={onShopClick}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-cactus-950 text-sm font-semibold shadow-sm transition-colors">
              Shop the collection
              <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
            <Link to="/auctions"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/25 hover:bg-white/10 text-white text-sm font-semibold transition-colors">
              <span className="relative flex w-2 h-2" aria-hidden>
                <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
              </span>
              <Gavel className="w-4 h-4" aria-hidden />
              Live auctions
            </Link>
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-xs text-cactus-100/70">
            {PROMISES.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-amber-300" strokeWidth={1.75} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Photo collage (newest listings) ────────────── */}
        <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 h-[240px] sm:h-[300px] md:h-[340px] lg:h-[380px]">
          {loading && photos.length === 0
            ? [0, 1, 2].map(i => (
                <div key={i} className={cn('rounded-2xl bg-white/10 animate-pulse', i === 0 && 'row-span-2')} />
              ))
            : photos.length === 0
              ? (
                <div className="col-span-2 row-span-2 flex items-center justify-center">
                  <img src="/Images/Logo.jpeg" alt="" className="w-48 h-48 rounded-full object-cover ring-8 ring-white/10" />
                </div>
              )
              : photos.map((c, i) => (
                <Link key={c.id} to={`/cactus/${c.id}`}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl ring-1 ring-white/10',
                    i === 0 && 'row-span-2',
                    photos.length === 1 && 'col-span-2',
                    photos.length === 2 && 'row-span-2',
                  )}>
                  <img src={c.thumbnailUrl!} alt={c.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/70 to-transparent text-xs font-medium text-white">
                    <span className="block truncate">{c.name}</span>
                  </span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
