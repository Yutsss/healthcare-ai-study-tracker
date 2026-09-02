# Yuta's Lab — PRD & Build Log

## Product
Private, owner-only web app tracking a Data Science -> Healthcare AI learning journey
(14 phases / 58 course units / 265 modules) with gamification (XP, levels, streaks),
roadmap tracking, exercise self-report, curriculum manager, projects board, quick study log.

## Stack (confirmed by user)
- Next.js 15 App Router (replaces Vite), React 18, TypeScript (new code), Tailwind + shadcn/ui,
  TanStack Query, Recharts (later phases).
- Supabase Auth (email/password) + Supabase PostgreSQL with strict RLS (auth.uid() = owner_id) on every table.
- No MongoDB.
- Seed: data/yutas-lab-course-seed.json (schema_version 2). Progress states: not_started / learning (0.25) / exercise (0.75) / done (1).

## Env (/app/.env)
NEXT_PUBLIC_SUPABASE_URL (PENDING from user), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (set), SUPABASE_SECRET_KEY (set, server-only).

## Schema & migrations
- supabase/migrations/001_init.sql: all 16 tables, RLS policies, grants, triggers (owner_settings on signup, XP/activity on module done incl. unit +50 / phase +200 bonuses, study_log XP, exercise_report XP).
- 000_bootstrap_exec_sql.sql (optional) + scripts/apply-migrations.mjs for applying future migrations with the secret key.
- Apply path chosen by user: "Option C" -> user runs SQL in Supabase SQL Editor; seed via app (service role) idempotently.

## Phases
1. Foundation (env, schema, auth, shell) — CODE DONE, live test pending URL
2. Seed import + Roadmap — CODE DONE, live test pending
3. Continue card / self-report drawer / XP ledger UI / streak — partial (continue card, XP+streak basics done)
4. Full dashboard (week chart, heatmap, nearest achievements, sticky quick log) — TODO
5. Projects board, Quick Log, Progress page, skill tree, weekly quests — TODO
6. Curriculum Manager (CRUD/reorder/archive/restore, change log, JSON export) — TODO

## Key decisions
- Owner account creation: first-run only via POST /api/auth/register-owner (refuses if a user exists).
- Seed refresh preserves progress; rows with manually_edited=true are not overwritten; nothing is ever deleted.
- API routes accept cookie session or `Authorization: Bearer <access_token>` (for tests).
