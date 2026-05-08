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
// GET /api/config
// Frontend fetches this to know if OTO popup should show.
// Toggle OTO_ENABLED=true|false in your .env to control it.
// ============================================================
app.get('/api/config', (req, res) => {
  res.json({
    otoEnabled: process.env.OTO_ENABLED !== 'false', // default ON
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
// POST /api/lead/capture
// Called immediately when user starts filling checkout fields
// ============================================================
app.post('/api/lead/capture', async (req, res) => {
  try {
    const { name, email, phone, cart, total } = req.body;
    console.log(`📋 Lead captured: ${email} | ₦${total}`);
    // Could save to DB here for extra persistence
    res.json({ success: true });
  } catch (err) {
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

    const amountPaid = txn.amount / 100; // convert from kobo
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
      // Standard GHL contact fields
      firstName,
      lastName,
      name: payload.name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      // Order data
      type: payload.type,
      cart: cartItems,
      amount_paid: payload.amount_paid || payload.total || 0,
      reference: payload.reference || '',
      paid_at: payload.paid_at || payload.abandoned_at || new Date().toISOString(),
      // Raw cart for GHL custom field branching
      cart_ids: Array.isArray(payload.cart)
        ? payload.cart.map(i => i.id || i.name).join(',')
        : ''
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
