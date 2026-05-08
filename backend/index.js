require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend (parent directory)
app.use(express.static(path.join(__dirname, '..')));

// ============================================================
// In-memory lead store (use a DB in production)
// ============================================================
const pendingLeads = new Map();

// ============================================================
// Analytics store (in-memory — resets on deploy)
// ============================================================
const analytics = {
  page_views:      { landing: 0, checkout: 0, thankyou: 0 },
  cart_opens:      0,
  oto_views:       0,
  oto_accepts:     0,
  oto_declines:    0,
  checkout_starts: 0,
  lead_captures:   0,
  purchases:       0,
  free_claims:     0,
  abandonments:    0,
  revenue:         0,
  events:          [] // last 50 events log
};

// Exchange rate cache
let rateCache = { rates: null, fetchedAt: 0 };

// ============================================================
// GET /api/config — frontend fetches pixel ID + OTO config
// ============================================================
app.get('/api/config', (req, res) => {
  res.json({
    otoEnabled: process.env.OTO_ENABLED !== 'false',
    pixelId: process.env.FB_PIXEL_ID || '',
    oto: {
      title: 'Start Feeling Calm, Focused & In Control — Even on Your Worst Days',
      subtitle: 'This one-time offer disappears when you leave this page',
      productName: 'Big Success Mystery Box',
      productDesc: '300+ therapist-approved tools to unlock emotional resilience and calm your nervous system.',
      features: [
        'Calm anxiety at the nervous system level',
        'Stop overthinking with CBT techniques',
        'Build emotional resilience daily',
        'Inner child healing exercises',
        'Nervous system reset guide'
      ],
      originalPrice: 300,
      salePrice: 12.97,
      image: 'images/product-main.png',
      acceptLabel: 'Add My Healing Vault',
      declineLabel: "I'd rather pay full price",
      timerSeconds: 600
    }
  });
});

// ============================================================
// POST /api/analytics/event — track funnel events
// ============================================================
app.post('/api/analytics/event', (req, res) => {
  const { event, data } = req.body;
  const ts = new Date().toISOString();

  switch(event) {
    case 'page_view':
      if (data?.page && analytics.page_views[data.page] !== undefined)
        analytics.page_views[data.page]++;
      break;
    case 'cart_open':      analytics.cart_opens++;      break;
    case 'oto_view':       analytics.oto_views++;       break;
    case 'oto_accept':     analytics.oto_accepts++;     break;
    case 'oto_decline':    analytics.oto_declines++;    break;
    case 'checkout_start': analytics.checkout_starts++; break;
    case 'lead_capture':   analytics.lead_captures++;   break;
    case 'purchase':
      analytics.purchases++;
      analytics.revenue += (data?.amount || 0);
      break;
    case 'free_claim':     analytics.free_claims++;     break;
    case 'abandoned':      analytics.abandonments++;    break;
  }

  // Keep last 50 events
  analytics.events.unshift({ event, data, ts });
  if (analytics.events.length > 50) analytics.events.pop();

  res.json({ success: true });
});

// ============================================================
// GET /api/analytics/stats — dashboard data (password protected)
// ============================================================
app.get('/api/analytics/stats', (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const totalVisitors = analytics.page_views.landing;
  const conversionRate = totalVisitors > 0
    ? ((analytics.purchases / totalVisitors) * 100).toFixed(1)
    : '0.0';

  res.json({
    ...analytics,
    total_visitors: totalVisitors,
    conversion_rate: conversionRate + '%',
    avg_order_value: analytics.purchases > 0
      ? (analytics.revenue / analytics.purchases).toFixed(0)
      : 0
  });
});

// ============================================================
// GET /api/geo — detect visitor's country and return currency
// ============================================================
app.get('/api/geo', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const isLocal = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168');

    // Currency map by country code
    const currencyMap = {
      NG: { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira' },
      US: { code: 'USD', symbol: '$',  name: 'US Dollar' },
      CA: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
      GB: { code: 'GBP', symbol: '£',  name: 'British Pound' },
      AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
      GH: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
      ZA: { code: 'ZAR', symbol: 'R',  name: 'South African Rand' },
      KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
      DE: { code: 'EUR', symbol: '€',  name: 'Euro' },
      FR: { code: 'EUR', symbol: '€',  name: 'Euro' },
      IT: { code: 'EUR', symbol: '€',  name: 'Euro' },
      ES: { code: 'EUR', symbol: '€',  name: 'Euro' },
      NL: { code: 'EUR', symbol: '€',  name: 'Euro' },
    };

    let currency = currencyMap['NG']; // default NGN

    if (!isLocal) {
      const geoRes = await axios.get(`http://ip-api.com/json/${ip}?fields=countryCode`, { timeout: 3000 });
      const cc = geoRes.data?.countryCode;
      if (cc && currencyMap[cc]) currency = currencyMap[cc];
    }

    // Fetch exchange rates (NGN base), cache 6 hours
    const now = Date.now();
    if (!rateCache.rates || (now - rateCache.fetchedAt) > 6 * 60 * 60 * 1000) {
      try {
        const ratesRes = await axios.get('https://open.er-api.com/v6/latest/NGN', { timeout: 5000 });
        rateCache.rates = ratesRes.data.rates;
        rateCache.fetchedAt = now;
      } catch {
        // Fallback hardcoded rates (NGN base)
        rateCache.rates = { NGN:1, USD:0.00065, GBP:0.00051, EUR:0.00060, GHS:0.0076, ZAR:0.012, KES:0.084, CAD:0.00089, AUD:0.0010 };
        rateCache.fetchedAt = now;
      }
    }

    const rate = rateCache.rates[currency.code] || 1;
    res.json({ ...currency, rate, ip: isLocal ? 'local' : ip });
  } catch (err) {
    console.error('Geo error:', err.message);
    res.json({ code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate: 1 });
  }
});


// ============================================================
// POST /api/lead/capture
// Called immediately when user starts filling checkout fields
// ============================================================
app.post('/api/lead/capture', async (req, res) => {
  try {
    const { name, email, phone, cart, total, type } = req.body;
    console.log(`📋 Lead captured: ${email} | ₦${total}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================================
// POST /api/pay/free
// Called when customer claims free item (total = 0).
// No payment needed — fires GHL directly.
// ============================================================
app.post('/api/pay/free', async (req, res) => {
  try {
    const { name, email, phone, cart } = req.body;
    console.log(`🆓 Free claim: ${email}`);

    await fireGHLWebhook({
      type: 'FREE_CLAIM',
      name,
      email,
      phone,
      cart: cart || [],
      amount_paid: 0,
      reference: `FREE-${Date.now()}`,
      paid_at: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Free claim error:', err.message);
    res.status(500).json({ success: false });
  }
});


// ============================================================
// POST /api/pay/initialize
// Initializes a Paystack transaction and starts abandonment timer
// ============================================================
app.post('/api/pay/initialize', async (req, res) => {
  try {
    const { name, email, phone, cart, total } = req.body;

    // Generate unique reference every time to avoid duplicate errors
    const uniqueRef = `TC-${Date.now()}-${Math.random().toString(36).substr(2,9)}-${Math.random().toString(36).substr(2,5)}`.toUpperCase();

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        reference: uniqueRef,
        amount: Math.round(total * 100), // convert Naira → kobo for Paystack
        currency: 'NGN',
        callback_url: `${process.env.BASE_URL}/thankyou.html`,
        metadata: {
          name,
          phone,
          cart: JSON.stringify(cart),
          custom_fields: [
            { display_name: 'Customer Name', variable_name: 'name', value: name },
            { display_name: 'Phone', variable_name: 'phone', value: phone },
            { display_name: 'Products', variable_name: 'cart', value: cart.map(i => i.name || i.id).join(', ') }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { reference, authorization_url, access_code } = response.data.data;

    // Store lead + start 5-min abandonment timer
    const leadData = { name, email, phone, cart, total, reference, paidAt: null };

    const timer = setTimeout(async () => {
      if (pendingLeads.has(reference)) {
        const lead = pendingLeads.get(reference);
        console.log(`⚠️  Abandoned lead: ${lead.email}`);
        await fireGHLWebhook({ ...lead, type: 'ABANDONED', abandoned_at: new Date().toISOString() });
        pendingLeads.delete(reference);
      }
    }, 5 * 60 * 1000); // 5 minutes

    leadData.timer = timer;
    pendingLeads.set(reference, leadData);

    res.json({
      success: true,
      authorization_url,
      reference,
      access_code,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY  // needed for inline popup
    });
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'Unknown error';
    console.error('❌ Payment init error:', errMsg, err.response?.data);
    res.status(200).json({ success: false, error: errMsg }); // 200 so fetch doesn't throw
  }
});

// ============================================================
// POST /api/pay/confirm
// Called by frontend after Paystack inline popup succeeds.
// Verifies payment with Paystack, fires GHL PAID webhook.
// Works even on localhost (no inbound webhook needed).
// ============================================================
app.post('/api/pay/confirm', async (req, res) => {
  try {
    const { reference, email, name, phone, cart, total } = req.body;
    console.log(`🔍 Verifying payment: ${reference}`);

    // Verify with Paystack API to confirm it's real
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const txn = verify.data.data;
    if (txn.status !== 'success') {
      console.warn(`⚠️  Payment not confirmed: ${reference} — status: ${txn.status}`);
      return res.json({ success: false, message: 'Payment not verified' });
    }

    const amountPaid = txn.amount / 100;
    analytics.purchases++;
    analytics.revenue += amountPaid;
    console.log(`✅ Payment verified: ${email} — ₦${amountPaid}`);

    // Cancel abandonment timer if running
    if (pendingLeads.has(reference)) {
      const lead = pendingLeads.get(reference);
      clearTimeout(lead.timer);
      pendingLeads.delete(reference);
    }

    // Fire PAID webhook to GHL
    await fireGHLWebhook({
      type: 'PAID',
      name: name || txn.metadata?.name,
      email: email || txn.customer?.email,
      phone: phone || txn.metadata?.phone,
      cart: cart || [],
      amount_paid: amountPaid,
      reference,
      paid_at: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Payment confirm error:', err.response?.data || err.message);
    res.status(500).json({ success: false });
  }
});

// ============================================================
// POST /api/pay/webhook
// Paystack fires this when payment completes
// ============================================================
app.post('/api/pay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.warn('⚠️  Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }

  const event = JSON.parse(req.body);

  if (event.event === 'charge.success') {
    const { reference, metadata, amount, customer } = event.data;
    console.log(`✅ Payment confirmed: ${customer.email} — ₦${amount / 100}`);

    if (pendingLeads.has(reference)) {
      const lead = pendingLeads.get(reference);
      clearTimeout(lead.timer); // Cancel abandonment timer

      await fireGHLWebhook({
        type: 'PAID',
        name: metadata?.name || lead.name,
        email: customer.email,
        phone: metadata?.phone || lead.phone,
        cart: lead.cart,
        amount_paid: amount / 100,
        reference,
        paid_at: new Date().toISOString()
      });

      pendingLeads.delete(reference);
    }
  }

  res.sendStatus(200);
});

// ============================================================
// GHL Webhook Helper
// ============================================================
async function fireGHLWebhook(payload) {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url || url.includes('your-ghl')) {
    console.log('📤 GHL webhook (not configured yet):', JSON.stringify(payload, null, 2));
    return;
  }
  try {
    // Split name into first/last for GHL compatibility
    const nameParts = (payload.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build cart summary string for GHL custom fields
    const cartItems = Array.isArray(payload.cart)
      ? payload.cart.map(i => i.name || i.id).join(', ')
      : (payload.cart || '');

    const ghlPayload = {
      // GHL standard contact fields (snake_case — matches {{contact.xxx}} in GHL)
      first_name: firstName,
      last_name: lastName,
      email: payload.email || '',
      phone: payload.phone || '',
      // Also send camelCase for safety
      firstName,
      lastName,
      name: payload.name || '',
      // Order custom fields
      order_type: payload.type,
      type: payload.type,
      cart_items: cartItems,
      cart: cartItems,
      cart_ids: Array.isArray(payload.cart)
        ? payload.cart.map(i => i.id || i.name).join(',')
        : '',
      amount_paid: payload.amount_paid || payload.total || 0,
      order_reference: payload.reference || '',
      reference: payload.reference || '',
      paid_at: payload.paid_at || payload.abandoned_at || new Date().toISOString()
    };

    await axios.post(url, ghlPayload, { headers: { 'Content-Type': 'application/json' } });
    console.log(`📤 GHL webhook fired: ${payload.type} — ${payload.email}`);
  } catch (err) {
    console.error('❌ GHL webhook error:', err.message);
  }
}

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📦 Serving frontend from: ${path.join(__dirname, '..')}`);
  console.log(`💳 Paystack: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Key loaded' : '❌ Missing key'}`);
  console.log(`📤 GHL Webhook: ${process.env.GHL_WEBHOOK_URL?.includes('your-ghl') ? '⚠️  Not configured' : '✅ Configured'}\n`);
});
