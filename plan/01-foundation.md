# Part 1: Foundation

**Build prompt milestone:** M1.
**Goal:** a real person can sign up, verify their email, create a workspace or join one by invitation, and land on navigation for their role. This works on Android, iOS and the web, with permissions enforced and tested in the database.
**Effort:** 3–4 weeks full-time.
**Depends on:** Part 0 (the Apple account for iPhone builds; Docker on the PC).

## 1.1 Repository and tooling

- [ ] `git init`, private GitHub repo, `.gitignore` covering env files, keys, `.expo/`, build output and the Supabase `.branches`/`.temp` folders.
- [ ] Workspace layout (details in [ref-architecture.md](ref-architecture.md#repository-layout)):
  - `apps/mobile`: the Expo app.
  - `apps/web`: the Next.js owner dashboard and platform admin.
  - `packages/shared`: types, zod schemas, units, metrics and entitlement logic.
  - `packages/design-tokens` and `packages/i18n`.
  - `supabase/`: migrations, seed, functions and tests.
  - `docs/`.
- [ ] Read Expo's monorepo guide before installing. pnpm isolated installs are supported from SDK 54; if native builds misbehave, set `nodeLinker: hoisted`.
- [ ] Create the Expo app on the latest SDK (57 at the time of writing). Add native packages with `npx expo install` so versions match the SDK. Run `npx expo-doctor`.
- [ ] Pin versions and commit the lockfile.
- [ ] TypeScript strict mode, ESLint and Prettier.
- [ ] Root scripts: `lint`, `typecheck`, `test`, `db:start`, `db:reset`, `db:test`, `gen:types`.
- [ ] GitHub Actions CI on every push: install, lint, typecheck, unit tests, then `supabase start` → `supabase db reset` → `supabase test db`, then the web build.
- [ ] Secret scanning (gitleaks) in CI. `.env.example` files only, never real keys.
- [ ] Create the repo documents: `README.md` (setup from a clean Windows machine), `STATUS.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `PERMISSIONS.md` and `COSTS.md`, seeded from this plan.

## 1.2 Local Supabase and schema v1

- [ ] `supabase init` and `supabase start`. In `config.toml`: email confirmation on, site URL and redirect URLs (app scheme and local web URL), and password rules.
- [ ] Migrations for schema v1 ([ref-data-model.md](ref-data-model.md)):
  - `profiles` (with timezone, locale, unit preference)
  - `workspaces` (type: `gym`, `coach`, `personal`)
  - `workspace_members` and `member_roles`
  - `invitations` (hashed token, role, expiry, single use)
  - `client_records` (pending people not yet signed up)
  - `trainer_assignments`
  - `audit_events`, `platform_admins`, `app_config`
- [ ] Row-level security **on every table**, with no exceptions.
- [ ] Helper functions used by policies:
  - `is_member(ws)`, `has_role(ws, role)`, `is_assigned_trainer(ws, client_member)`, `is_platform_admin()`
  - All are `security definer` with `set search_path = ''`, and use `(select auth.uid())` so Postgres evaluates it once per query.
- [ ] Revoke `execute` on all functions from `public` and `anon`, then grant back only what each role needs.
- [ ] RPCs for anything that changes roles or membership. Clients never insert into `workspace_members` directly.
  - `create_workspace(type, name)`
  - `create_invitation(ws, email, role)`
  - `accept_invitation(token)`
  - `create_client_record(...)`
  - `assign_trainer(...)`
  - `remove_member(...)`
  - `get_my_access()`
- [ ] Trigger that creates a profile and a personal workspace when an auth user is created. Keep it minimal and give it a fixed `search_path`.
- [ ] Seed data, all synthetic with `@example.test` emails:
  - Gym A and Gym B, each with an owner, 2 trainers and 5 members
  - one independent trainer with 3 clients
  - one consumer with no gym
  - one person who is a member in Gym A **and** a trainer in Gym B
- [ ] Generate database types into `packages/shared`.

## 1.3 Database permission tests

pgTAP tests, run by `supabase test db`.

- [ ] One test file per table, checking select, insert, update and delete for every role in [ref-permissions.md](ref-permissions.md), plus the `anon` key.
- [ ] Attack tests:
  - [ ] Reading Gym B's rows with Gym A IDs
  - [ ] Inserting your own membership with the owner role
  - [ ] Changing your own role
  - [ ] Editing another user's profile
  - [ ] Accepting an expired invitation, a used one, or one addressed to a different email
  - [ ] Accepting an invitation twice, or into a workspace you already belong to
- [ ] Revocation: after `remove_member`, the trainer's next query returns nothing.
- [ ] The dual-role person sees Gym A as a member and Gym B as a trainer, and nothing more.

## 1.4 Sign-in

- [ ] Mobile and web: sign up with email and password, email verification (deep link back into the app), sign in, sign out, forgot password, reset password, and staying signed in after restart.
- [ ] Mobile session storage: follow Supabase's Expo guide. The session is stored encrypted, with the key in `expo-secure-store` (SecureStore alone has a value-size limit).
- [ ] Shared zod schemas for email and password rules. Friendly error messages that never reveal whether an email is registered.
- [ ] Rely on Supabase Auth's built-in rate limits. Add a CAPTCHA (Turnstile or hCaptcha, both supported by Supabase Auth) to web sign-up if abuse appears.
- [ ] Local auth emails go to the Supabase test inbox. Staging and production need custom SMTP (Part 3).

## 1.5 Onboarding and workspaces

- [ ] First-run choice screen:
  - Create a gym
  - I have an invitation
  - I'm an independent trainer
  - I'm training on my own
- [ ] Every user gets a private personal workspace automatically.
- [ ] Invitations:
  - The owner invites a trainer or member by email. The link opens the app if installed, otherwise the web.
  - Every case gets a clear screen: expired, already used, signed in as a different account, already a member, new account, or existing account.
- [ ] Pending client records: an owner or trainer adds a person by name (email and phone optional), then sends an invite to claim the record. No account exists until the person signs up, and no password is ever created for them.
- [ ] Workspace switcher showing role and workspace name.
- [ ] Role-based navigation shells:
  - **Member:** Today, Workouts, Progress, Profile
  - **Trainer:** Clients, Programs, Library, Profile
  - **Owner (mobile):** Overview, Members, Trainers, Settings
  - **Web:** owner dashboard shell and platform-admin shell
- [ ] Account settings, privacy settings and membership details. Use real data where it exists; label anything not yet built as "coming in Part N", never as working.
- [ ] Shared states used everywhere: loading, empty, error with retry, offline, and permission denied.

## 1.6 Mobile app setup

- [ ] `app.config.ts` with three variants that install side by side:

  | Variant | App name | Bundle ID suffix | Backend |
  |---|---|---|---|
  | development | Gravn Dev | `.dev` | Local Supabase |
  | preview | Gravn Preview | `.preview` | Staging |
  | production | Gravn | none | Production |

- [ ] `eas.json` profiles: `development` (dev client, internal distribution), `preview` (internal, staging env vars) and `production` (store, auto-incrementing build numbers).
- [ ] Deep links: a custom scheme now. Universal links (iOS) and app links (Android) need the domain and come in Part 3.
- [ ] Register the iPhone with `eas device:create`. Build the iOS and Android dev clients and install both.
- [ ] Point the dev client at local Supabase over your Wi-Fi: use the PC's LAN IP and allow the ports through Windows Firewall. If the network blocks this, use a tunnel.
- [ ] Design tokens taken from the Gravn logo: near-black and charcoal surfaces, off-white text and marks, and a restrained ember-orange accent used sparingly. Feed them into both the RN theme and web CSS variables.
- [ ] Base components: Screen, Button, TextField, NumberStepper, ListItem, EmptyState, ErrorState, OfflineBanner.
  - Touch targets at least 48 dp.
  - Text scales with system font size.
  - Every control has a screen-reader label.
- [ ] Every string goes through `packages/i18n` (English catalog now, Malayalam later). Dates and numbers are formatted with `Intl`, defaulting to Asia/Kolkata but following the user's timezone.
- [ ] Optional now, required by Part 3: Sentry (`@sentry/react-native` with its Expo plugin), with personal data scrubbed before sending.

## 1.7 Web app

- [ ] Next.js App Router with `@supabase/ssr` cookie sessions and middleware that refreshes sessions.
- [ ] Pages: sign in/up, verify email, reset password, accept invitation, owner shell, and platform-admin shell (visible only to `platform_admins`, checked on the server and by RLS).
- [ ] Desktop layouts designed for desktop (sidebar plus content), not the mobile layout stretched.
- [ ] Decide the hosting target (proposed: Cloudflare Workers through OpenNext). Don't deploy yet.

## Tests

- [ ] The pgTAP suite above.
- [ ] Unit tests for the shared schemas and invitation-state logic.
- [ ] Playwright smoke test on the web: sign in and accept an invitation.
- [ ] Manual run on the iPhone and an Android phone, recorded separately in `STATUS.md` with device, OS version and result.
- [ ] Optional: first Maestro flow (sign in) on the Android emulator.

## Acceptance demo

Run on an iPhone, an Android phone and the web.

1. An owner signs up, verifies by email and creates "Gym A".
2. The owner invites a trainer and a member. Each accepts on their own phone, and they see different navigation.
3. The Gym A trainer can't read Gym B data. Show the denied request from a direct API call, not just a hidden button.
4. The owner removes the trainer. The trainer's next request is denied.
5. An expired invitation shows a clear message and offers to request a new one.

## Exit checklist

- [ ] CI green on the main branch
- [ ] Permission tests cover every table in schema v1
- [ ] Dev builds run on the iPhone and Android, with results recorded separately
- [ ] `README.md` lets someone set up from scratch on Windows
- [ ] `STATUS.md` and `DECISIONS.md` updated

## Costs this part

₹0 in services; everything runs locally or on free tiers. The Apple fee was paid in Part 0.

## Business tasks in parallel

Pilot gym interviews; lawyer drafting the legal pages; D-U-N-S number if you registered a company; Android tester recruitment.

## Risks

| Risk | Mitigation |
|---|---|
| RLS policies that query other RLS tables recurse or get slow | Route membership checks through `security definer` helper functions; index `workspace_members(user_id, workspace_id)` |
| The phone can't reach local Supabase | Firewall rule on the LAN IP, or a tunnel; worst case, a free staging project |
| Deep links behave differently on each platform | Test invitation links on both phones in this part, not later |
| Monorepo install issues with native modules | Follow Expo's monorepo guide; `nodeLinker: hoisted` as fallback |
