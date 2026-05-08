// ── Cart Logic ────────────────────────────────────────────
// Prices are stored and calculated in NGN (Naira).
// Display is handled by currency.js (TC.formatPrice / TC.applyPrices).
(function(){
  let bumpsOn = new Set();

  // Run immediately — buttons may already be in DOM (defer)
  init();

  function init(){
    // Pre-check all bumps
    OFFERS.bumps.forEach(b => { if(b.defaultChecked) bumpsOn.add(b.id); });

    // All "open cart" triggers: data-open-cart attribute
    document.querySelectorAll('[data-open-cart]').forEach(el => {
      el.addEventListener('click', openCart);
    });

    document.getElementById('cd-close').addEventListener('click', closeCart);
    document.getElementById('cart-overlay').addEventListener('click', closeCart);
    document.getElementById('cd-btn').addEventListener('click', goCheckout);

    renderCart();

    // Re-apply currency if it loads after cart renders
    if(window.TC && window.TC.onReady){
      TC.onReady(() => updateTotals());
    }
  }

  function renderCart(){
    const container = document.getElementById('cd-items');
    container.innerHTML = '';

    // ── Main free product row
    const mainRow = document.createElement('div');
    mainRow.className = 'cd-main';
    mainRow.innerHTML = `
      <div class="cd-main-img">
        <img src="${OFFERS.main.image || 'images/WEBSITE_TRAUMA_24_MARCH_SAM_1_2.webp'}" alt="${OFFERS.main.name}" loading="lazy"/>
      </div>
      <div class="cd-main-info">
        <div class="cd-main-name">${OFFERS.main.name}</div>
        <div class="cd-qty">
          <span class="qty-b">−</span>
          <span class="qty-n">1</span>
          <span class="qty-b">+</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;flex-shrink:0">
        <span class="cd-main-price" data-price="0">FREE</span>
        <span class="cd-del">🗑</span>
      </div>
    `;
    container.appendChild(mainRow);

    // ── Bump offers with toggle switches
    OFFERS.bumps.forEach(bump => {
      const isOn = bumpsOn.has(bump.id);
      const row = document.createElement('div');
      row.className = 'cd-bump';
      row.innerHTML = `
        <div class="cd-bump-img">
          <img src="${bump.image || 'images/WEBSITE_TRAUMA_24_MARCH_SAM_1_2.webp'}" alt="${bump.name}" loading="lazy"/>
        </div>
        <div class="cd-bump-info">
          <div class="cd-bump-name">${bump.name}</div>
          <div class="cd-bump-price" data-price="${bump.price}">₦${bump.price.toLocaleString('en-NG')}</div>
        </div>
        <label class="toggle" aria-label="Add ${bump.name}">
          <input type="checkbox" ${isOn ? 'checked' : ''} data-id="${bump.id}"/>
          <span class="t-track"></span>
          <span class="t-thumb"></span>
        </label>
      `;
      row.querySelector('input').addEventListener('change', function(){
        if(this.checked) bumpsOn.add(bump.id); else bumpsOn.delete(bump.id);
        updateTotals();
      });
      container.appendChild(row);
    });

    // Apply currency to the freshly rendered items
    if(window.TC && window.TC.applyPrices) TC.applyPrices(container);

    updateTotals();
  }

  function updateTotals(){
    let total = 0, count = 1;
    OFFERS.bumps.forEach(b => { if(bumpsOn.has(b.id)){ total += b.price; count++; } });

    // Format using currency.js if available, otherwise fall back to NGN
    const fmt = (window.TC && window.TC.formatPrice)
      ? ngn => (ngn === 0 ? 'FREE' : TC.formatPrice(ngn))
      : ngn => (ngn === 0 ? 'FREE' : '₦' + ngn.toLocaleString('en-NG'));

    // Header badge
    const hdr = document.getElementById('hdr-count');
    if(hdr) hdr.textContent = count;

    // Drawer title count
    const dc = document.getElementById('cd-count');
    if(dc) dc.textContent = count;

    // Subtotal
    const totalEl = document.getElementById('cd-total');
    if(totalEl){
      totalEl.setAttribute('data-price', total);
      totalEl.textContent = fmt(total);
    }

    // Checkout button
    const btn = document.getElementById('cd-btn');
    if(btn) btn.textContent = total === 0 ? 'Check out — FREE' : `Check out — ${fmt(total)}`;
  }

  function openCart(){
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Track analytics + pixel
    if(window.TC) TC.track('cart_open');
  }

  function closeCart(){
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('cart-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function goCheckout(){
    const cart = [OFFERS.main];
    OFFERS.bumps.forEach(b => { if(bumpsOn.has(b.id)) cart.push(b); });
    const total = cart.reduce((s, i) => s + (i.price || 0), 0);
    closeCart();
    // Track analytics + pixel
    if(window.TC){
      TC.track('checkout_start', { total });
      TC.pixel('AddToCart', { value: total, currency: 'NGN' });
    }
    window.OTO.trigger(cart, total);
  }

})();
