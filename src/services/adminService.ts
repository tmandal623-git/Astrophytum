// src/services/adminService.ts

export interface WeeklyChartPoint {
  day:      string;   // 'Mon' | 'Tue' | ...
  revenue:  number;
  bidCount: number;
}

export interface WeeklySalesPoint {
  day:        string;   // 'Mon' | 'Tue' | ...
  revenue:    number;
  orderCount: number;
}

export interface AdminStats {
  totalSpecies:   number;
  liveAuctions:   number;
  bidsToday:      number;
  bidsTodayValue: number;
  uniqueBidders:  number;
  totalRevenue:   number;
  weeklyChart:    WeeklyChartPoint[];
  weeklySalesChart?: WeeklySalesPoint[];   // normal (non-auction) product sales
}

export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
};