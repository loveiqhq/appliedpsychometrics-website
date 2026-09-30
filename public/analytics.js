// Google Analytics 4 and PostHog, started only once the visitor has accepted analytics cookies
// in the CookieYes banner, just now or on an earlier visit. CookieYes reports the choice through
// its documented events; its own script blocking only handles tags added after it has loaded,
// which never includes a static page's tags. Withdrawing consent reloads the page without them.
(function (w, d) {
  var started = false;

  function start() {
    started = true;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      w.dataLayer.push(arguments);
    };
    // Runs only with consent to analytics, and the site has no ads: say so before anything else.
    w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    w.gtag('js', new Date());
    w.gtag('config', 'G-9WSTCKKBYQ', { allow_google_signals: false, allow_ad_personalization_signals: false });
    load('https://www.googletagmanager.com/gtag/js?id=G-9WSTCKKBYQ');
    // PostHog EU, set up as on LoveIQ. It talks to PostHog directly because LoveIQ's
    // same-domain relay needs Next.js: here Vercel's trailing-slash redirect would bounce
    // every capture request, which ends in a slash.
    load('https://eu-assets.i.posthog.com/static/array.js', function () {
      w.posthog.init('phc_ogCDyxQnZsX2zGg57oNSJCBSuXAbzauJvrFCkqoDPBgJ', {
        api_host: 'https://eu.i.posthog.com',
        defaults: '2026-01-30',
        capture_exceptions: true,
        disable_surveys: true,
        // The site has no subdomains; without this PostHog probes for its cookie domain by
        // setting a cookie on .org, which Firefox rejects with a console error.
        cross_subdomain_cookie: false,
      });
    });
  }

  function load(src, onload) {
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    if (onload) s.onload = onload;
    d.head.appendChild(s);
  }

  function check() {
    var consent = typeof w.getCkyConsent === 'function' && w.getCkyConsent();
    var accepted = !!(consent && consent.categories && consent.categories.analytics);
    if (accepted && !started) start();
    else if (!accepted && started) w.location.reload();
  }

  d.addEventListener('cookieyes_banner_load', check);
  d.addEventListener('cookieyes_consent_update', check);
})(window, document);
