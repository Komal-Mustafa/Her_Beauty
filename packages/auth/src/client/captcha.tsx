'use client';

import Script from 'next/script';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile, shown only after the API asks for it (details.captchaRequired, set per IP
 * after repeated failures). The widget adds a `cf-turnstile-response` field that @hb/auth
 * forwards as `captchaToken`. Without a site key (dev/test) nothing renders.
 */
export function Captcha({ show }: { show: boolean }) {
  if (!show || !SITE_KEY) return null;
  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="cf-turnstile" data-sitekey={SITE_KEY} data-theme="light" />
    </div>
  );
}
