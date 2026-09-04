import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPagePath } from '@/lib/auth/public-paths';

// Baseline security headers applied to every response.
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  return res;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // API routes do their own auth checks; static assets are excluded via matcher.
  if (path.startsWith('/api')) return withSecurityHeaders(NextResponse.next({ request }));

  // Not configured yet -> let pages render the setup notice.
  if (!url || !key) return withSecurityHeaders(NextResponse.next({ request }));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not replace with getSession() for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPagePath(path);

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    // Only pass through a safe, in-app path (defence against open-redirect seeding).
    redirectUrl.search = '';
    if (/^\/[^/\\]/.test(path)) redirectUrl.searchParams.set('next', path);
    return withSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (user && (path === '/login' || path === '/reset-password')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    // Allow the recovery session to land on /reset-password when it carries auth params.
    if (path === '/reset-password' && (request.nextUrl.searchParams.has('code') || request.nextUrl.hash)) {
      return withSecurityHeaders(response);
    }
    if (path === '/login') return withSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  return withSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
