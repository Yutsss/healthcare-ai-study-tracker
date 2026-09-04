# Guest Demo and Public Showcase Design

## Objective

Add a public guest experience to Yuta's Lab without weakening its single-owner security model. Visitors can inspect a deliberately published, read-only view of the owner's progress and portfolio projects, then try selected tracking interactions in a browser-local demo whose data never reaches Supabase.

## Selected Approach

The application will expose two visibly distinct public areas:

- `/showcase` is the owner's published portfolio. It reads a narrow, server-defined public projection of owner data and never offers mutations.
- `/demo` is an interactive sandbox. It starts from the bundled curriculum seed and stores all guest changes under a versioned browser-storage key. It never authenticates a guest and never imports the Supabase browser client.

This creates two independent data planes. Owner pages continue to use authenticated Supabase queries and strict owner-only RLS. Showcase reads use a purpose-built, zero-argument database RPC with an explicit return shape. Demo reads and writes use only a local adapter.

## Alternatives Considered

### Shared guest Supabase account

A shared account would be quick to add but would expose credentials, let visitors overwrite each other's state, complicate abuse control, and weaken the existing one-owner invariant. This approach is rejected.

### Anonymous Supabase users per visitor

Anonymous accounts would provide server persistence but conflict with the database trigger that caps `auth.users` at one owner. They would also create account cleanup, quota, RLS, and abuse concerns that are unnecessary for a demo. This approach is rejected.

### Browser-local demo plus explicit public projection (selected)

This option preserves the current authentication boundary, gives every browser an independent sandbox, requires no guest identity lifecycle, and minimizes the public database surface. Its accepted limitation is that demo state does not follow a visitor to another browser or device.

## Authorization Boundaries

The middleware will recognize only `/login`, `/reset-password`, `/showcase`, and `/demo` as public page roots. Existing `/api` routes retain their own authorization checks.

The existing owner application under `app/(app)` remains authenticated. No owner hook will gain a guest bypass, and no guest component will call owner mutations. Hiding controls is only a usability measure; the actual boundary is that demo code has no Supabase data path and public database roles have no write grants.

The single-owner registration trigger remains unchanged. There is no guest password, shared session, anonymous auth user, or client-visible service-role key.

## Public Publishing Model

Publishing is opt-in at two levels:

- `owner_settings.showcase_enabled` defaults to `false`. Until enabled, the public RPC returns no showcase payload.
- `projects.is_public` defaults to `false`. Only explicitly published, non-archived projects appear publicly.

The owner settings page will offer a showcase enable/disable control and an optional public bio. The project editor will offer a `Show in public showcase` control. New and existing projects remain private until the owner selects it.

The public RPC will be a `SECURITY DEFINER`, zero-argument PostgreSQL function with a fixed `search_path`, explicit schema-qualified table references, and a fixed JSON construction. Execution is granted to `anon` and `authenticated`; direct anonymous table access remains revoked. The function exposes only:

- display name and public bio;
- aggregate XP and level inputs;
- total and completed phases, courses, and modules;
- per-phase title and aggregate completion counts;
- earned achievement key, title, description, icon, and earned date;
- explicitly public project title, description, type, status, tags, GitHub URL, demo URL, cover image URL, and completion dates;
- a generated timestamp.

It does not expose owner ID, email, study-log rows, activity events, exercise reports, notes, settings, change history, private project rows, or raw module-progress rows.

The showcase page renders all text as React text nodes. Every returned external URL is passed through the existing HTTP/HTTPS URL allowlist before becoming a link or image source. Failure, disabled-publishing, and unconfigured-Supabase states use generic public messages and never reveal database errors or configuration details.

## Guest Demo Capabilities

The first demo release will allow visitors to:

- browse and search the bundled roadmap, courses, and modules;
- change demo module statuses;
- add and remove demo study-log entries;
- create, edit, move, archive, and delete demo projects;
- see demo progress and XP recalculate from their local actions;
- reset the sandbox to its initial state.

The demo will not allow visitors to:

- add, edit, reorder, archive, import, or delete curriculum structure;
- change owner settings or account credentials;
- publish projects to the real showcase;
- view private owner records;
- upload files, invoke privileged APIs, or persist data to the server.

Locked navigation items remain visible where useful, with a lock label explaining that curriculum administration and account settings are owner-only. This demonstrates the product boundary without presenting a control that merely fails after submission.

## Demo Storage and Validation

Guest state uses a single versioned key, `yl-guest-demo:v1`, in `localStorage`. The state contains only module status overrides, demo logs, demo projects, and a schema version. Curriculum structure is always loaded from the checked-in seed rather than copied into mutable storage.

On load, the adapter validates the stored shape, applies length and count limits, rejects unknown status values, and falls back to clean demo state if parsing fails. Writes catch quota and availability errors and show a non-sensitive warning. Reset removes only the exact guest-demo key. Theme and sound preferences keep their existing separate keys.

Demo identifiers are generated in the browser. User-entered strings are trimmed and length-limited, tags are bounded, log minutes are bounded, and external links use the existing safe URL validator. No guest content is interpreted as HTML.

## User Experience

The login page will gain two secondary calls to action: `View Yuta's progress` and `Try the guest demo`. Public pages use a dedicated guest shell with a persistent mode badge:

- `Yuta's showcase · Read only` on `/showcase`;
- `Your private demo · Stored in this browser` on `/demo`.

Each public area links to the other, but their cards and headings never combine owner and demo metrics. The showcase contains no edit affordances. The demo includes a reset action with confirmation and a clear note that browser clearing removes its data.

## Data Flow

### Showcase

1. An unauthenticated request reaches `/showcase` through the public middleware allowlist.
2. Server-side code calls the public Supabase RPC using only the publishable key.
3. PostgreSQL constructs the whitelisted payload if publishing is enabled.
4. The server validates and normalizes the payload before rendering the read-only page.
5. No public request receives an owner session or write capability.

### Demo

1. An unauthenticated request reaches `/demo` through the public middleware allowlist.
2. The page loads immutable curriculum content from the bundled seed.
3. A client adapter loads validated overrides from `yl-guest-demo:v1`.
4. Demo actions update React state and that exact storage entry.
5. No demo action calls Supabase or a mutating application endpoint.

## Security Controls

- Preserve owner-only RLS and anonymous table revocations.
- Keep the existing one-owner database trigger.
- Require explicit owner opt-in globally and per project.
- Use a narrowly scoped RPC instead of the service-role client for public reads.
- Use no guest authentication or shared credentials.
- Keep demo writes entirely browser-local.
- Validate persisted local data and public RPC output as untrusted input.
- Sanitize all external URLs and render no raw HTML.
- Return generic errors to public visitors.
- Add restrictive response headers already applied by middleware; extend the Content Security Policy only if the current application configuration supports it without breaking existing assets.
- Ensure cache behavior never stores authenticated owner pages as public content. Public showcase caching, if added, must vary only on published content and have a bounded revalidation interval.

## Testing Strategy

Implementation follows red-green-refactor. Pure tests will cover demo-state validation, limits, reset behavior, progress calculation, URL filtering, and public-payload normalization. Authorization tests will verify public path classification, private-route redirects, disabled showcase behavior, public project filtering, and the absence of private fields from the RPC contract.

Component tests will cover the mode labels, locked controls, opt-in switches, owner/demo separation, and demo persistence. A production build and an end-to-end browser pass will verify that an unauthenticated visitor can open both public pages, mutate only local demo state, reload it, reset it, and still cannot open owner routes or call owner-only APIs.

The database migration will include SQL assertions or documented verification queries confirming that `anon` cannot select or mutate application tables, can execute only the public showcase function, sees no data while publishing is disabled, and sees only projects marked public after publishing is enabled.

## Rollout and Recovery

The migration is additive: new publication columns and one RPC. Both visibility flags default to `false`, so deployment exposes nothing until the owner opts in. Disabling the showcase immediately makes the RPC return no payload; clearing a project's public flag removes it from subsequent responses.

The demo requires no cleanup job because it creates no server records. Removing the public page routes and revoking execution on the RPC disables guest access without affecting owner tracking data.

## Acceptance Criteria

- Unauthenticated visitors can open `/showcase` and `/demo` but are redirected from every owner route.
- Showcase data is absent until the owner explicitly enables publishing.
- Only explicitly public, non-archived projects are shown.
- The public payload contains no email, owner ID, notes, logs, activity rows, exercise reports, change history, or private settings.
- Guest changes survive a reload in the same browser and disappear after reset.
- Two browsers have independent demo state.
- Demo actions generate no Supabase mutations and cannot alter owner data.
- Curriculum structure, account settings, and publishing controls cannot be changed from the demo.
- Existing owner authentication and tracking behavior continue to work.
