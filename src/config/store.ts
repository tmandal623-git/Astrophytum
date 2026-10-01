// src/config/store.ts
// Store-wide settings shared by checkout, cart and the info pages (About, Shipping, Contact…).
// Update the contact details below with your real values — empty fields are hidden on the site.

export const STORE = {
  name:    'AstrophytumLab',
  email:   'support@astrophytumlab.com',        // ← your real support email
  phone:   '',                                  // ← e.g. '+91 98765 43210' (hidden while empty)
  address: '',                                  // ← nursery / business address (hidden while empty)
  hours:   'Mon – Sat, 10:00 AM – 6:00 PM IST',
};

// ── Shipping & returns ────────────────────────────────────────
export const SHIPPING_THRESHOLD = 75;     // free shipping at or above this subtotal (₹)
export const SHIPPING_COST      = 9.99;   // flat shipping fee below the threshold (₹)
export const RETURN_WINDOW_DAYS = 7;      // matches "7-day returns" on the product page
export const DAMAGE_REPORT_HOURS = 48;    // live plant guarantee claim window
export const SHIPPING_COUNTRIES = ['India', 'United States', 'Canada', 'United Kingdom', 'Australia'];
