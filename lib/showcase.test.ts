import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ rpc }),
}));

import { getPublicShowcase, normalizePublicShowcase } from './showcase';

const validPayload = {
  profile: { display_name: 'Yuta', bio: 'Healthcare AI', email: 'private@example.com' },
  stats: {
    xp: 120,
    phases: { completed: 1, total: 14 },
    courses: { completed: 2, total: 58 },
    modules: { completed: 8, total: 265 },
  },
  phases: [{ key: 'foundations', title: 'Foundations', completed: 1, total: 3 }],
  achievements: [{ key: 'first-win', title: 'First Win', description: null, icon: 'Trophy', earned_at: '2026-09-02T00:00:00.000Z' }],
  projects: [{
    title: 'Demo',
    description: 'A safe public project',
    project_type: 'Portfolio',
    status: 'completed',
    tags: ['AI'],
    github_url: 'javascript:alert(1)',
    demo_url: 'https://example.com/demo',
    cover_image_url: 'data:image/svg+xml,unsafe',
    started_at: '2026-08-01',
    completed_at: '2026-08-31',
    owner_id: 'must-not-leak',
  }],
  generated_at: '2026-09-03T00:00:00.000Z',
  study_logs: [{ notes: 'must-not-leak' }],
};

describe('normalizePublicShowcase', () => {
  beforeEach(() => rpc.mockReset());

  it('maps the fixed RPC payload, strips private fields, and sanitizes URLs', () => {
    const result = normalizePublicShowcase(validPayload);

    expect(result).toEqual({
      profile: { displayName: 'Yuta', bio: 'Healthcare AI' },
      stats: {
        xp: 120,
        phases: { completed: 1, total: 14 },
        courses: { completed: 2, total: 58 },
        modules: { completed: 8, total: 265 },
      },
      phases: [{ key: 'foundations', title: 'Foundations', completed: 1, total: 3 }],
      achievements: [{ key: 'first-win', title: 'First Win', description: null, icon: 'Trophy', earnedAt: '2026-09-02T00:00:00.000Z' }],
      projects: [{
        title: 'Demo',
        description: 'A safe public project',
        projectType: 'Portfolio',
        status: 'completed',
        tags: ['AI'],
        githubUrl: null,
        demoUrl: 'https://example.com/demo',
        coverImageUrl: null,
        startedAt: '2026-08-01',
        completedAt: '2026-08-31',
      }],
      generatedAt: '2026-09-03T00:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('private@example.com');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('returns null when publishing is disabled or counts are malformed', () => {
    expect(normalizePublicShowcase(null)).toBeNull();
    expect(normalizePublicShowcase({
      ...validPayload,
      stats: { ...validPayload.stats, xp: -1 },
    })).toBeNull();
    expect(normalizePublicShowcase({
      ...validPayload,
      stats: { ...validPayload.stats, phases: { completed: 1.5, total: 14 } },
    })).toBeNull();
  });

  it('caps public collections at 100 items', () => {
    const phases = Array.from({ length: 101 }, (_, index) => ({ key: `phase-${index}`, title: `Phase ${index}`, completed: 0, total: 1 }));
    const achievements = Array.from({ length: 101 }, (_, index) => ({ key: `achievement-${index}`, title: `Achievement ${index}`, description: null, icon: null, earned_at: '2026-09-02T00:00:00.000Z' }));
    const projects = Array.from({ length: 101 }, (_, index) => ({ ...validPayload.projects[0], title: `Project ${index}` }));

    const result = normalizePublicShowcase({ ...validPayload, phases, achievements, projects });

    expect(result?.phases).toHaveLength(100);
    expect(result?.achievements).toHaveLength(100);
    expect(result?.projects).toHaveLength(100);
  });

  it('rejects unknown project statuses', () => {
    expect(normalizePublicShowcase({
      ...validPayload,
      projects: [{ ...validPayload.projects[0], status: 'published' }],
    })).toBeNull();
  });

  it('does not expose public RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'database connection details' } });

    const error = await getPublicShowcase().catch((reason) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Public showcase unavailable');
  });
});
