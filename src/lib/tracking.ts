/**
 * Dynamic initializer for Google Analytics and Meta Pixel.
 * If env variables are provided, it dynamically loads the scripts.
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: any;
    _fbq: any;
  }
}

export function initializeTracking() {
  if (typeof window === 'undefined') return;

  const analyticsId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
  const pixelId = import.meta.env.VITE_META_PIXEL_ID;

  // 1. Google Analytics (gtag.js)
  if (analyticsId) {
    console.log('[Tracking] Initializing Google Analytics:', analyticsId);
    
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    
    window.gtag('js', new Date());
    window.gtag('config', analyticsId);
  }

  // 2. Meta Pixel
  if (pixelId) {
    console.log('[Tracking] Initializing Meta Pixel:', pixelId);

    // Standard Meta Pixel initialization snippet
    (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        // eslint-disable-next-line prefer-spread
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) {
        s.parentNode.insertBefore(t, s);
      }
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  // 3. Microsoft Clarity
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  if (clarityId) {
    console.log('[Tracking] Initializing Microsoft Clarity:', clarityId);
    
    (function(c: any, l: Document, a: string, r: string, i: string, t?: any, y?: any) {
      c[a] = c[a] || function() {
        (c[a].q = c[a].q || []).push(arguments);
      };
      t = l.createElement(r);
      t.async = true;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      if (y && y.parentNode) {
        y.parentNode.insertBefore(t, y);
      }
    })(window, document, "clarity", "script", clarityId);
  }
}

export function trackEvent(
  eventName: 'Lead' | 'StartTriage' | 'CompleteTriage' | 'InitiateCheckout' | 'Purchase',
  params?: Record<string, any>
) {
  if (typeof window === 'undefined') return;

  // 1. Meta Pixel
  if (window.fbq) {
    try {
      if (eventName === 'Lead') {
        window.fbq('track', 'Lead', params || { content_name: 'Lista de Espera' });
      } else if (eventName === 'StartTriage') {
        window.fbq('track', 'StartTrial', params || { content_category: 'Avaliação da Residência' });
      } else if (eventName === 'CompleteTriage') {
        window.fbq('track', 'SubmitApplication', params || { content_category: 'Avaliação da Residência' });
      } else if (eventName === 'InitiateCheckout') {
        window.fbq('track', 'InitiateCheckout', {
          value: params?.value || 0,
          currency: 'BRL',
          content_name: params?.planName || 'Serviço Limpeza'
        });
      } else if (eventName === 'Purchase') {
        window.fbq('track', 'Purchase', {
          value: params?.value || 0,
          currency: 'BRL',
          content_name: params?.planName || 'Serviço Limpeza'
        });
      }
      console.log(`[Tracking] Meta Pixel event tracked: ${eventName}`, params);
    } catch (err) {
      console.error('[Tracking] Error tracking Meta Pixel event:', err);
    }
  }

  // 2. Google Analytics
  if (window.gtag) {
    try {
      if (eventName === 'Lead') {
        window.gtag('event', 'generate_lead', { method: 'Waitlist', ...params });
      } else if (eventName === 'StartTriage') {
        window.gtag('event', 'begin_triage', { step: 1, ...params });
      } else if (eventName === 'CompleteTriage') {
        window.gtag('event', 'complete_triage', params);
      } else if (eventName === 'InitiateCheckout') {
        window.gtag('event', 'begin_checkout', {
          value: params?.value || 0,
          currency: 'BRL',
          items: [{ item_name: params?.planName || 'Serviço Limpeza' }]
        });
      } else if (eventName === 'Purchase') {
        window.gtag('event', 'purchase', {
          transaction_id: params?.bookingId || Math.random().toString(36).substring(2, 9),
          value: params?.value || 0,
          currency: 'BRL',
          items: [{ item_name: params?.planName || 'Serviço Limpeza' }]
        });
      }
      console.log(`[Tracking] Google Analytics event tracked: ${eventName}`, params);
    } catch (err) {
      console.error('[Tracking] Error tracking Google Analytics event:', err);
    }
  }
}

