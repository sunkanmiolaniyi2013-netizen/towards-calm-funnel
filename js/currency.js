/**
 * currency.js — Auto Currency Conversion
 * Detects visitor country via IP, fetches live exchange rates,
 * and converts every element with data-price="<NGN>" to local currency.
 * Call TC.applyPrices(containerEl) on any dynamic content after rendering.
 */
(function(){
  window.TC = window.TC || {};

  let _currency = { code: 'NGN', symbol: '₦', rate: 1, name: 'Nigerian Naira' };
  let _ready = false;
  let _callbacks = [];

  // ── Format a NGN amount into the visitor's currency ─────────────────────
  function formatPrice(ngnAmount) {
    const converted = ngnAmount * _currency.rate;
    if (_currency.code === 'NGN') {
      return '₦' + Math.round(ngnAmount).toLocaleString('en-NG');
    }
    if (converted < 1) {
      return _currency.symbol + converted.toFixed(2);
    }
    return _currency.symbol + converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // ── Apply prices to all [data-price] inside a container ─────────────────
  function applyPrices(container) {
    const root = container || document;
    root.querySelectorAll('[data-price]').forEach(el => {
      const ngn = parseFloat(el.getAttribute('data-price'));
      if (!isNaN(ngn)) {
        el.textContent = ngn === 0 ? 'FREE' : formatPrice(ngn);
      }
    });
    // Update currency badge if present
    const badge = root.querySelector('#tc-currency-badge') || document.getElementById('tc-currency-badge');
    if (badge) {
      badge.textContent = _currency.code + ' ' + _currency.symbol;
      badge.title = _currency.name;
    }
  }

  // ── Run callback when currency is ready ─────────────────────────────────
  function onReady(cb) {
    if (_ready) cb(_currency);
    else _callbacks.push(cb);
  }

  // Expose API immediately (formatPrice falls back to NGN until geo loads)
  window.TC.formatPrice = formatPrice;
  window.TC.applyPrices = applyPrices;
  window.TC.onReady = onReady;
  window.TC.getCurrency = () => _currency;

  // ── Load currency ────────────────────────────────────────────────────────
  function init(currency) {
    _currency = currency;
    _ready = true;
    window.TC.formatPrice = formatPrice;
    window.TC.applyPrices = applyPrices;

    // Apply to entire page
    applyPrices(document);

    // Notify callbacks
    _callbacks.forEach(cb => cb(currency));
    _callbacks = [];
  }

  // Try session cache first for instant render
  const cached = sessionStorage.getItem('tc_currency');
  if (cached) {
    try {
      const c = JSON.parse(cached);
      init(c);
      return;
    } catch(e) {}
  }

  // Fetch from backend geo endpoint
  fetch('/api/geo')
    .then(r => r.json())
    .then(currency => {
      sessionStorage.setItem('tc_currency', JSON.stringify(currency));
      init(currency);
    })
    .catch(() => {
      // Default to NGN if geo fails
      init({ code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate: 1 });
    });
})();
