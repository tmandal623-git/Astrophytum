import api from './api';
import type { AuctionInfo, BidHistory, PlaceBidPayload } from '../types';

export const auctionService = {
  getForCactus: (cactusId: number) =>
    api.get<AuctionInfo>(`/auction/${cactusId}`).then((r) => r.data),

  // Bid route is protected — send the auth_token cookie
  placeBid: (payload: PlaceBidPayload) =>
    api.post<BidHistory>('/auction/bid', payload, { withCredentials: true }).then((r) => r.data),

  getHistory: (cactusId: number) =>
    api.get<BidHistory[]>(`/auction/history/${cactusId}`).then((r) => r.data),
};
