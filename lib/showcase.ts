import { z } from 'zod';
import { safeExternalUrl } from '@/lib/security/url';
import { createPublicClient } from '@/lib/supabase/public';

const MAX_COLLECTION_ITEMS = 100;
const MAX_COUNT = 1_000_000;
const ISO_LIKE_DATE = /^\d{4}-\d{2}-\d{2}(?:[Tt ][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-][0-2]\d(?::?[0-5]\d)?)?)?$/;

export type PublicShowcaseProjectStatus = 'idea' | 'planned' | 'in_progress' | 'completed' | 'archived';

export type PublicShowcase = {
  profile: { displayName: string; bio: string | null };
  stats: {
    xp: number;
    phases: { completed: number; total: number };
    courses: { completed: number; total: number };
    modules: { completed: number; total: number };
  };
  phases: Array<{ key: string; title: string; completed: number; total: number }>;
  achievements: Array<{ key: string; title: string; description: string | null; icon: string | null; earnedAt: string }>;
  projects: Array<{
    title: string;
    description: string | null;
    projectType: string | null;
    status: PublicShowcaseProjectStatus;
    tags: string[];
    githubUrl: string | null;
    demoUrl: string | null;
    coverImageUrl: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  generatedAt: string;
};

const boundedText = (maximum: number) => z.string().transform((value) => value.trim().slice(0, maximum));
const nullableBoundedText = (maximum: number) => z.string().nullable().transform((value) => value === null ? null : value.trim().slice(0, maximum));
const count = z.number().finite().int().nonnegative().transform((value) => Math.min(value, MAX_COUNT));
const isoLikeDate = z.string().max(64).regex(ISO_LIKE_DATE);

function cappedArray<T extends z.ZodTypeAny>(itemSchema: T, maximum = MAX_COLLECTION_ITEMS) {
  return z.preprocess(
    (value) => Array.isArray(value) ? value.slice(0, maximum) : value,
    z.array(itemSchema),
  );
}

const counterSchema = z.object({
  completed: count,
  total: count,
}).strip().superRefine((value, context) => {
  if (value.completed > value.total) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Completed count cannot exceed total' });
  }
});

const phaseSchema = z.object({
  key: boundedText(100),
  title: boundedText(200),
  completed: count,
  total: count,
}).strip().superRefine((value, context) => {
  if (value.completed > value.total) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Completed count cannot exceed total' });
  }
});

const achievementSchema = z.object({
  key: boundedText(100),
  title: boundedText(200),
  description: nullableBoundedText(4000),
  icon: nullableBoundedText(100),
  earned_at: isoLikeDate,
}).strip();

const projectSchema = z.object({
  title: boundedText(200),
  description: nullableBoundedText(4000),
  project_type: nullableBoundedText(100),
  status: z.enum(['idea', 'planned', 'in_progress', 'completed', 'archived']),
  tags: cappedArray(boundedText(40), 20),
  github_url: z.string().nullable().transform(safeExternalUrl),
  demo_url: z.string().nullable().transform(safeExternalUrl),
  cover_image_url: z.string().nullable().transform(safeExternalUrl),
  started_at: isoLikeDate.nullable(),
  completed_at: isoLikeDate.nullable(),
}).strip();

const publicShowcasePayloadSchema = z.object({
  profile: z.object({
    display_name: boundedText(200),
    bio: nullableBoundedText(500),
  }).strip(),
  stats: z.object({
    xp: count,
    phases: counterSchema,
    courses: counterSchema,
    modules: counterSchema,
  }).strip(),
  phases: cappedArray(phaseSchema),
  achievements: cappedArray(achievementSchema),
  projects: cappedArray(projectSchema),
  generated_at: isoLikeDate,
}).strip();

/** Converts the fixed snake_case RPC projection into the public view DTO. */
export function normalizePublicShowcase(value: unknown): PublicShowcase | null {
  const parsed = publicShowcasePayloadSchema.safeParse(value);
  if (!parsed.success) return null;

  const payload = parsed.data;
  return {
    profile: {
      displayName: payload.profile.display_name,
      bio: payload.profile.bio,
    },
    stats: {
      xp: payload.stats.xp,
      phases: {
        completed: payload.stats.phases.completed,
        total: payload.stats.phases.total,
      },
      courses: {
        completed: payload.stats.courses.completed,
        total: payload.stats.courses.total,
      },
      modules: {
        completed: payload.stats.modules.completed,
        total: payload.stats.modules.total,
      },
    },
    phases: payload.phases.map((phase) => ({
      key: phase.key,
      title: phase.title,
      completed: phase.completed,
      total: phase.total,
    })),
    achievements: payload.achievements.map((achievement) => ({
      key: achievement.key,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      earnedAt: achievement.earned_at,
    })),
    projects: payload.projects.map((project) => ({
      title: project.title,
      description: project.description,
      projectType: project.project_type,
      status: project.status,
      tags: project.tags,
      githubUrl: project.github_url,
      demoUrl: project.demo_url,
      coverImageUrl: project.cover_image_url,
      startedAt: project.started_at,
      completedAt: project.completed_at,
    })),
    generatedAt: payload.generated_at,
  };
}

export async function getPublicShowcase(): Promise<PublicShowcase | null> {
  try {
    const { data, error } = await createPublicClient().rpc('get_public_showcase');
    if (error) throw error;
    return normalizePublicShowcase(data);
  } catch {
    throw new Error('Public showcase unavailable');
  }
}
