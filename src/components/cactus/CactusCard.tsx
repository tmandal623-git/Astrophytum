import { useNavigate } from 'react-router-dom';
import { CactusListItem } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface CactusCardProps { cactus: CactusListItem }

export function CactusCard({ cactus }: CactusCardProps) {
  const navigate = useNavigate();
  const goToDetail = () => navigate(`/cactus/${cactus.id}`);

  return (
    <Card hoverable onClick={goToDetail}>
      <div className="relative h-48 bg-green-50 dark:bg-green-950 overflow-hidden rounded-t-xl flex items-center justify-center">
        {cactus.thumbnailUrl
          ? <img src={cactus.thumbnailUrl} alt={cactus.name} className="w-full h-full object-cover" />
          : <span className="text-6xl select-none">🌵</span>
        }
        <div className="absolute top-3 left-3">
          <Badge variant="gold">{cactus.categoryName}</Badge>
        </div>
        {cactus.hasAuction && (
          <div className="absolute top-3 right-3">
            <Badge variant="danger" pulse>Live Bid</Badge>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-[11px] font-medium text-cactus-600 dark:text-cactus-400 uppercase tracking-wider mb-1">
          {cactus.categoryName}
        </p>
        <h3 className="font-display text-lg text-gray-900 dark:text-white mb-1.5">{cactus.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
          {cactus.description}
        </p>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
          <div>
            <span className="text-[11px] text-gray-400 block">from</span>
            <span className="text-lg font-medium">${cactus.basePrice.toFixed(2)}</span>
          </div>
          <Button size="sm" variant={cactus.hasAuction ? 'primary' : 'secondary'} onClick={goToDetail}>
            {cactus.hasAuction ? 'Bid Now' : 'View'}
          </Button>
        </div>
      </div>
    </Card>
  );
}