# Guest Demo and Public Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, read-only public showcase for the owner's progress and projects plus an isolated browser-local guest demo that cannot mutate Supabase.

**Architecture:** Keep the authenticated owner application unchanged as one data plane. Add a zero-argument, whitelisted PostgreSQL RPC for published owner data and a separate `/showcase` server page; add a `/demo` client application whose repository is a validated, versioned `localStorage` record backed by the immutable bundled curriculum seed. Public routes share presentation components but never share owner hooks or mutation clients.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript 5, Supabase/PostgreSQL RLS, TanStack Query, Zod, Tailwind/shadcn UI, Vitest, Testing Library, jsdom, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-09-03-guest-demo-showcase-design.md`

## Global Constraints

- `owner_settings.showcase_enabled` and `projects.is_public` default to `false`.
- Keep the existing single-owner trigger and owner-only RLS policies intact.
- Anonymous users receive no direct table privileges and no write-capable RPC.
- `/demo` must not import a Supabase client, call an application API, or create server records.
- Public output must omit owner ID, email, notes, study logs, activity rows, exercise reports, change history, and private settings.
- Public projects require both `is_public = true` and `status <> 'archived'`.
- Guest state uses only the exact key `yl-guest-demo:v1`; reset removes only that key.
- Guest input is length/count bounded, external URLs allow only HTTP/HTTPS, and no guest content is rendered as HTML.
- Owner pages must never be publicly cached; public errors must not expose database details.

---

## File Structure

### Create

- `vitest.config.ts` — unit/component test environment and `@/` alias.
- `tests/setup.ts` — Testing Library cleanup and DOM matchers.
- `lib/auth/public-paths.ts` — the single public-page allowlist predicate used by middleware.
- `lib/auth/public-paths.test.ts` — exact-match and prefix-boundary authorization tests.
- `supabase/migrations/006_guest_showcase.sql` — additive publication columns, public RPC, grants, and comments.
- `supabase/tests/006_guest_showcase_security.sql` — database assertions for disabled publishing, project filtering, and anon privileges.
- `lib/showcase.ts` — public DTO schemas, normalization, and safe-link filtering.
- `lib/showcase.test.ts` — whitelist and malformed-payload tests.
- `lib/supabase/public.ts` — cookie-free publishable-key server client.
- `components/public/public-shell.tsx` — shared public navigation and mode badge.
- `components/showcase/showcase-view.tsx` — read-only portfolio presentation.
- `app/showcase/page.tsx` — public server data loader with generic fallback states.
- `lib/demo/state.ts` — validated demo domain model, reducer, calculations, and storage adapter.
- `lib/demo/state.test.ts` — reducer, validation, limits, isolation, and progress tests.
- `components/demo/demo-provider.tsx` — React context that owns local demo persistence.
- `components/demo/demo-dashboard.tsx` — demo metrics and feature/lock explanation.
- `components/demo/demo-roadmap.tsx` — searchable immutable curriculum with mutable local status.
- `components/demo/demo-log.tsx` — bounded local study-log form/list.
- `components/demo/demo-projects.tsx` — bounded local project board and CRUD controls.
- `components/demo/demo-app.tsx` — demo tabs, reset confirmation, and public shell composition.
- `app/demo/page.tsx` — public demo route that passes the bundled seed to the client app.
- `tests/security/guest-boundaries.test.ts` — source-graph guard against Supabase/API imports in demo code.

### Modify

- `package.json` and `yarn.lock` — test dependencies and scripts.
- `middleware.ts` — use the tested public-page predicate.
- `lib/hooks/useProjects.ts` — include and persist `is_public`.
- `app/(app)/projects/page.tsx` — owner-facing per-project publication switch/badge.
- `app/(app)/settings/page.tsx` — global showcase opt-in, bio, preview link, and explicit warning.
- `app/login/page.tsx` — public showcase and guest demo calls to action; update private-workspace copy.

---

### Task 1: Test Harness and Exact Public Route Boundary

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `lib/auth/public-paths.test.ts`
- Create: `lib/auth/public-paths.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Produces: `isPublicPagePath(pathname: string): boolean`
- Consumes: no application interface; middleware calls the new predicate.

- [ ] **Step 1: Install and configure the test harness**

Run:

```powershell
yarn add --dev vitest@3.2.4 jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/jest-dom@6.6.3
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts` with jsdom, `tests/setup.ts`, and `@` mapped to the repository root. In `tests/setup.ts`, import `@testing-library/jest-dom/vitest` and call Testing Library `cleanup` after each test.

- [ ] **Step 2: Write the failing route-boundary test**

```ts
import { describe, expect, it } from 'vitest';
import { isPublicPagePath } from './public-paths';

describe('isPublicPagePath', () => {
  it.each(['/login', '/reset-password', '/showcase', '/showcase/project', '/demo', '/demo/roadmap'])(
    'allows %s', (path) => expect(isPublicPagePath(path)).toBe(true),
  );

  it.each(['/', '/projects', '/settings', '/showcase-private', '/demolition'])(
    'keeps %s private', (path) => expect(isPublicPagePath(path)).toBe(false),
  );
});
```

- [ ] **Step 3: Run the test and confirm RED**

Run: `yarn test lib/auth/public-paths.test.ts`

Expected: FAIL because `./public-paths` does not exist.

- [ ] **Step 4: Add the minimal predicate and wire middleware**

```ts
const PUBLIC_PAGE_ROOTS = ['/login', '/reset-password', '/showcase', '/demo'] as const;

export function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
```

Replace middleware's local `PUBLIC_PATHS` check with `isPublicPagePath(path)`. Preserve the existing API bypass, `getUser()` authorization, safe `next` handling, and security headers.

- [ ] **Step 5: Verify GREEN and commit**

Run: `yarn test lib/auth/public-paths.test.ts`

Expected: PASS with all route boundary cases.

Commit:

```powershell
git add package.json yarn.lock vitest.config.ts tests/setup.ts lib/auth/public-paths.ts lib/auth/public-paths.test.ts middleware.ts
git commit -m "test: establish public guest route boundary"
```

---

### Task 2: Opt-In Public Database Projection

**Files:**
- Create: `supabase/migrations/006_guest_showcase.sql`
- Create: `supabase/tests/006_guest_showcase_security.sql`
- Create: `tests/security/showcase-migration.test.ts`

**Interfaces:**
- Produces: `public.get_public_showcase(): jsonb`
- Produces: `owner_settings.showcase_enabled boolean`, `owner_settings.showcase_bio text`, `projects.is_public boolean`
- Consumes: existing owner tables and RLS model from migrations `001` through `005`.

- [ ] **Step 1: Write a failing source-contract test**

The test reads `006_guest_showcase.sql` and asserts that it contains default-false columns, a zero-argument `security definer` function with `set search_path = public`, explicit anon execute grant, anon table revocation, `p.is_public = true`, `p.status <> 'archived'`, and no `select *`.

```ts
const sql = readFileSync(resolve('supabase/migrations/006_guest_showcase.sql'), 'utf8').toLowerCase();
expect(sql).toContain('showcase_enabled boolean not null default false');
expect(sql).toContain('is_public boolean not null default false');
expect(sql).toContain('security definer');
expect(sql).toContain('set search_path = public');
expect(sql).toContain("p.is_public = true");
expect(sql).toContain("p.status <> 'archived'");
expect(sql).not.toMatch(/select\s+\*/);
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `yarn test tests/security/showcase-migration.test.ts`

Expected: FAIL because migration `006_guest_showcase.sql` does not exist.

- [ ] **Step 3: Add the migration**

The migration must:

```sql
alter table public.owner_settings
  add column if not exists showcase_enabled boolean not null default false,
  add column if not exists showcase_bio text;

alter table public.projects
  add column if not exists is_public boolean not null default false;
```

Define `get_public_showcase()` as `stable language sql security definer set search_path = public`. It selects the sole settings row only when `showcase_enabled = true`, aggregates XP and phase/course/module counts using owner-scoped joins, and builds the fixed payload:

```ts
type PublicShowcasePayload = {
  profile: { display_name: string; bio: string | null };
  stats: {
    xp: number;
    phases: { completed: number; total: number };
    courses: { completed: number; total: number };
    modules: { completed: number; total: number };
  };
  phases: Array<{ key: string; title: string; completed: number; total: number }>;
  achievements: Array<{ key: string; title: string; description: string | null; icon: string | null; earned_at: string }>;
  projects: Array<{ title: string; description: string | null; project_type: string | null; status: string; tags: string[]; github_url: string | null; demo_url: string | null; cover_image_url: string | null; started_at: string | null; completed_at: string | null }>;
  generated_at: string;
};
```

Return SQL `null` when no enabled settings row exists. Qualify every table and column. Filter projects with `p.owner_id = owner.owner_id and p.is_public = true and p.status <> 'archived'`. After the function exists, run `revoke all on function public.get_public_showcase() from public`, re-revoke anonymous privileges on every application table, and finally run `grant execute on function public.get_public_showcase() to anon, authenticated`.

- [ ] **Step 4: Add executable database assertions**

Create `supabase/tests/006_guest_showcase_security.sql` as a transaction that uses a fixture owner ID supplied through a psql variable, temporarily toggles publishing, calls the RPC as `anon`, verifies null-when-disabled and public-only projects, inspects `information_schema.role_table_grants` for zero anon writes, then rolls back. Every failed condition raises an exception with a specific message.

- [ ] **Step 5: Verify GREEN and commit**

Run: `yarn test tests/security/showcase-migration.test.ts`

Expected: PASS.

If a configured Supabase test database is available, also run:

```powershell
psql $env:TEST_DATABASE_URL -v owner_id=$env:TEST_OWNER_ID -f supabase/tests/006_guest_showcase_security.sql
```

Commit:

```powershell
git add supabase/migrations/006_guest_showcase.sql supabase/tests/006_guest_showcase_security.sql tests/security/showcase-migration.test.ts
git commit -m "feat: add opt-in public showcase projection"
```

---

### Task 3: Public Showcase DTO and Data Access

**Files:**
- Create: `lib/showcase.test.ts`
- Create: `lib/showcase.ts`
- Create: `lib/supabase/public.ts`

**Interfaces:**
- Produces: `PublicShowcase`, `normalizePublicShowcase(value: unknown): PublicShowcase | null`
- Produces: `getPublicShowcase(): Promise<PublicShowcase | null>`
- Consumes: `public.get_public_showcase()` and `safeExternalUrl()`.

- [ ] **Step 1: Write failing normalization tests**

Cover a valid payload, a `null` disabled response, malformed counts, oversized arrays, `javascript:` URLs, unknown project status, and an injected private field. Assert that only the fixed DTO remains and unsafe URLs become `null`.

```ts
const result = normalizePublicShowcase({
  profile: { display_name: 'Yuta', bio: 'Healthcare AI', email: 'private@example.com' },
  stats: { xp: 120, phases: { completed: 1, total: 14 }, courses: { completed: 2, total: 58 }, modules: { completed: 8, total: 265 } },
  phases: [], achievements: [],
  projects: [{ title: 'Demo', status: 'completed', tags: ['AI'], github_url: 'javascript:alert(1)' }],
  generated_at: '2026-09-03T00:00:00.000Z',
});
expect(result?.profile).toEqual({ displayName: 'Yuta', bio: 'Healthcare AI' });
expect(result?.projects[0].githubUrl).toBeNull();
expect(JSON.stringify(result)).not.toContain('private@example.com');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `yarn test lib/showcase.test.ts`

Expected: FAIL because `normalizePublicShowcase` does not exist.

- [ ] **Step 3: Implement the schema and public client**

Use Zod schemas with `.strip()`, non-negative integer counts, maximum 100 phases, 100 achievements, 100 projects, bounded text, five known project statuses, and ISO-like date strings. Map snake_case RPC properties to camelCase view properties and pass all three project URLs through `safeExternalUrl`.

`lib/supabase/public.ts` creates a server-only `@supabase/supabase-js` client from `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` with `persistSession`, `autoRefreshToken`, and `detectSessionInUrl` disabled. It must not accept cookies and must not import the admin client.

```ts
export async function getPublicShowcase(): Promise<PublicShowcase | null> {
  const { data, error } = await createPublicClient().rpc('get_public_showcase');
  if (error) throw new Error('Public showcase unavailable');
  return normalizePublicShowcase(data);
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `yarn test lib/showcase.test.ts`

Expected: PASS.

Commit:

```powershell
git add lib/showcase.ts lib/showcase.test.ts lib/supabase/public.ts
git commit -m "feat: validate public showcase payload"
```

---

### Task 4: Owner Publication Controls

**Files:**
- Create: `lib/hooks/useShowcaseSettings.ts`
- Create: `lib/hooks/useProjects.test.ts`
- Modify: `lib/hooks/useProjects.ts`
- Modify: `app/(app)/projects/page.tsx`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Produces: `ShowcaseSettings`, `useShowcaseSettings()`, `useUpdateShowcaseSettings()`
- Changes: `Project` and `ProjectInput` include `is_public: boolean`
- Produces: `cleanProjectInput(input: ProjectInput)` for deterministic validation tests.

- [ ] **Step 1: Write the failing project-input test**

```ts
it('keeps publication opt-in false unless explicitly true', () => {
  expect(cleanProjectInput({ ...validProject, is_public: false }).is_public).toBe(false);
  expect(cleanProjectInput({ ...validProject, is_public: true }).is_public).toBe(true);
});
```

Also assert URL sanitation, title requirement, tag deduplication, and existing bounds.

- [ ] **Step 2: Run test and confirm RED**

Run: `yarn test lib/hooks/useProjects.test.ts`

Expected: FAIL because the public flag and exported cleaner do not exist.

- [ ] **Step 3: Implement project opt-in and settings hooks**

Extend project reads/writes with `is_public`, set `EMPTY.is_public` to `false`, preserve it in `toInput`, and add a Switch labeled `Show in public showcase` with explanatory copy. Display a small `Public` badge on opted-in cards; archiving continues to remove them from the RPC even if the flag remains true.

`useShowcaseSettings` selects only `display_name,showcase_enabled,showcase_bio` for the authenticated user. The mutation trims bio to 500 characters and updates only `showcase_enabled` and `showcase_bio`; RLS supplies the authorization boundary.

Add a Settings card with the global Switch, bio textarea, save button, privacy warning, and `/showcase` preview link. Do not show any service-role or owner-ID configuration.

- [ ] **Step 4: Verify GREEN and owner build surface**

Run: `yarn test lib/hooks/useProjects.test.ts`

Expected: PASS.

Run: `yarn build`

Expected: exit 0 with project and settings types compiled.

- [ ] **Step 5: Commit**

```powershell
git add lib/hooks/useProjects.ts lib/hooks/useProjects.test.ts lib/hooks/useShowcaseSettings.ts 'app/(app)/projects/page.tsx' 'app/(app)/settings/page.tsx'
git commit -m "feat: add owner showcase publishing controls"
```

---

### Task 5: Browser-Local Demo Domain and Persistence

**Files:**
- Create: `lib/demo/state.test.ts`
- Create: `lib/demo/state.ts`

**Interfaces:**
- Produces: `DEMO_STORAGE_KEY = 'yl-guest-demo:v1'`
- Produces: `DemoState`, `DemoAction`, `createDemoState()`, `parseDemoState()`, `demoReducer()`, `calculateDemoStats()`, `loadDemoState()`, `saveDemoState()`, `resetDemoState()`
- Consumes: module IDs and starter project data passed in from the bundled seed.

- [ ] **Step 1: Write reducer and validation tests first**

Tests must prove:

- corrupt JSON and wrong schema version return clean state;
- unknown module statuses and unknown module IDs are removed;
- only `not_started`, `learning`, `exercise`, and `done` survive;
- logs cap at 200, projects cap at 100, title at 200 chars, notes/description at 4000 chars, tags at 20 entries of 40 chars, and minutes at 1–1440;
- unsafe URLs become `null`;
- module, log, and project actions do not mutate their input object;
- completion stats and XP recalculate deterministically;
- reset calls `removeItem('yl-guest-demo:v1')` and touches no other key.

```ts
const storage = makeStorage({ theme: 'dark', [DEMO_STORAGE_KEY]: JSON.stringify(changedState) });
resetDemoState(storage);
expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
expect(storage.getItem('theme')).toBe('dark');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `yarn test lib/demo/state.test.ts`

Expected: FAIL because the demo state module does not exist.

- [ ] **Step 3: Implement the minimal pure domain**

Use discriminated actions:

```ts
type DemoAction =
  | { type: 'module/status'; moduleId: string; status: ModuleStatus }
  | { type: 'log/add'; log: DemoLog }
  | { type: 'log/delete'; id: string }
  | { type: 'project/save'; project: DemoProject }
  | { type: 'project/status'; id: string; status: ProjectStatus }
  | { type: 'project/delete'; id: string }
  | { type: 'reset'; initial: DemoState };
```

`parseDemoState` receives the serialized value and a `Set` of allowed seed module IDs. Zod validates shape and the sanitizer enforces semantic limits. `calculateDemoStats` derives completed modules, minutes, completed projects, and XP without persisting derived values. Demo XP is exactly 20 per completed module, plus `min(30, max(1, ceil(minutes / 10)))` per study log, plus 150 per completed project; this intentionally mirrors the existing default rewards without reproducing server trigger history. Storage helpers accept a `Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>` so tests use a real in-memory implementation rather than mocks of application behavior.

- [ ] **Step 4: Verify GREEN and commit**

Run: `yarn test lib/demo/state.test.ts`

Expected: PASS.

Commit:

```powershell
git add lib/demo/state.ts lib/demo/state.test.ts
git commit -m "feat: add isolated browser demo state"
```

---

### Task 6: Public Showcase Page and Shared Public Shell

**Files:**
- Create: `components/public/public-shell.tsx`
- Create: `components/showcase/showcase-view.test.tsx`
- Create: `components/showcase/showcase-view.tsx`
- Create: `app/showcase/page.tsx`

**Interfaces:**
- Consumes: `PublicShowcase` and `getPublicShowcase()` from Task 3.
- Produces: `PublicShell({ mode, children })` and `ShowcaseView({ showcase })`.

- [ ] **Step 1: Write failing read-only UI tests**

Render a fixture and assert the read-only mode badge, aggregate progress, achievement, and public project are visible. Assert private-field strings and edit/delete/save controls are absent. Test safe external links use `target="_blank"` and `rel="noopener noreferrer"`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `yarn test components/showcase/showcase-view.test.tsx`

Expected: FAIL because the showcase components do not exist.

- [ ] **Step 3: Implement shell, view, and server page**

`PublicShell` provides the brand, `Showcase`, `Try demo`, and `Owner sign in` links plus one persistent badge based on `mode: 'showcase' | 'demo'`. `ShowcaseView` renders only normalized DTO fields and uses `levelFromXp(showcase.stats.xp)`.

`app/showcase/page.tsx` checks `isSupabaseConfigured()`, calls `getPublicShowcase()` in a try/catch, and renders one of three generic states: unavailable configuration, not published, or temporarily unavailable. It must not create an owner cookie client or expose caught error messages.

- [ ] **Step 4: Verify GREEN and commit**

Run: `yarn test components/showcase/showcase-view.test.tsx`

Expected: PASS.

Commit:

```powershell
git add components/public/public-shell.tsx components/showcase/showcase-view.tsx components/showcase/showcase-view.test.tsx app/showcase/page.tsx
git commit -m "feat: add read-only public showcase"
```

---

### Task 7: Interactive Guest Demo UI

**Files:**
- Create: `components/demo/demo-provider.test.tsx`
- Create: `components/demo/demo-provider.tsx`
- Create: `components/demo/demo-dashboard.tsx`
- Create: `components/demo/demo-roadmap.tsx`
- Create: `components/demo/demo-log.tsx`
- Create: `components/demo/demo-projects.tsx`
- Create: `components/demo/demo-app.tsx`
- Create: `app/demo/page.tsx`

**Interfaces:**
- Consumes: Task 5 demo state functions and bundled seed fields `roadmap`, `course_units`, `modules`, `starter_projects`.
- Produces: `DemoProvider`, `useDemo()`, `DemoApp`.

- [ ] **Step 1: Write failing persistence/component tests**

Use jsdom's real `localStorage`. Assert initial rendering, local module status change, reload hydration, adding/deleting a log, project CRUD/status changes, reset confirmation, locked curriculum/settings labels, and the `Your private demo` badge. Assert showcase metrics never appear in demo cards.

- [ ] **Step 2: Run tests and confirm RED**

Run: `yarn test components/demo/demo-provider.test.tsx`

Expected: FAIL because demo components do not exist.

- [ ] **Step 3: Implement provider and focused panels**

`DemoProvider` hydrates once after mount, dispatches through `demoReducer`, and persists after hydration. It catches storage exceptions and exposes a generic `storageWarning`. It accepts seed-derived module IDs and starter projects as props; it never imports Supabase.

`DemoRoadmap` searches phase, course, and module titles and changes only module status overrides. `DemoLog` enforces 1–1440 minutes and bounded text before dispatch. `DemoProjects` supports create/edit/status/archive/delete with the same bounded sanitizer used by state parsing. `DemoDashboard` derives metrics with `calculateDemoStats` and explains which controls are local versus locked.

`DemoApp` uses Tabs for Dashboard, Roadmap, Study Log, Projects, and Progress; Progress may reuse the dashboard's derived metric cards but must remain demo-labelled. Reset uses `AlertDialog` and calls only `resetDemoState` plus the reducer reset action.

`app/demo/page.tsx` imports the JSON seed on the server, maps its exact fields into serializable demo seed props, and renders `DemoApp`. Do not pass source-catalog or verification metadata that the UI does not need.

- [ ] **Step 4: Verify GREEN and commit**

Run: `yarn test components/demo/demo-provider.test.tsx lib/demo/state.test.ts`

Expected: PASS.

Commit:

```powershell
git add components/demo app/demo
git commit -m "feat: add interactive local guest demo"
```

---

### Task 8: Login Entry Points and Static Security Guard

**Files:**
- Create: `tests/security/guest-boundaries.test.ts`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: public routes `/showcase` and `/demo`.
- Produces: regression guard over `app/demo`, `components/demo`, and `lib/demo` source files.

- [ ] **Step 1: Write the failing source-graph test**

Recursively read `.ts` and `.tsx` files in the three demo directories and reject imports or calls matching:

```ts
expect(source).not.toMatch(/@\/lib\/supabase|createAdminClient|createClient\(\)|\.from\(|\.rpc\(|fetch\(\s*['"]\/api\//);
expect(source).not.toMatch(/dangerouslySetInnerHTML/);
```

Before the login edit, add a component/source assertion requiring links to both `/showcase` and `/demo`; this is the expected RED condition.

- [ ] **Step 2: Run test and confirm RED**

Run: `yarn test tests/security/guest-boundaries.test.ts`

Expected: FAIL because the login page lacks both public entry links.

- [ ] **Step 3: Add login calls to action**

Add `View Yuta's progress` and `Try guest demo` links below the owner sign-in form. Change copy from implying the whole site is private to explaining that the tracker is private while the showcase is intentionally published. Do not alter account creation, password reset, generic login errors, or redirect safety.

- [ ] **Step 4: Verify GREEN and commit**

Run: `yarn test tests/security/guest-boundaries.test.ts`

Expected: PASS and every demo source file remains free of server mutation paths.

Commit:

```powershell
git add tests/security/guest-boundaries.test.ts app/login/page.tsx
git commit -m "feat: expose safe guest entry points"
```

---

### Task 9: Full Verification and Deployment Handoff

**Files:**
- Modify only files required to fix verification failures; every behavior fix starts with a failing regression test.

**Interfaces:**
- Consumes all earlier tasks.
- Produces a verified migration/runbook handoff, not a new runtime interface.

- [ ] **Step 1: Run the complete automated suite**

Run: `yarn test`

Expected: all tests pass with zero unhandled errors or warnings.

- [ ] **Step 2: Run production compilation**

Run: `yarn build`

Expected: exit 0 and routes `/showcase` and `/demo` appear in the build output.

- [ ] **Step 3: Check formatting and accidental secrets**

Run:

```powershell
git diff --check
rg -n "SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|owner_id|private@example.com" app/showcase app/demo components/showcase components/demo lib/showcase.ts lib/demo
```

Expected: `git diff --check` exits 0; the search finds no embedded secret key, owner ID, fixture email, or public DTO owner identifier.

- [ ] **Step 4: Apply and verify the database migration**

Apply `supabase/migrations/006_guest_showcase.sql` using the project's existing migration process. On a non-production Supabase test project, run `supabase/tests/006_guest_showcase_security.sql` with a fixture owner. Confirm direct anonymous table reads/writes fail while `rpc('get_public_showcase')` returns null until publishing is enabled.

- [ ] **Step 5: Run unauthenticated browser verification**

Start the app with `yarn dev`. In a clean browser context:

1. Open `/showcase`; confirm it loads without login and shows the disabled state before opt-in.
2. Open `/demo`; change a module, add a log and project, reload, and confirm only demo metrics change.
3. Reset the demo and confirm the local changes disappear.
4. Open `/settings`, `/projects`, `/curriculum`, and `/api/seed/status`; confirm page routes redirect to login and the API returns 401.
5. Sign in as owner, enable the showcase and one project, then sign out.
6. Confirm the public showcase shows aggregate progress and only the opted-in project, with no edit controls or private fields.
7. Disable the showcase and confirm the public payload becomes unavailable again.

- [ ] **Step 6: Inspect final scope and commit verification fixes**

Run: `git status --short` and `git diff --stat HEAD~8..HEAD`.

Confirm every acceptance criterion in the spec maps to passing evidence above and no unrelated files changed. Commit any test-led verification fixes with a focused message; do not commit `.env`, credentials, build output, or browser artifacts.
