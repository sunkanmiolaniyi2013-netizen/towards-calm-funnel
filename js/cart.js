// ── Cart Logic ────────────────────────────────────────────
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
  }

  function renderCart(){
    const container = document.getElementById('cd-items');
    container.innerHTML = '';

    // ── Main free product row
    const mainRow = document.createElement('div');
    mainRow.className = 'cd-main';
    mainRow.innerHTML = `
      <div class="cd-main-img">
        <img src="images/product-main.png" alt="${OFFERS.main.name}" loading="lazy"/>
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
        <span class="cd-main-price">$0.00</span>
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
          <img src="images/product-main.png" alt="${bump.name}" loading="lazy"/>
        </div>
        <div class="cd-bump-info">
          <div class="cd-bump-name">${bump.name}</div>
          <div class="cd-bump-price">${formatPrice(bump.price)}</div>
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

    updateTotals();
  }

  function updateTotals(){
    let total = 0, count = 1;
    OFFERS.bumps.forEach(b => { if(bumpsOn.has(b.id)){ total += b.price; count++; } });

    // Header badge
    const hdr = document.getElementById('hdr-count');
    if(hdr) hdr.textContent = count;

    // Drawer title count
    const dc = document.getElementById('cd-count');
    if(dc) dc.textContent = count;

    // Subtotal
    const totalEl = document.getElementById('cd-total');
    if(totalEl) totalEl.textContent = total === 0 ? '$0.00' : '₦' + total.toLocaleString('en-NG');

    // Checkout button
    const btn = document.getElementById('cd-btn');
    if(btn) btn.textContent = total === 0 ? 'Check out — FREE' : `Check out — ₦${total.toLocaleString('en-NG')}`;
  }

  function openCart(){
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
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
    // Hand off to OTO popup (oto.js decides if popup shows or goes direct)
    closeCart();
    window.OTO.trigger(cart, total);
  }

})();
