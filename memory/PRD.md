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
3. Continue card / self-report drawer / XP+streak basics — DONE (self-report drawer added: +15 XP, optional status change, previous reports)
4. Full dashboard (week chart, heatmap, nearest achievements, sticky quick log, milestone badges) — DONE
5. Quick Log (widget + /log page + weekly goal) DONE; Progress page (achievements, confidence trends, XP chart) DONE; Projects board, skill tree, weekly quests — TODO
6. Curriculum Manager (CRUD/reorder/archive/restore, change log, JSON export) — TODO

## Key decisions
- Owner account creation: first-run only via POST /api/auth/register-owner (refuses if a user exists).
- Seed refresh preserves progress; rows with manually_edited=true are not overwritten; nothing is ever deleted.
- API routes accept cookie session or `Authorization: Bearer <access_token>` (for tests).

## Ops notes
- package.json dev script heap raised to 1536MB (Next dev restarted itself at 512MB mid-compile -> blank page after login).
- scripts/: check-db.mjs, seed-cli.mjs <email> <pw> preview|import, xp-check.mjs, progress-dump.mjs, reset-progress.mjs (wipes progress/XP/activity/reports/logs), apply-migrations.mjs.

## Gamification v2 (session 3)
- Achievements defined in code (lib/achievements.ts, 20 defs), synced to achievement_definitions per owner; unlocked client-side -> earned_achievements insert -> trigger awards xp_reward (003).
- Milestone->phase mapping in lib/seed/milestoneMap.ts, written to milestone_roadmap_items on seed import.
- Study logs: 1 XP/10min (max 30); delete removes XP/activity. Weekly goal in owner_settings.weekly_goal_minutes (default 300), week starts Monday.

## Security hardening (session 4)
- Migration 004: single-owner trigger on auth.users (blocks 2nd user & anon signUp), re-revoke anon/public on all tables, hide schema_migrations.
- API: no-store headers, same-origin CSRF check on all POST, register-owner rate-limit (5/hr/IP) + optional OWNER_SETUP_TOKEN + generic errors; seed/import 30/min.
- Open-redirect fixed via lib/security/redirect.safeNextPath (login + middleware). External links sanitized to http(s) via lib/security/url.safeExternalUrl (seed import + phase-card + dashboard).
- Security headers in next.config.js + middleware (nosniff, referrer-policy, permissions-policy). Framing left permissive for preview iframe.
- Password reset: login 'Forgot password?' -> resetPasswordForEmail -> /reset-password page (updateUser). MANUAL: add {origin}/reset-password to Supabase Auth Redirect URLs.
- .env now gitignored; .env.example added. Deps updated: next 15.5.25, postcss 8.5.26, nanoid/browserslist/postcss-selector-parser -> 0 vulns.
- admin client throws if constructed in browser.
