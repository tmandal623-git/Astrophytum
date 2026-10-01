// src/pages/ShippingPage.tsx
import { Link } from 'react-router-dom';
import { InfoList, InfoPage, InfoSection } from '../components/info/InfoPage';
import {
  DAMAGE_REPORT_HOURS, RETURN_WINDOW_DAYS, SHIPPING_COST,
  SHIPPING_COUNTRIES, SHIPPING_THRESHOLD,
} from '../config/store';

const linkCls = 'text-cactus-600 dark:text-cactus-400 font-medium hover:underline';

export function ShippingPage() {
  return (
    <InfoPage
      icon="📦"
      title="Shipping & Returns"
      subtitle="How we pack, ship and stand behind every plant."
    >
      {/* Rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-cactus-50 dark:bg-cactus-950 border border-cactus-200 dark:border-cactus-800 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-cactus-600 dark:text-cactus-400 mb-1">Orders ₹{SHIPPING_THRESHOLD}+</p>
          <p className="font-display text-3xl text-cactus-700 dark:text-cactus-300">Free</p>
          <p className="text-sm text-cactus-700/80 dark:text-cactus-300/80 mt-1">standard shipping</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Under ₹{SHIPPING_THRESHOLD}</p>
          <p className="font-display text-3xl text-gray-900 dark:text-white">₹{SHIPPING_COST.toFixed(2)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">flat rate per order</p>
        </div>
      </div>

      <InfoSection title="Where we ship" icon="🌍">
        <p>We currently deliver to:</p>
        <div className="flex flex-wrap gap-2">
          {SHIPPING_COUNTRIES.map(c => (
            <span key={c} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">{c}</span>
          ))}
        </div>
        <p>Some plants can't be sent to certain regions because of local plant-import rules. If that applies to your order, we'll contact you before shipping.</p>
      </InfoSection>

      <InfoSection title="Processing & delivery" icon="🚚">
        <InfoList items={[
          <>Orders are prepared once payment is verified, usually within <strong className="text-gray-800 dark:text-gray-200">2–4 business days</strong>.</>,
          <>You'll receive an email with tracking details when your parcel ships.</>,
          <>During extreme heat or cold we may hold shipments for a few days to protect your plants — we'll let you know if this affects you.</>,
          <>Won auctions ship after payment is completed, following the same process.</>,
        ]} />
      </InfoSection>

      <InfoSection title="How we pack" icon="🎁">
        <p>
          Plants are usually shipped bare-root, wrapped in paper and padded to stop movement in the box. This keeps
          them healthy in transit and prevents rot. Pot them in a dry, gritty mix and wait a few days before watering.
        </p>
      </InfoSection>

      <InfoSection title="Live plant guarantee" icon="🌿">
        <p>
          If your plant arrives broken, rotten or badly damaged, contact us within{' '}
          <strong className="text-gray-800 dark:text-gray-200">{DAMAGE_REPORT_HOURS} hours of delivery</strong> with
          photos of the plant and the packaging. We'll send a replacement or a full refund.
        </p>
      </InfoSection>

      <InfoSection title="Returns" icon="↩️">
        <InfoList items={[
          <>Returns are accepted within <strong className="text-gray-800 dark:text-gray-200">{RETURN_WINDOW_DAYS} days</strong> of delivery.</>,
          <>Plants must be returned in the condition they arrived. Return shipping is paid by the buyer unless the item arrived damaged or was sent in error.</>,
          <>Refunds go back to your original payment method once we receive the return.</>,
          <>Auction purchases can be returned only if they arrive damaged.</>,
        ]} />
        <p>
          To start a return, <Link to="/contact" className={linkCls}>contact us</Link> with your order number.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
