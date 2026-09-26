import type { NextConfig } from 'next';

// Baseline security headers (security.md §9). The nonce-based CSP lands in P11 (see docs/frontend-plan.md C6).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@hb/ui', '@hb/sdk', '@hb/types', '@hb/auth'],
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: { optimizePackageImports: ['lucide-react', '@hb/ui'] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
