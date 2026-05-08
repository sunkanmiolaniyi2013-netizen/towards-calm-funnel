// ============================================================
// OFFER CONFIGURATION — Edit this file to update offers
// All prices are in NGN (Naira). Currency.js handles conversion.
// ============================================================

const OFFERS = {
  // The main FREE front-end offer (always included, cannot be removed)
  main: {
    id: 'therapy-bundle',
    name: '200+ Therapy Bundle',
    description: 'Step-by-step trauma recovery guide, 1000+ healing notes, mindfulness exercises & more',
    price: 0,
    image: 'images/NewStructurePPIMage_9_bdf5b193-1cfa-4d00-a496-2388e94994b3.webp',
    required: true
  },

  // Cart bump offers — each has its own image matching the product cover
  bumps: [
    {
      id: 'adhd-bundle',
      name: 'ADHD Bundle',
      description: 'ADHD Executive Functioning Skills, Late Diagnosis Therapy, CBT for ADHD & Frustration Tolerance worksheets.',
      price: 3000,
      image: 'images/ADHD_Bundle_5d8a1b0c-483f-40d5-bba0-8b9de97ef407.webp',
      badge: '🔥 MOST POPULAR',
      defaultChecked: true
    },
    {
      id: 'trauma-ptsd-mindfulness',
      name: 'Trauma PTSD, Mindfulness and Self Care Cards',
      description: 'PTSD symptom guides, Fight-Flight-Freeze response tools, Trauma Reaction Checklist & mindfulness self-care cards.',
      price: 3000,
      image: 'images/Trauma_PTSD_Mindfulness_085e7711-7746-4116-9f87-34a1e8ef9d3b.webp',
      badge: '⭐ BESTSELLER',
      defaultChecked: true
    },
    {
      id: 'building-healthy-relationships',
      name: 'Building Healthy Relationships',
      description: 'Practical tools and worksheets to build secure, loving and emotionally intelligent relationships.',
      price: 3000,
      image: 'images/Building_Healthy_4a48947f-f960-4335-98b3-81283e49e824.webp',
      badge: null,
      defaultChecked: true
    },
    {
      id: 'mindfulness-calming',
      name: 'Mindfulness: Calming your Mind + Journal',
      description: 'Guided mindfulness practices, calming techniques and a daily journaling system for emotional regulation.',
      price: 3000,
      image: 'images/Mindfulness_Calming_85c253ad-21ee-4f2b-aca6-58dd9557aa92.webp',
      badge: null,
      defaultChecked: true
    },
    {
      id: 'self-sabotage-burnout',
      name: 'Self Sabotage and Burnout Prevention',
      description: 'Identify self-sabotaging patterns, beat burnout and rebuild healthy habits with expert-crafted worksheets.',
      price: 3000,
      image: 'images/Self_Sabotage_3e92a5e4-d2b8-4475-b860-4b0d64804e76.webp',
      badge: null,
      defaultChecked: true
    },
    {
      id: 'stress-management-workbook',
      name: 'Stress Management Workbook',
      description: 'Gratitude journaling, ABC Model, Worry Tree, Personal Stress Triggers and nervous system reset tools.',
      price: 3000,
      image: 'images/upsell_10_4245af4c-a740-4f3e-be1f-e780790fa229.webp',
      badge: '💎 HIGH VALUE',
      defaultChecked: true
    }
  ]
};

// Currency formatter — used as fallback before currency.js loads
function formatPrice(amount) {
  if (amount === 0) return 'FREE';
  if (window.TC && window.TC.formatPrice) return window.TC.formatPrice(amount);
  return '₦' + amount.toLocaleString('en-NG');
}
