// src/utils/orderTracking.ts
// Shared shipment/tracking types and labels (mirrors the constants in api/server.js)

export type TrackingStatus =
  | 'payment_pending' | 'payment_verified' | 'payment_failed'
  | 'processing' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';

export type ShipmentStatus = 'processing' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';

export interface Shipment {
  status:                ShipmentStatus;
  courier:               string | null;
  courierName:           string | null;
  trackingNumber:        string | null;
  trackingUrl:           string | null;
  dispatchDate:          string | null;   // YYYY-MM-DD
  estimatedDeliveryDate: string | null;   // YYYY-MM-DD
  updatedAt:             string;
}

export interface StatusHistoryEntry {
  id:         number;
  status:     string;
  note:       string | null;
  createdAt:  string;
  changedBy?: string | null;   // admin view only
}

/** The happy path, in order — used by the progress tracker */
export const TRACKING_STEPS: { status: TrackingStatus; label: string }[] = [
  { status: 'payment_pending',  label: 'Payment Pending'  },
  { status: 'payment_verified', label: 'Payment Verified' },
  { status: 'processing',       label: 'Processing'       },
  { status: 'dispatched',       label: 'Dispatched'       },
  { status: 'in_transit',       label: 'In Transit'       },
  { status: 'delivered',        label: 'Delivered'        },
];

export const SHIPMENT_STATUS_OPTIONS: { value: ShipmentStatus; label: string }[] = [
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];

/** Statuses that need courier, tracking number and dispatch date */
export const SHIPPED_STATUSES: ShipmentStatus[] = ['dispatched', 'in_transit', 'delivered'];

export const COURIER_OPTIONS = [
  { value: 'dtdc',       label: 'DTDC'       },
  { value: 'india_post', label: 'India Post' },
  { value: 'bluedart',   label: 'Blue Dart'  },
  { value: 'delhivery',  label: 'Delhivery'  },
  { value: 'other',      label: 'Other'      },
];

/** Format a YYYY-MM-DD date without timezone shifting */
export function formatDateOnly(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
