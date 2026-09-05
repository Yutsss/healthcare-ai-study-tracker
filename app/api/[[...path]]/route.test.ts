import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const { admin, createAdminClient, isAdminConfigured } = vi.hoisted(() => {
  const listUsers = vi.fn();
  const createUser = vi.fn();
  return {
    admin: {
      auth: { admin: { listUsers, createUser } },
      from: vi.fn(),
    },
    createAdminClient: vi.fn(),
    isAdminConfigured: vi.fn(),
  };
});

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient, isAdminConfigured }));
vi.mock('@/lib/supabase/request-user', () => ({ getRequestUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/seed/importSeed', () => ({
  importSeed: vi.fn(),
  validateSeed: vi.fn(),
}));
vi.mock('@/data/yutas-lab-course-seed.json', () => ({
  default: { roadmap: [], course_units: [], modules: [] },
}));

function context(path: string): { params: Promise<{ path?: string[] }> } {
  return { params: Promise.resolve({ path: path.split('/').filter(Boolean) }) };
}

function request(path: string, init?: RequestInit) {
  return new Request(`https://app.example.com/api/${path}`, {
    ...init,
    headers: { host: 'app.example.com', ...init?.headers },
  });
}

describe('API security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClient.mockReturnValue(admin);
    isAdminConfigured.mockReturnValue(true);
    admin.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    admin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null });
    vi.stubEnv('OWNER_SETUP_TOKEN', 'a-secure-bootstrap-token-with-32-chars');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('keeps server configuration flags out of the public health response', async () => {
    const response = await GET(request('health'), context('health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ ok: true, app: "Yuta's Lab" }));
    expect(body).not.toHaveProperty('supabaseConfigured');
    expect(body).not.toHaveProperty('adminConfigured');
  });

  it('returns a generic response instead of leaking an internal admin error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    admin.auth.admin.listUsers.mockRejectedValueOnce(new Error('private database detail'));

    const response = await GET(request('auth/owner-exists'), context('auth/owner-exists'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal error' });
    expect(JSON.stringify(body)).not.toContain('private database detail');
  });

  it('keeps owner registration closed when no strong bootstrap token is configured', async () => {
    vi.stubEnv('OWNER_SETUP_TOKEN', '');

    const response = await POST(request('auth/register-owner', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'safe-password' }),
    }), context('auth/register-owner'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Registration is closed.' });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('checks bootstrap authorization before revealing server configuration state', async () => {
    isAdminConfigured.mockReturnValue(false);

    const response = await POST(request('auth/register-owner', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'safe-password' }),
    }), context('auth/register-owner'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Registration is closed.' });
  });

  it('marks a correctly authorized owner as a server-approved bootstrap account', async () => {
    const token = 'a-secure-bootstrap-token-with-32-chars';

    const response = await POST(request('auth/register-owner', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-token': token },
      body: JSON.stringify({ email: 'owner@example.com', password: 'safe-password' }),
    }), context('auth/register-owner'));

    expect(response.status).toBe(201);
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'safe-password',
      email_confirm: true,
      app_metadata: { owner_bootstrap: true },
    });
  });
});
