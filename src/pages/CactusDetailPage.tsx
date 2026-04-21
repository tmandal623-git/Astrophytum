// src/pages/CactusDetailPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cactusService } from '../services/cactusService';
import { CactusDetail } from '../types';
import { CactusGallery } from '../components/cactus/CactusGallery';
import { AuctionPanel } from '../components/auction/AuctionPanel';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CactusDetailSkeleton } from '../components/ui/LoadingSkeleton';
import { NetworkErrorEmpty } from '../components/ui/EmptyState';

const MOCK_USER_ID = 'alice_t';

export function CactusDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [cactus,  setCactus]  = useState<CactusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    cactusService.getById(Number(id))
      .then(setCactus)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-5xl mx-auto"><CactusDetailSkeleton /></div>;
  if (error || !cactus) return <NetworkErrorEmpty onRetry={() => navigate('/home')} />;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-cactus-600 dark:text-cactus-400 font-medium mb-6 hover:underline"
      >
        ← Back to Collection
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — gallery */}
        <CactusGallery media={cactus.media} name={cactus.name} />

        {/* Right — info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="success">{cactus.categoryName}</Badge>
            <span className="text-xs text-gray-400 dark:text-gray-500">ID #{cactus.id}</span>
          </div>

          <h1 className="font-display text-4xl text-gray-900 dark:text-white leading-tight">
            {cactus.name}
          </h1>

          <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{cactus.description}</p>

          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl text-gray-900 dark:text-white">
              ${cactus.basePrice.toFixed(2)}
            </span>
            <span className="text-sm text-gray-400">base price</span>
          </div>

          {/* Auction panel or add-to-cart placeholder */}
          {cactus.auction ? (
            <AuctionPanel cactusId={cactus.id} userId={MOCK_USER_ID} />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                This cactus is available for direct purchase — no auction required.
              </p>
              <Button className="w-full py-3">Add to Cart — ${cactus.basePrice.toFixed(2)}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}