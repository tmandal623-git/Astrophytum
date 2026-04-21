import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionService } from '../services/auctionService';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

// ── Types ──────────────────────────────────────────────────
type BidStatus = 'winning' | 'outbid' | 'won' | 'lost';

interface MyBid {
  auctionId:   number;
  cactusId:    number;
  cactusName:  string;
  thumbnailUrl: string | null;
  myAmount:    number;
  currentBid:  number;
  endsAt:      string;
  isActive:    boolean;
  status:      BidStatus;
}

// ── Mock data (replace with real API call: GET /my-bids?userId=...) ──
const MOCK_MY_BIDS: MyBid[] = [
  {
    auctionId: 1, cactusId: 1, cactusName: 'Cactus 1',    thumbnailUrl: null,
    myAmount: 35.00, currentBid: 38.50, endsAt: new Date(Date.now() + 2.5  * 3600_000).toISOString(), isActive: true,  status: 'outbid',
  },
  {
    auctionId: 3, cactusId: 4, cactusName: 'Cactus 4', thumbnailUrl: null,
    myAmount: 31.00, currentBid: 31.00, endsAt: new Date(Date.now() + 5.2  * 3600_000).toISOString(), isActive: true,  status: 'winning',
  },
  {
    auctionId: 4, cactusId: 6, cactusName: "Bishop's Cap",     thumbnailUrl: null,
    myAmount: 65.00, currentBid: 72.00, endsAt: new Date(Date.now() + 1.1  * 3600_000).toISOString(), isActive: true,  status: 'outbid',
  },
  {
    auctionId: 2, cactusId: 2, cactusName: 'Saguaro Giant',    thumbnailUrl: null,
    myAmount: 95.00, currentBid: 95.00, endsAt: new Date(Date.now() - 2    * 3600_000).toISOString(), isActive: false, status: 'won',
  },
  {
    auctionId: 5, cactusId: 7, cactusName: 'Ferocactus',       thumbnailUrl: null,
    myAmount: 28.00, currentBid: 34.00, endsAt: new Date(Date.now() - 5    * 3600_000).toISOString(), isActive: false, status: 'lost',
  },
];

// ── Helpers ────────────────────────────────────────────────
function formatTimeLeft(endsAt: string, isActive: boolean): string {
  if (!isActive) return 'Ended';
  const ms   = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending...';
  const hrs  = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

const STATUS_CONFIG: Record<BidStatus, { label: string; variant: 'success' | 'danger' | 'info' | 'outline' }> = {
  winning: { label: 'Winning',  variant: 'success' },
  outbid:  { label: 'Outbid',   variant: 'danger'  },
  won:     { label: 'Won',      variant: 'info'    },
  lost:    { label: 'Lost',     variant: 'outline' },
};

// ── Component ──────────────────────────────────────────────
type Tab = 'active' | 'ended';

export function MyBidsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');

  const activeBids = MOCK_MY_BIDS.filter((b) => b.isActive);
  const endedBids  = MOCK_MY_BIDS.filter((b) => !b.isActive);
  const displayed  = tab === 'active' ? activeBids : endedBids;

  // Summary stats
  const winning   = activeBids.filter((b) => b.status === 'winning').length;
  const totalSpent = endedBids.filter((b) => b.status === 'won').reduce((s, b) => s + b.myAmount, 0);

  return (
    <div className="max-w-5xl mx-auto">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gray-900 dark:text-white mb-1">My Bids</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track all your auction activity in one place.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Bids',   value: activeBids.length,          sub: 'ongoing auctions' },
          { label: 'Currently Winning', value: winning,                sub: 'you\'re in the lead' },
          { label: 'Auctions Won',  value: endedBids.filter(b => b.status === 'won').length,  sub: 'all time' },
          { label: 'Total Spent',   value: `$${totalSpent.toFixed(2)}`, sub: 'on won auctions' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
          >
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
            <p className="font-display text-2xl text-gray-900 dark:text-white">{value}</p>
            <p className="text-[11px] text-cactus-600 dark:text-cactus-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit mb-6">
        {(['active', 'ended'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-1.5 rounded-md text-sm font-medium capitalize transition-all duration-200',
              tab === t
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            {t} ({t === 'active' ? activeBids.length : endedBids.length})
          </button>
        ))}
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={tab === 'active' ? '🔨' : '📜'}
          title={tab === 'active' ? 'No active bids' : 'No ended bids'}
          description={
            tab === 'active'
              ? "You haven't placed any bids yet. Browse live auctions to get started."
              : "Auctions you've participated in will appear here once they close."
          }
          action={tab === 'active' ? { label: 'Browse Auctions', onClick: () => navigate('/auctions') } : undefined}
        />
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cactus</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">My Bid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current / Final</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {tab === 'active' ? 'Time Left' : 'Ended'}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayed.map((bid) => {
                  const cfg      = STATUS_CONFIG[bid.status];
                  const isAbove  = bid.myAmount >= bid.currentBid;

                  return (
                    <tr
                      key={bid.auctionId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Cactus name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cactus-50 dark:bg-cactus-900 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                            {bid.thumbnailUrl
                              ? <img src={bid.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                              : '🌵'
                            }
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{bid.cactusName}</span>
                        </div>
                      </td>

                      {/* My bid */}
                      <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                        ${bid.myAmount.toFixed(2)}
                      </td>

                      {/* Current / Final bid */}
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'font-semibold',
                          isAbove ? 'text-cactus-600 dark:text-cactus-400' : 'text-red-500',
                        )}>
                          ${bid.currentBid.toFixed(2)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500 text-xs">
                        {formatTimeLeft(bid.endsAt, bid.isActive)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        {bid.isActive ? (
                          <Button
                            size="sm"
                            variant={bid.status === 'outbid' ? 'primary' : 'secondary'}
                            onClick={() => navigate(`/cactus/${bid.cactusId}`)}
                          >
                            {bid.status === 'outbid' ? 'Rebid' : 'View'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/cactus/${bid.cactusId}`)}>
                            Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
