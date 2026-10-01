import api from './api';

export interface FeaturedCactus {
  id: number;
  name: string;
  description: string;
  basePrice: string;
  categoryName: string;
  thumbnailUrl: string;
}

export interface AuctionCactus {
  auctionId: number;
  id: number;
  name: string;
  description: string;
  basePrice: string;
  currentPrice: string;
  startsAt: string;
  endsAt: string;
  categoryName: string;
  thumbnailUrl: string;
  bidCount: number;
}

export interface HomeStats {
  totalSpecies: number;
  activeAuctions: number;
  totalBids: number;
}

export interface HomeData {
  featured: FeaturedCactus[];
  auctions: AuctionCactus[];
  categories: Array<{ id: number; name: string }>;
  stats: HomeStats;
}

export const homeService = {
  async getHomeData(): Promise<HomeData> {
    const { data } = await api.get<HomeData>('/home');
    return data;
  }
};