/**
 * analytics-tracker.js
 * Silently fires events to our backend analytics store.
 * Also fires corresponding Facebook Pixel events.
 */
(function(){
  window.TC = window.TC || {};

  // Track event to our backend
  function track(event, data) {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data: data || {} })
    }).catch(() => {});
  }

  // Track Facebook Pixel event
  function pixel(event, data) {
    if (typeof fbq !== 'undefined') {
      fbq('track', event, data || {});
    }
  }

  window.TC.track = track;
  window.TC.pixel = pixel;

  // Expose combined tracker
  window.TC.event = function(analyticsEvent, pixelEvent, data) {
    track(analyticsEvent, data);
    if (pixelEvent) pixel(pixelEvent, data);
  };
})();
