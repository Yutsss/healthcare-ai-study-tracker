import { NextResponse } from 'next/server';

// --- In-memory fixed-window rate limiter (single-instance app) --------------
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateResult = { allowed: boolean; remaining: number; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { allowed: true, remaining: limit - b.count, retryAfter: 0 };
}

// Best-effort periodic cleanup so the map cannot grow unbounded.
if (typeof globalThis !== 'undefined' && !(globalThis as any).__ratelimitSweep) {
  (globalThis as any).__ratelimitSweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }, 60_000);
  (globalThis as any).__ratelimitSweep?.unref?.();
}

export function clientKey(request: Request, scope: string): string {
  const xff = request.headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}

/**
 * CSRF defence for cookie-authenticated mutating requests: the Origin (or Referer)
 * host must match the request host. Requests with no Origin/Referer (server-to-server,
 * curl, tests using Bearer) are allowed and rely on their own auth.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get('host');
  if (!host) return false;
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const source = origin || referer;
  if (!source) return true; // no browser-driven cross-site context
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please wait and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
  );
}
