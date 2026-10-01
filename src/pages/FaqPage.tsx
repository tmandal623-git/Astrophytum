// src/pages/FaqPage.tsx
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { InfoPage } from '../components/info/InfoPage';
import { RETURN_WINDOW_DAYS, SHIPPING_COST, SHIPPING_THRESHOLD, STORE } from '../config/store';

const linkCls = 'text-cactus-600 dark:text-cactus-400 font-medium hover:underline';

const FAQ: { section: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    section: 'Ordering & payment',
    items: [
      {
        q: 'How do I pay?',
        a: <>We accept Google Pay / UPI. At checkout, scan the QR code or pay to our UPI ID, then enter the
            transaction ID (UTR) from your payment app so we can match your payment.</>,
      },
      {
        q: 'Why is my order “awaiting verification”?',
        a: <>UPI payments are checked by our team. Once we confirm the transaction ID, your order moves to
            <em> confirmed</em> and we start preparing it. This usually happens within one business day.</>,
      },
      {
        q: 'Do I need an account to order?',
        a: <>You can browse and fill your cart as a guest, but you'll need to log in to check out or bid.
            Your cart is kept when you log in.</>,
      },
      {
        q: 'Where can I see my orders?',
        a: <>Open <Link to="/profile?tab=orders" className={linkCls}>My Orders</Link> from the menu.</>,
      },
    ],
  },
  {
    section: 'Auctions',
    items: [
      {
        q: 'How do auctions work?',
        a: <>Each auction has a starting price and an end time. Place a bid higher than the current bid —
            the highest bid when the timer ends wins. Bids update live on the page.</>,
      },
      {
        q: 'Are bids binding?',
        a: <>Yes. Please only bid what you're willing to pay — a bid can't be withdrawn once placed.</>,
      },
      {
        q: 'How do I know if I’ve been outbid?',
        a: <>Your <Link to="/profile?tab=bids" className={linkCls}>My Bids</Link> page shows each auction as
            Winning, Outbid, Won or Lost, with a quick Rebid button.</>,
      },
      {
        q: 'I won an auction — what next?',
        a: <>Won auctions appear under My Bids. Our team will contact you by email to complete payment and arrange delivery.</>,
      },
    ],
  },
  {
    section: 'Shipping & returns',
    items: [
      {
        q: 'How much is shipping?',
        a: <>Shipping is free on orders of ₹{SHIPPING_THRESHOLD} or more; otherwise it's a flat ₹{SHIPPING_COST.toFixed(2)}.
            See <Link to="/shipping" className={linkCls}>Shipping & Returns</Link> for details.</>,
      },
      {
        q: 'What if my plant arrives damaged?',
        a: <>Contact us with photos and we'll replace or refund it under our live plant guarantee. Returns are
            accepted within {RETURN_WINDOW_DAYS} days of delivery.</>,
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        q: 'Why was I logged out?',
        a: <>For your security, you're logged out automatically after 5 minutes without any activity. Just log in again to continue.</>,
      },
      {
        q: 'I forgot my password.',
        a: <>Choose <em>Forgot password</em> in the login window and we'll email you a reset link.</>,
      },
    ],
  },
  {
    section: 'Plant care',
    items: [
      {
        q: 'How do I care for an Astrophytum?',
        a: <>Give it plenty of bright light, a fast-draining gritty mix, and water only when the soil is
            completely dry. Water less in winter and keep it frost-free.</>,
      },
      {
        q: 'My new plant looks a little pale or soft — is that normal?',
        a: <>A few days in a box can stress a plant. Unpack it right away, keep it out of harsh direct sun for
            about a week, and wait a few days before the first watering. If you're worried,
            <Link to="/contact" className={linkCls}> send us a photo</Link>.</>,
      },
    ],
  },
];

export function FaqPage() {
  return (
    <InfoPage
      icon="❓"
      title="Frequently Asked Questions"
      subtitle="Quick answers about ordering, auctions, shipping and plant care."
    >
      {FAQ.map(({ section, items }) => (
        <section key={section}>
          <h2 className="font-display text-xl text-gray-900 dark:text-white mb-3">{section}</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
            {items.map(({ q, a }) => (
              <details key={q} className="group px-5">
                <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-medium text-gray-800 dark:text-gray-200">
                  {q}
                  <span className="text-gray-400 transition-transform duration-200 group-open:rotate-45 text-lg leading-none flex-shrink-0">+</span>
                </summary>
                <div className="pb-4 -mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Still have a question? <Link to="/contact" className={linkCls}>Contact us</Link> — we reply to {STORE.email}.
      </p>
    </InfoPage>
  );
}
