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
}
