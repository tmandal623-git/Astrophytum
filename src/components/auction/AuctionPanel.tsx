import { useState } from 'react';
import { useAuction } from '../../hooks/useAuction';
import { Button } from '../ui/Button';
import { BidHistory } from './BidHistory';
// import { Countdown } from './Countdown';

interface AuctionPanelProps { cactusId: number; userId: string }

export function AuctionPanel({ cactusId, userId }: AuctionPanelProps) {
  const { auction, history, loading, bidding, error, placeBid } = useAuction(cactusId);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [success, setSuccess] = useState(false);

  if (loading) return <div className="h-40 bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse" />;
  if (!auction) return null;

  const increment = auction.bidIncrement;
  const options   = Array.from({ length: 8 }, (_, i) =>
    parseFloat((auction.currentPrice + increment * (i + 1)).toFixed(2)));

  if (selectedAmount === 0) setSelectedAmount(options[0]);

  const handleBid = async () => {
    const ok = await placeBid({ cactusId, userId, amount: selectedAmount });
    if (ok) { setSuccess(true); setTimeout(() => setSuccess(false), 4000); }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">🔨 Live Auction</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Starting Price',  value: `$${auction.startPrice.toFixed(2)}` },
          { label: 'Current Bid',     value: `$${auction.currentPrice.toFixed(2)}`, highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-xl font-medium ${highlight ? 'text-red-500' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* <Countdown endsAt={auction.endsAt} /> */}

      <div className="flex flex-col gap-3 mt-4">
        <select
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg
                     bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-cactus-500 focus:outline-none"
          value={selectedAmount}
          onChange={(e) => setSelectedAmount(parseFloat(e.target.value))}
        >
          {options.map((v, i) => (
            <option key={v} value={v}>${v.toFixed(2)}{i === 0 ? ' (minimum)' : ''}</option>
          ))}
        </select>

        <Button variant="danger" onClick={handleBid} loading={bidding} className="w-full py-3">
          Place Bid of ${selectedAmount.toFixed(2)}
        </Button>

        {success && (
          <div className="text-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-lg py-2">
            ✓ Bid placed! You are now the highest bidder.
          </div>
        )}
        {error && (
          <div className="text-center text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg py-2">
            {error}
          </div>
        )}
      </div>

      <BidHistory bids={history} />
    </div>
  );
}