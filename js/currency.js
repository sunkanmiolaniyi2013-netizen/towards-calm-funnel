/**
 * currency.js
 * Detects visitor's country via IP and converts all prices.
 * Updates all elements with data-price="<NGN amount>" attributes.
 */
(function(){
  window.TC = window.TC || {};
  window.TC.currency = { code: 'NGN', symbol: '₦', rate: 1 };

  function formatPrice(ngnAmount, currency) {
    const converted = ngnAmount * currency.rate;
    // Format nicely
    if (currency.code === 'NGN') {
      return currency.symbol + Math.round(ngnAmount).toLocaleString('en-NG');
    }
    if (converted < 1) {
      return currency.symbol + converted.toFixed(2);
    }
    return currency.symbol + converted.toLocaleString('en', { maximumFractionDigits: 2 });
  }

  function applyPrices(currency) {
    window.TC.currency = currency;
    window.TC.formatPrice = (ngn) => formatPrice(ngn, currency);

    // Update all price elements
    document.querySelectorAll('[data-price]').forEach(el => {
      const ngn = parseFloat(el.getAttribute('data-price'));
      if (!isNaN(ngn)) {
        el.textContent = formatPrice(ngn, currency);
      }
    });

    // Update currency badge if present
    const badge = document.getElementById('tc-currency-badge');
    if (badge) {
      badge.textContent = currency.code + ' ' + currency.symbol;
      badge.title = currency.name;
    }
  }

  // Fetch currency from backend (cached per session)
  const cached = sessionStorage.getItem('tc_currency');
  if (cached) {
    try {
      const c = JSON.parse(cached);
      applyPrices(c);
      return;
    } catch(e) {}
  }

  fetch('/api/geo')
    .then(r => r.json())
    .then(currency => {
      sessionStorage.setItem('tc_currency', JSON.stringify(currency));
      applyPrices(currency);
    })
    .catch(() => {
      // Default to NGN if geo fails
      applyPrices({ code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate: 1 });
    });
})();
