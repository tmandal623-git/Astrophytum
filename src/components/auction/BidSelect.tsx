import { useEffect } from 'react';
import { AuctionInfo } from '../../types';

interface BidSelectProps {
  auction:         AuctionInfo;
  selectedAmount:  number;
  onAmountChange:  (amount: number) => void;
}

export function BidSelect({ auction, selectedAmount, onAmountChange }: BidSelectProps) {
  const { currentPrice, bidIncrement } = auction;

  // Build 8 bid options starting one increment above current price
  const options = Array.from({ length: 8 }, (_, i) =>
    parseFloat((currentPrice + bidIncrement * (i + 1)).toFixed(2)),
  );

  // Auto-select the minimum on mount or when options change
  useEffect(() => {
    if (!options.includes(selectedAmount)) {
      onAmountChange(options[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice, bidIncrement]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Choose your bid
      </label>
      <select
        value={selectedAmount}
        onChange={(e) => onAmountChange(parseFloat(e.target.value))}
        className="
          w-full px-3 py-2.5 text-sm
          border border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-900
          text-gray-900 dark:text-gray-100
          rounded-lg cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-cactus-500
          transition-colors duration-150
        "
      >
        {options.map((val, i) => (
          <option key={val} value={val}>
            ${val.toFixed(2)}{i === 0 ? ' — minimum bid' : ''}
          </option>
        ))}
      </select>

      {/* Visual increment hint */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Bids increase in ${bidIncrement.toFixed(2)} increments above the current price.
      </p>
    </div>
  );
}
