export interface Category {
  id:          number;
  name:        string;
  description: string | null;
}

export interface MediaItem {
  id:        number;
  type:      'Image' | 'Video';
  url:       string;
  sortOrder: number;
}

export interface AuctionInfo {
  id:           number;
  cactusId:     number;
  startPrice:   number;
  currentPrice: number;
  bidIncrement: number;
  endsAt:       string;
  isActive:     boolean;
  totalBids:    number;
}

export interface CactusListItem {
  id:           number;
  name:         string;
  description:  string | null;
  categoryName: string;
  basePrice:    number;
  hasAuction:   boolean;
  thumbnailUrl: string | null;
}

export interface CactusDetail {
  id:           number;
  name:         string;
  description:  string | null;
  categoryId:   number;
  categoryName: string;
  basePrice:    number;
  createdAt:    string;
  media:        MediaItem[];
  auction:      AuctionInfo | null;
}

export interface BidHistory {
  id:       number;
  username: string;
  amount:   number;
  placedAt: string;
}

export interface PagedResult<T> {
  items:      T[];
  totalCount: number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export interface PlaceBidPayload {
  cactusId: number;
  userId:   string;
  amount:   number;
}