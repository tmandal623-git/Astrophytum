import { CactusListItem, CactusDetail, Category, AuctionInfo, BidHistory } from '../types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Indoor',    description: 'Low-light tolerant species perfect for windowsills and shelves.' },
  { id: 2, name: 'Outdoor',   description: 'Hardy sun-lovers built for patios, gardens, and open landscapes.' },
  { id: 3, name: 'Rare',      description: 'Collector-grade specimens with extraordinary forms.' },
  { id: 4, name: 'Flowering', description: 'Spectacular bloomers that put on a show of colour.' },
];

export const MOCK_CACTI: CactusListItem[] = [
  { id: 1, name: 'Cactus 1',    categoryName: 'Flowering', basePrice: 24.99, hasAuction: true,  description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_1_flower/flower3.jpg' },
  { id: 2, name: 'Cactus 2',    categoryName: 'Outdoor',   basePrice: 89.99, hasAuction: true,  description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_2_asterio/asterio4.jpg' },
  { id: 3, name: 'Cactus 3',    categoryName: 'Rare',      basePrice: 14.99, hasAuction: false, description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_3_veri/veri7.jpg' },
  { id: 4, name: 'Cactus 4',    categoryName: 'Outdoor', basePrice: 18.50, hasAuction: true,  description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_4/veri1.jpg' },
  { id: 5, name: 'Cactus 5',    categoryName: 'Outdoor',   basePrice: 22.00, hasAuction: false, description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_5_tri/tri2.jpg' },
  { id: 6, name: "Cactus 6",    categoryName: 'Rare',      basePrice: 45.00, hasAuction: true,  description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_6_kik/kik2.jpg' },
  { id: 7, name: 'Cactus 7',    categoryName: 'Indoor',    basePrice: 31.00, hasAuction: false, description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_7_superV/v4.jpg' },
  { id: 8, name: 'Cactus 8',    categoryName: 'Indoor',    basePrice: 55.00, hasAuction: false, description: 'Astrophytum (star cactus/bishops cap) is a genus of small, slow-growing, typically solitary, and often spineless cacti native to Mexico and the US. Known for their spherical or star-shaped bodies (3-10 ribs).', thumbnailUrl: '/Images/Cactus_8_medu/med5.jpg' },
];

export const MOCK_AUCTIONS: Record<number, AuctionInfo> = {
  1: { id: 1, cactusId: 1, startPrice: 24.99, currentPrice: 38.50, bidIncrement: 2.50, endsAt: new Date(Date.now() + 2.5  * 3600_000).toISOString(), isActive: true, totalBids: 3 },
  2: { id: 2, cactusId: 2, startPrice: 89.99, currentPrice: 125.0, bidIncrement: 5.00, endsAt: new Date(Date.now() + 3.75 * 3600_000).toISOString(), isActive: true, totalBids: 2 },
  4: { id: 3, cactusId: 4, startPrice: 18.50, currentPrice: 31.00, bidIncrement: 2.50, endsAt: new Date(Date.now() + 5.2  * 3600_000).toISOString(), isActive: true, totalBids: 2 },
  6: { id: 4, cactusId: 6, startPrice: 45.00, currentPrice: 72.00, bidIncrement: 5.00, endsAt: new Date(Date.now() + 1.1  * 3600_000).toISOString(), isActive: true, totalBids: 3 },
};

export const MOCK_BID_HISTORY: Record<number, BidHistory[]> = {
  1: [
    { id: 3, username: 'Customer_1',  amount: 38.50, placedAt: new Date(Date.now() - 2   * 60_000).toISOString() },
    { id: 2, username: 'Customer_2',    amount: 35.00, placedAt: new Date(Date.now() - 18  * 60_000).toISOString() },
    { id: 1, username: 'Customer_3',  amount: 30.00, placedAt: new Date(Date.now() - 60  * 60_000).toISOString() },
  ],
  2: [
    { id: 5, username: 'Customer_4',   amount: 125.0, placedAt: new Date(Date.now() - 5   * 60_000).toISOString() },
    { id: 4, username: 'Customer_1',  amount: 115.0, placedAt: new Date(Date.now() - 30  * 60_000).toISOString() },
  ],
  4: [
    { id: 7, username: 'Customer_4',   amount: 31.00, placedAt: new Date(Date.now() - 12  * 60_000).toISOString() },
    { id: 6, username: 'Customer_3',  amount: 27.00, placedAt: new Date(Date.now() - 45  * 60_000).toISOString() },
  ],
  6: [
    { id: 10, username: 'Customer_3', amount: 72.00, placedAt: new Date(Date.now() - 3   * 60_000).toISOString() },
    { id: 9,  username: 'Customer_1', amount: 65.00, placedAt: new Date(Date.now() - 22  * 60_000).toISOString() },
    { id: 8,  username: 'Customer_2',   amount: 55.00, placedAt: new Date(Date.now() - 120 * 60_000).toISOString() },
  ],
};

export const MOCK_CACTUS_DETAIL: Record<number, CactusDetail> = {
  1: { id: 1, name: 'Cactus 1', description: 'A classic spherical cactus with golden spines. Perfect for sunny windowsills. Grows slowly and lives for decades with minimal care. Water every 2–3 weeks in summer, once a month in winter.', categoryId: 1, categoryName: 'Indoor', basePrice: 24.99, createdAt: '2024-01-15T10:00:00Z',
    media: [
      { id: 1, type: 'Image', url: '/Images/Cactus_1_flower/flower1.jpg', sortOrder: 0 },
      { id: 2, type: 'Image', url: '/Images/Cactus_1_flower/flower2.jpg', sortOrder: 1 },
      { id: 3, type: 'Image', url: '/Images/Cactus_1_flower/flower3.jpg', sortOrder: 2 },
      { id: 4, type: 'Image', url: '/Images/Cactus_1_flower/flower4.jpg', sortOrder: 3 },
      { id: 5, type: 'Video', url: 'https://www.youtube.com', sortOrder: 0 },
    ],
    auction: MOCK_AUCTIONS[1] },
  2: { id: 2, name: 'Cactus 2', description: 'The iconic multi-armed cactus of the American Southwest. Can grow over 40 feet tall in the wild. A true statement plant for large outdoor spaces. Slow growing — a 10-year-old plant is only about 1.5 inches tall.', categoryId: 2, categoryName: 'Outdoor', basePrice: 89.99, createdAt: '2024-01-20T10:00:00Z',
    media: [
      { id: 6, type: 'Image', url: '/Images/Cactus_2_asterio/asterio1.jpg', sortOrder: 0 },
      { id: 7, type: 'Image', url: '/Images/Cactus_2_asterio/asterio2.jpg', sortOrder: 1 },
      { id: 8, type: 'Image', url: '/Images/Cactus_2_asterio/asterio3.jpg', sortOrder: 2 },
      { id: 9, type: 'Image', url: '/Images/Cactus_2_asterio/asterio4.jpg', sortOrder: 3 },
      { id: 10, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: MOCK_AUCTIONS[2] },
  3: { id: 3, name: 'Cactus 3', description: 'A brightly colored grafted cactus that lacks chlorophyll in its top section. Available in vivid red, orange, and pink. A collector\'s gem that adds a pop of colour to any shelf.', categoryId: 3, categoryName: 'Rare', basePrice: 14.99, createdAt: '2024-02-01T10:00:00Z',
    media: [
      { id: 11, type: 'Image', url: '/Images/Cactus_3_veri/veri3.jpg', sortOrder: 0 },
      { id: 12, type: 'Image', url: '/Images/Cactus_3_veri/veri4.jpg', sortOrder: 1 },
      { id: 13, type: 'Image', url: '/Images/Cactus_3_veri/veri6.jpg', sortOrder: 2 },
      { id: 14, type: 'Image', url: '/Images/Cactus_3_veri/veri8.jpg', sortOrder: 3 },
      { id: 15, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: null },
  4: { id: 4, name: 'Cactus 4', description: 'Blooms spectacularly in winter with red, pink, or white flowers. Unlike true cacti, it prefers indirect light and moderate humidity. A beloved holiday gift plant.', categoryId: 4, categoryName: 'Flowering', basePrice: 18.50, createdAt: '2024-02-10T10:00:00Z',
    media: [
      { id: 16, type: 'Image', url: '/Images/Cactus_4/veri1.jpg', sortOrder: 0 },
      { id: 17, type: 'Image', url: '/Images/Cactus_4/veri2.jpg', sortOrder: 1 },
      { id: 18, type: 'Image', url: '/Images/Cactus_4/veri3.jpg', sortOrder: 2 },
      { id: 19, type: 'Image', url: '/Images/Cactus_4/veri4.jpg', sortOrder: 3 },
      { id: 20, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: MOCK_AUCTIONS[4] },
  5: { id: 5, name: 'Cactus 5', description: 'Flat paddle-shaped pads covered in spines. Produces edible fruits in summer. Extremely drought tolerant and cold-hardy. Great for xeriscaping.', categoryId: 2, categoryName: 'Outdoor', basePrice: 22.00, createdAt: '2024-02-15T10:00:00Z',
    media: [
      { id: 21, type: 'Image', url: '/Images/Cactus_5_tri/tri1.jpg', sortOrder: 0 },
      { id: 22, type: 'Image', url: '/Images/Cactus_5_tri/tri3.jpg', sortOrder: 1 },
      { id: 23, type: 'Image', url: '/Images/Cactus_5_tri/tri4.jpg', sortOrder: 2 },
      { id: 24, type: 'Image', url: '/Images/Cactus_5_tri/tri5.jpg', sortOrder: 3 },
      { id: 25, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: null },
  6: { id: 6, name: "Cactus 6", description: 'A geometric masterpiece — five angular ribs give it a star-like cross-section. Slow-growing and highly sought after by collectors worldwide.', categoryId: 3, categoryName: 'Rare', basePrice: 45.00, createdAt: '2024-03-01T10:00:00Z',
    media: [
      { id: 26, type: 'Image', url: '/Images/Cactus_6_kik/kik1.jpg', sortOrder: 0 },
      { id: 27, type: 'Image', url: '/Images/Cactus_6_kik/kik2.jpg', sortOrder: 1 },
      { id: 28, type: 'Image', url: '/Images/Cactus_6_kik/kik3.jpg', sortOrder: 2 },
      { id: 29, type: 'Image', url: '/Images/Cactus_6_kik/kik4.jpg', sortOrder: 3 },
      { id: 30, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: MOCK_AUCTIONS[6] },
  7: { id: 7, name: 'Cactus 7', description: 'The fierce barrel cactus, named for its hooked spines. Dense, globe-shaped, and virtually maintenance-free indoors. Loves full sun.', categoryId: 1, categoryName: 'Indoor', basePrice: 31.00, createdAt: '2024-03-10T10:00:00Z',
    media: [
      { id: 31, type: 'Image', url: '/Images/Cactus_7_superV/v1.jpg', sortOrder: 0 },
      { id: 32, type: 'Image', url: '/Images/Cactus_7_superV/v2.jpg', sortOrder: 1 },
      { id: 33, type: 'Image', url: '/Images/Cactus_7_superV/v3.jpg', sortOrder: 2 },
      { id: 34, type: 'Image', url: '/Images/Cactus_7_superV/v4.jpg', sortOrder: 3 },
      { id: 35, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: null },
  8: { id: 8, name: 'Cactus 8', description: 'A tall columnar cactus from the Andes. Grows rapidly to impressive heights and produces large white nocturnal flowers in summer.', categoryId: 2, categoryName: 'Outdoor', basePrice: 55.00, createdAt: '2024-03-15T10:00:00Z',
    media: [
      { id: 36, type: 'Image', url: '/Images/Cactus_8_medu/med3.jpg', sortOrder: 0 },
      { id: 37, type: 'Image', url: '/Images/Cactus_8_medu/med1.jpg', sortOrder: 1 },
      { id: 38, type: 'Image', url: '/Images/Cactus_8_medu/med2.jpg', sortOrder: 2 },
      { id: 39, type: 'Image', url: '/Images/Cactus_8_medu/med5.jpg', sortOrder: 3 },
      { id: 40, type: 'Video', url: '', sortOrder: 0 },
    ],
    auction: null },
};