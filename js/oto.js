// ── OTO Popup ─────────────────────────────────────────────
// Fetches config from backend. If OTO is disabled, goes straight to checkout.
// ─────────────────────────────────────────────────────────

window.OTO = (function () {
  let otoConfig = null;
  let timerInterval = null;

  // Called by cart.js instead of direct redirect
  async function trigger(cartData, cartTotal) {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();

      if (!config.otoEnabled) {
        // OTO off — go straight to checkout
        goCheckout(cartData, cartTotal, false);
        return;
      }

      otoConfig = config.oto;
      buildModal(cartData, cartTotal);
    } catch (e) {
      // If API fails, skip OTO
      goCheckout(cartData, cartTotal, false);
    }
  }

  function buildModal(cartData, cartTotal) {
    // Remove any existing
    const existing = document.getElementById('oto-modal');
    if (existing) existing.remove();

    const o = otoConfig;
    const savings = (o.originalPrice - o.salePrice).toFixed(2);

    const modal = document.createElement('div');
    modal.id = 'oto-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Special one-time offer');
    modal.innerHTML = `
      <div class="oto-overlay"></div>
      <div class="oto-box">
        <button class="oto-close" aria-label="Close">✕</button>
        <h2 class="oto-title">${o.title}</h2>
        <p class="oto-subtitle">${o.subtitle}</p>
        <div class="oto-timer-bar">
          <span>This gift vanishes in:</span>
          <span class="oto-timer-val" id="oto-time">10:00</span>
        </div>
        <div class="oto-body">
          <div class="oto-img-col">
            <div class="oto-stars">★★★★★</div>
            <img src="${o.image}" alt="${o.productName}" loading="lazy"/>
          </div>
          <div class="oto-info-col">
            <div class="oto-prod-name">${o.productName}</div>
            <p class="oto-prod-desc"><strong>${o.productDesc}</strong></p>
            <ul class="oto-features">
              ${o.features.map(f => `<li>✅ ${f}</li>`).join('')}
            </ul>
            <div class="oto-pricing">
              <span class="oto-orig">$${o.originalPrice.toFixed(2)}</span>
              <span class="oto-sale">$${o.salePrice.toFixed(2)}</span>
            </div>
            <div class="oto-savings">$${savings} Savings</div>
          </div>
        </div>
        <button class="oto-btn-accept" id="oto-accept">${o.acceptLabel}</button>
        <button class="oto-btn-decline" id="oto-decline">${o.declineLabel}</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Animate in
    requestAnimationFrame(() => modal.classList.add('oto-visible'));

    // Timer
    let secs = o.timerSeconds;
    function tick() {
      const m = Math.floor(secs / 60), s = secs % 60;
      const el = document.getElementById('oto-time');
      if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (secs <= 0) {
        clearInterval(timerInterval);
        // Auto-decline on expiry
        closeModal();
        goCheckout(cartData, cartTotal, false);
      }
      secs--;
    }
    tick();
    timerInterval = setInterval(tick, 1000);

    // Buttons
    document.getElementById('oto-accept').addEventListener('click', () => {
      clearInterval(timerInterval);
      // Add OTO item to cart data
      const otoItem = {
        id: 'oto-mystery-box',
        name: o.productName,
        price: Math.round(o.salePrice * 100), // in kobo
        isOTO: true
      };
      const updatedCart = [...cartData, otoItem];
      const updatedTotal = cartTotal + Math.round(o.salePrice * 100);
      closeModal();
      goCheckout(updatedCart, updatedTotal, true);
    });

    document.getElementById('oto-decline').addEventListener('click', () => {
      clearInterval(timerInterval);
      closeModal();
      goCheckout(cartData, cartTotal, false);
    });

    // Close X button
    modal.querySelector('.oto-close').addEventListener('click', () => {
      clearInterval(timerInterval);
      closeModal();
      goCheckout(cartData, cartTotal, false);
    });

    // Click overlay to close (decline)
    modal.querySelector('.oto-overlay').addEventListener('click', () => {
      clearInterval(timerInterval);
      closeModal();
      goCheckout(cartData, cartTotal, false);
    });
  }

  function closeModal() {
    const modal = document.getElementById('oto-modal');
    if (modal) {
      modal.classList.remove('oto-visible');
      setTimeout(() => { modal.remove(); }, 350);
    }
    document.body.style.overflow = '';
  }

  function goCheckout(cart, total, otoAccepted) {
    sessionStorage.setItem('cart', JSON.stringify(cart));
    sessionStorage.setItem('cartTotal', total);
    sessionStorage.setItem('otoAccepted', otoAccepted ? '1' : '0');
    window.location.href = 'checkout.html';
  }

  return { trigger };
})();
