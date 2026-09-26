import { createAuthMiddleware } from '@hb/auth/middleware';
import { NextResponse, type NextRequest } from 'next/server';

// docs/b2-auth.md §7: every admin page needs a session, except the sign-in pages under /login.
// Refreshes an expired access cookie (hb_admin_rt) or redirects to /login?next=… . The API still
// verifies every token (audience "admin", role, 2FA) on every call.
const requireSession = createAuthMiddleware({
  audience: 'admin',
  protectedPrefixes: ['/'],
  loginPath: '/login',
});

function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/');
}

export function middleware(req: NextRequest): Promise<NextResponse> | NextResponse {
  // The matcher already skips /login; this keeps a matcher mistake from causing a redirect loop.
  if (isLoginPath(req.nextUrl.pathname)) return NextResponse.next();
  return requireSession(req);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)'],
};
