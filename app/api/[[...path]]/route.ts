import { NextResponse } from 'next/server';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { getRequestUser } from '@/lib/supabase/request-user';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { importSeed, validateSeed, type SeedFile } from '@/lib/seed/importSeed';
import bundledSeed from '@/data/yutas-lab-course-seed.json';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
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
        supabaseConfigured: isSupabaseConfigured(),
        adminConfigured: isAdminConfigured(),
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
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(request: Request, ctx: Ctx) {
  const path = await resolvePath(ctx);
  try {
    // First-run only: create the single owner account. Refuses if any user exists.
    if (path === '/auth/register-owner') {
      if (!isAdminConfigured()) return json({ error: 'Supabase is not configured on the server' }, 503);
      const body = await request.json().catch(() => ({}));
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Valid email required' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
      if (await ownerExists()) return json({ error: 'An owner account already exists. Please sign in.' }, 403);

      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, userId: data.user?.id }, 201);
    }

    if (path === '/seed/import') {
      const user = await getRequestUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
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
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
}
