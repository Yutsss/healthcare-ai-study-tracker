import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { getRequestUser } from '@/lib/supabase/request-user';
import { importSeed, validateSeed, type SeedFile } from '@/lib/seed/importSeed';
import { clientKey, isSameOrigin, rateLimit, tooManyRequests } from '@/lib/security/ratelimit';
import bundledSeed from '@/data/yutas-lab-course-seed.json';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

function json(data: unknown, status = 200) {
  // Private API responses must never be cached by browsers/CDNs.
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function resolvePath(ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return '/' + path.join('/');
}

async function ownerExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(error.message);
  return (data?.users?.length ?? 0) > 0;
}

function hasValidSetupToken(request: Request): boolean {
  const expected = process.env.OWNER_SETUP_TOKEN || '';
  const provided = request.headers.get('x-setup-token') || '';
  if (expected.length < 32 || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function internalError(path: string, error: unknown) {
  console.error('API request failed', {
    path,
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  return json({ error: 'Internal error' }, 500);
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: Request, ctx: Ctx) {
  const path = await resolvePath(ctx);
  try {
    if (path === '/' || path === '/health') {
      return json({
        ok: true,
        app: "Yuta's Lab",
        time: new Date().toISOString(),
      });
    }

    if (path === '/auth/owner-exists') {
      if (!isAdminConfigured()) return json({ exists: false, configured: false });
      return json({ exists: await ownerExists(), configured: true });
    }

    if (path === '/seed/preview') {
      const user = await getRequestUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const admin = createAdminClient();
      const result = await importSeed(admin, user.id, bundledSeed as unknown as SeedFile, { dryRun: true });
      return json({ ...result, seedMeta: (bundledSeed as any).metadata ?? null, product: (bundledSeed as any).product ?? null });
    }

    if (path === '/seed/status') {
      const user = await getRequestUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const admin = createAdminClient();
      const tables = ['roadmap_items', 'course_units', 'modules', 'module_progress', 'milestones', 'projects', 'xp_events'];
      const counts: Record<string, number> = {};
      for (const t of tables) {
        const { count, error } = await admin.from(t).select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
        if (error) throw new Error(`${t}: ${error.message}`);
        counts[t] = count ?? 0;
      }
      return json({ ownerId: user.id, counts });
    }

    return json({ error: `Not found: ${path}` }, 404);
  } catch (error: unknown) {
    return internalError(path, error);
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(request: Request, ctx: Ctx) {
  const path = await resolvePath(ctx);
  try {
    // CSRF: reject cross-site browser POSTs to mutating endpoints.
    if (!isSameOrigin(request)) return json({ error: 'Cross-origin request rejected' }, 403);

    // First-run only: create the single owner account. Refuses if any user exists.
    if (path === '/auth/register-owner') {
      // Throttle to blunt automated first-run claim / abuse.
      const rl = rateLimit(clientKey(request, 'register'), 5, 60 * 60 * 1000);
      if (!rl.allowed) return tooManyRequests(rl.retryAfter);

      // A strong server-configured token is mandatory for the one-time bootstrap.
      if (!hasValidSetupToken(request)) {
        return json({ error: 'Registration is closed.' }, 403);
      }
      if (!isAdminConfigured()) return json({ error: 'Owner setup is unavailable.' }, 503);

      const body = await request.json().catch(() => ({}));
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Valid email required' }, 400);
      if (password.length < 8 || password.length > 128) return json({ error: 'Password must be 8-128 characters' }, 400);
      // A DB trigger also enforces single-owner; this is the friendly path.
      if (await ownerExists()) return json({ error: 'Registration is closed.' }, 403);

      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { owner_bootstrap: true },
      });
      if (error) return json({ error: 'Could not create the owner account.' }, 400);
      return json({ ok: true, userId: data.user?.id }, 201);
    }

    if (path === '/seed/import') {
      const user = await getRequestUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const rl = rateLimit(clientKey(request, 'import'), 30, 60 * 1000);
      if (!rl.allowed) return tooManyRequests(rl.retryAfter);
      const body = await request.json().catch(() => ({}));
      let seed: SeedFile = bundledSeed as unknown as SeedFile;
      if (body && body.seed) {
        validateSeed(body.seed);
        seed = body.seed as SeedFile;
      }
      const admin = createAdminClient();
      const result = await importSeed(admin, user.id, seed, { dryRun: Boolean(body?.dryRun) });
      return json(result);
    }

    return json({ error: `Not found: ${path}` }, 404);
  } catch (error: unknown) {
    return internalError(path, error);
  }
}
