// src/pages/AboutPage.tsx
import { useNavigate } from 'react-router-dom';
import { InfoPage, InfoSection } from '../components/info/InfoPage';
import { STORE } from '../config/store';

const HIGHLIGHTS = [
  { icon: '🌵', title: 'Astrophytum specialists', text: 'Star cactus, Bishop’s cap, Medusa and rare cultivars — we focus on the genus we love most.' },
  { icon: '🔨', title: 'Live auctions',           text: 'Rare and one-of-a-kind plants go up for real-time bidding, so everyone gets a fair chance.' },
  { icon: '📦', title: 'Careful packing',         text: 'Every plant is wrapped and padded by hand so it arrives healthy and ready to grow.' },
  { icon: '🌿', title: 'Live plant guarantee',    text: 'If your plant arrives damaged, tell us and we’ll make it right.' },
];

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <InfoPage
      icon="🌵"
      title={`About ${STORE.name}`}
      subtitle="A small shop for people who love slow-growing, star-shaped, wonderfully strange cacti."
    >
      <InfoSection title="Our story">
        <p>
          {STORE.name} started with a simple obsession: <em>Astrophytum</em>. These cacti grow slowly, flower
          beautifully and no two plants ever look quite alike — the speckles, ribs and shapes make each one unique.
        </p>
        <p>
          We built this shop to make healthy, well-grown plants easy to find, whether you're buying your first
          star cactus or hunting for a rare cultivar to complete your collection.
        </p>
      </InfoSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {HIGHLIGHTS.map(({ icon, title, text }) => (
          <div key={title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <p className="text-2xl mb-2">{icon}</p>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">{title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <InfoSection title="How it works">
        <p>
          <strong className="text-gray-800 dark:text-gray-200">Buy now</strong> — browse the collection, add plants to
          your cart and check out with Google Pay / UPI.
        </p>
        <p>
          <strong className="text-gray-800 dark:text-gray-200">Bid</strong> — selected plants are sold through live
          auctions. Place a bid, watch it update in real time, and track everything from <em>My Bids</em>.
        </p>
      </InfoSection>

      <div className="bg-cactus-50 dark:bg-cactus-950 border border-cactus-100 dark:border-cactus-900 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-cactus-800 dark:text-cactus-200">Ready to find your next plant?</p>
          <p className="text-sm text-cactus-600 dark:text-cactus-400">New plants and auctions are added regularly.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate('/home')}
            className="px-4 py-2 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors">
            Browse Collection
          </button>
          <button onClick={() => navigate('/auctions')}
            className="px-4 py-2 border border-cactus-300 dark:border-cactus-700 text-cactus-700 dark:text-cactus-300 text-sm font-semibold rounded-lg hover:bg-cactus-100 dark:hover:bg-cactus-900 transition-colors">
            Live Auctions
          </button>
        </div>
      </div>
    </InfoPage>
  );
}
