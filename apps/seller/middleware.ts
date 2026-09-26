import { createAuthMiddleware } from '@hb/auth/middleware';

// docs/b2-auth.md §7: /dashboard* and /security* need a session. Refreshes an expired access
// cookie (hb_seller_rt) or redirects to /login?next=… . The API still verifies every token.
export const middleware = createAuthMiddleware({
  audience: 'seller',
  protectedPrefixes: ['/dashboard', '/security'],
  loginPath: '/login',
});

export const config = { matcher: ['/dashboard/:path*', '/security/:path*'] };
