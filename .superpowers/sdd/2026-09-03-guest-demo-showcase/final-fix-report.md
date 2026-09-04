# Final review Important-finding fix report

## Scope and commit

- Worktree: `C:\POST_ITS_BISA\Coursera\Plan\healthcare-ai-study-tracker\.worktrees\guest-demo-showcase`
- Branch: `feature/guest-demo-showcase`
- Implementation commit: `334615b6171eec72c7a5747152a67ec6cedccece` (`fix(settings): guard showcase publication state`)
- Scope was limited to the final review's one Important settings finding. The deferred Minor findings were not changed, and the controller ledger was not edited.

## Changed files

- `app/(app)/settings/page.tsx`
  - Gates the switch, bio, and save button on a successfully loaded, non-null settings row.
  - Adds explicit loading, generic query-error/retry, and missing-row states.
  - Prevents the save handler from running without a loaded row and keeps save failures generic.
- `lib/hooks/useShowcaseSettings.ts`
  - Changes the owner update to request the updated settings row with `.select(...).single()`.
  - Rejects database errors or an absent returned row instead of reporting success.
- `app/(app)/settings/page.test.tsx`
  - Renders the real settings page for loading, query error/retry, missing-row, and loaded/edit/save behavior.
- `lib/hooks/useShowcaseSettings.test.tsx`
  - Renders the real mutation hook against a mocked external Supabase boundary and proves a zero-row update rejects after the returned-row chain.
- `.superpowers/sdd/2026-09-03-guest-demo-showcase/final-fix-report.md`
  - Records this evidence and handoff.

## Strict TDD evidence

The first attempted focused invocation used the literal parenthesized route path; Windows `.cmd` parsing rejected the argument before Vitest ran, so it is intentionally not counted as RED evidence.

### RED

Command:

`node_modules\.bin\vitest.cmd run page.test.tsx useShowcaseSettings.test.tsx --reporter=verbose`

Result: exit `1`; 2 test files failed and 1 passed; 4 tests failed and 6 passed.

Defect-specific failures:

- Loading: no accessible `status` was rendered.
- Query error/retry: no accessible generic `alert` was rendered.
- Missing row: no unavailable-state `alert` was rendered and fallback controls remained editable.
- Mutation: the zero-row update promise resolved with `{ showcase_enabled: true, showcase_bio: 'Public bio' }` instead of rejecting.

The loaded/edit/save rendered test already passed during RED, isolating the unsafe unavailable-state and update-response behavior rather than breaking the established success path.

### GREEN

Command:

`node_modules\.bin\vitest.cmd run page.test.tsx useShowcaseSettings.test.tsx --reporter=verbose`

Result: exit `0`; 3 test files passed, 10 tests passed. This includes all four settings-page scenarios, the focused zero-row mutation rejection, and the filename filter's existing five login-page tests.

## Full verification evidence

| Command | Result |
|---|---|
| `node_modules\.bin\vitest.cmd run` | PASS — exit `0`; 9 files, 60 tests. |
| `node_modules\.bin\tsc.cmd --noEmit` | PASS — exit `0`; no diagnostics. |
| `node_modules\.bin\next.cmd build` | PASS — exit `0`; compiled, type-checked, generated 7/7 static pages, and emitted the `/settings` route. |
| `git diff --check` | PASS — exit `0`; only line-ending conversion notices were printed. |

## Self-review

- React hooks: the editability gate is derived from the current query result, so it adds no effects, subscriptions, or dependency-array risk. The existing effect only copies values from a real settings row; unavailable states remain disabled even if local state contains an older value.
- Accessibility: loading uses `role="status"`; error and missing-row states use `role="alert"`; retry buttons have an explicit accessible name; existing labels remain associated with the switch and textarea; native disabled state covers every publication input and the save action.
- Data safety: the save handler repeats the loaded-row guard, mutation-pending state locks edits, field normalization/bounds are unchanged, authentication and owner filter are unchanged, and `.single()` converts zero-row/RLS-filtered updates into failure.
- Error safety: neither the query error UI nor the mutation toast renders backend error details.
- Test quality: rendered tests assert user-visible state and interaction; the hook test mocks only the external Supabase client boundary and asserts its returned-row contract. No source-regex assertions were added.
- Scope: no deferred Minor finding or unrelated file was changed.

## Concerns

- The Supabase mutation test uses a controlled client boundary; live RLS/database verification still requires the separately documented disposable non-production database environment.
- Next.js continues to emit the pre-existing non-blocking multiple-lockfile/workspace-root warning during build. No new build warning was introduced.
