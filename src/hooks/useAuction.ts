import { useCallback, useEffect, useState } from 'react';
import { auctionService } from '../services/auctionService';
import type { AuctionInfo, BidHistory, PlaceBidPayload } from '../types';

export function useAuction(cactusId: number) {
  const [auction,  setAuction]  = useState<AuctionInfo | null>(null);
  const [history,  setHistory]  = useState<BidHistory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [bidding,  setBidding]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        auctionService.getForCactus(cactusId),
        auctionService.getHistory(cactusId),
      ]);
      setAuction(a);
      setHistory(h);
    } catch {
      setAuction(null);
    } finally {
      setLoading(false);
    }
  }, [cactusId]);

  useEffect(() => { load(); }, [load]);

  const placeBid = async (payload: PlaceBidPayload): Promise<boolean> => {
    setBidding(true);
    setError(null);
    try {
      const newBid = await auctionService.placeBid(payload);
      setHistory((prev) => [newBid, ...prev]);
      setAuction((prev) =>
        prev ? { ...prev, currentPrice: payload.amount, totalBids: prev.totalBids + 1 } : prev);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid.');
      return false;
    } finally {
      setBidding(false);
    }
  };

  return { auction, history, loading, bidding, error, placeBid };
}
