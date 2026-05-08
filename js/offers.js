// ============================================================
// OFFER CONFIGURATION — Edit this file to update offers
// ============================================================

const OFFERS = {
  // The main FREE front-end offer (always included, cannot be removed)
  main: {
    id: 'therapy-bundle',
    name: '200+ Therapy Bundle',
    description: 'Step-by-step trauma recovery guide, 1000+ healing notes, mindfulness exercises & more',
    price: 0,
    required: true
  },

  // Cart bump offers (up to 5) — pre-checked by default
  bumps: [
    {
      id: 'audio-meditations',
      name: 'Trauma Recovery Audio Meditations',
      description: '12 guided audio sessions to help you process and release emotional trauma at your own pace.',
      price: 3500,
      badge: '🔥 MOST POPULAR',
      defaultChecked: true
    },
    {
      id: 'cbt-workbook',
      name: 'CBT Workbook Pack',
      description: 'Cognitive Behavioral Therapy worksheets and exercises used by licensed therapists worldwide.',
      price: 2500,
      badge: '⭐ BESTSELLER',
      defaultChecked: true
    },
    {
      id: 'healing-journal',
      name: '30-Day Healing Journal (Printable)',
      description: 'A beautifully designed daily journal to track your healing journey and emotional progress.',
      price: 2000,
      badge: null,
      defaultChecked: true
    },
    {
      id: 'family-toolkit',
      name: 'Family Healing Toolkit',
      description: 'Specialized tools for parents, partners and caregivers supporting a loved one\'s healing.',
      price: 3000,
      badge: null,
      defaultChecked: true
    },
    {
      id: 'mindfulness-masterclass',
      name: 'Mindfulness Masterclass (Video Series)',
      description: 'Full video series covering advanced mindfulness, breathwork, and body scanning techniques.',
      price: 5000,
      badge: '💎 HIGH VALUE',
      defaultChecked: true
    }
  ]
};

// Currency formatter
function formatPrice(amount) {
  if (amount === 0) return 'FREE';
  return '₦' + amount.toLocaleString('en-NG');
}
