import { createAuthMiddleware } from '@hb/auth/middleware';

// docs/b2-auth.md §7: /account* needs a session. Refreshes an expired access cookie (hb_web_rt)
// or redirects to /login?next=… . The API still verifies every token.
export const middleware = createAuthMiddleware({
  audience: 'web',
  protectedPrefixes: ['/account'],
  loginPath: '/login',
});

export const config = { matcher: ['/account/:path*'] };
