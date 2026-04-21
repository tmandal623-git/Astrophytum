// import api from './api';
// import type { AuctionInfo, BidHistory, PlaceBidPayload } from '../types';

// export const auctionService = {
//   getForCactus: (cactusId: number) =>
//     api.get<AuctionInfo>(`/auction/${cactusId}`).then((r) => r.data),

//   placeBid: (payload: PlaceBidPayload) =>
//     api.post<BidHistory>('/auction/bid', payload).then((r) => r.data),

//   getHistory: (cactusId: number) =>
//     api.get<BidHistory[]>(`/auction/history/${cactusId}`).then((r) => r.data),
// };
import { MOCK_AUCTIONS, MOCK_BID_HISTORY } from '../mocks/data';
import { AuctionInfo, BidHistory, PlaceBidPayload } from '../types';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export const auctionService = {
  getForCactus: async (cactusId: number): Promise<AuctionInfo> => {
    await delay();
    const auction = MOCK_AUCTIONS[cactusId];
    if (!auction) throw new Error('No auction');
    return auction;
  },

  placeBid: async (payload: PlaceBidPayload): Promise<BidHistory> => {
    await delay(600);
    const auction = MOCK_AUCTIONS[payload.cactusId];
    if (!auction) throw new Error('Auction not found');
    if (payload.amount <= auction.currentPrice) throw new Error(`Bid must exceed $${auction.currentPrice.toFixed(2)}`);
    // Update mock state so UI reflects the new bid
    auction.currentPrice = payload.amount;
    auction.totalBids += 1;
    const newBid: BidHistory = { id: Date.now(), username: 'you', amount: payload.amount, placedAt: new Date().toISOString() };
    if (!MOCK_BID_HISTORY[payload.cactusId]) MOCK_BID_HISTORY[payload.cactusId] = [];
    MOCK_BID_HISTORY[payload.cactusId].unshift(newBid);
    return newBid;
  },

  getHistory: async (cactusId: number): Promise<BidHistory[]> => {
    await delay();
    return MOCK_BID_HISTORY[cactusId] ?? [];
  },
};