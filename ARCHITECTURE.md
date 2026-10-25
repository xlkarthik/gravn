# Architecture

The target design is [plan/ref-architecture.md](plan/ref-architecture.md). This file covers what is
built and where it differs.

## How a request is authorised

```
App (mobile or web) ──user JWT──► Supabase PostgREST ──► RLS policies ──► tables
                                         │                  │
                                         └──► RPC functions ─┘  (security definer, check role inside)
```

- **Reads** go straight to tables. RLS decides which rows come back, using helper functions in the
  `private` schema (`is_member`, `has_role`, `is_assigned_trainer`, `is_platform_admin`,
  `owner_or_creating_trainer`).
- **Writes that change membership or roles** go through RPCs only: `create_workspace`,
  `set_owner_trainer`, `create_invitation`, `get_invitation`, `accept_invitation`,
  `revoke_invitation`, `assign_trainer`, `end_trainer_assignment`, `remove_member`,
  `restore_member`, `admin_workspaces`. Each locks the workspace row before changing membership.
- **Simple owned writes** (own profile, workspace name, pending client records) are direct table
  updates limited by column grants and RLS.
- Nothing is reachable unless granted: migrations revoke everything from `anon` and `authenticated`,
  then grant what each role needs. `supabase/tests/011-invariants.test.sql` fails if a table loses
  RLS or a function becomes callable while signed out.
- Errors are raised as stable keys (`not_allowed`, `invitation_expired`, …), which both apps
  translate through `packages/shared/src/locales/en.json`.

## Shared code

`packages/shared` is TypeScript source, used directly by Metro and by Next.js (`transpilePackages`).

| Module                       | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `access.ts`                  | Roles, workspace picking, which navigation shell a role gets               |
| `api.ts`                     | Every database call both apps make (`gravnApi(supabase)`), error mapping   |
| `people.ts`                  | Roster, trainers, assignments, invitations and pending people in one fetch |
| `invitations.ts`             | Invitation screen states, link parsing                                     |
| `schemas.ts`                 | zod form schemas; messages are i18n keys                                   |
| `i18n.ts`, `locales/en.json` | Every user-facing string                                                   |
| `tokens.ts`                  | Colours, spacing, type sizes → React Native styles and web CSS variables   |

## Mobile (`apps/mobile`)

- Expo Router with protected route groups: `(auth)`, `onboarding`, `(member)`, `(trainer)` and
  `(owner)`, plus `invite/[token]`, `member/[id]` and `verified`. `src/app/index.tsx` redirects to the
  right place. When a group stops being available (sign-out, removal, workspace switch), the router
  falls back to it.
- `src/lib/session.tsx`: session, access list (`get_my_access`), current workspace. Access is
  refetched when the app returns to the foreground and when the network comes back. Cached
  workspace data for lost workspaces is dropped (queries are keyed `['ws', workspaceId, …]`).
- `src/lib/supabase.ts`: the session is AES-GCM encrypted (`expo-crypto`) in SQLite
  (`expo-sqlite/kv-store`), with the key in SecureStore.
- Variants (`app.config.ts`, `APP_VARIANT`): development (`.dev`, scheme `gravn-dev`), preview and
  production. EAS profiles in `eas.json`.

## Web (`apps/web`)

- `proxy.ts` (Next 16's middleware) refreshes the session cookie and sends signed-out visitors of
  private pages to `/sign-in`.
- Pages call `lib/supabase.ts` (`requireAccess`, `requireStaffWorkspace`, `requireOwnedWorkspace`).
  Mutations are server actions in `app/actions.ts` and `app/(auth)/actions.ts`, rendered through one
  `<Form>` client component.
- Dashboard: `/w/[id]` (overview and members/clients for owners and trainers; trainers and settings
  for owners). Platform admin: `/admin` (counts only). Public: auth pages, `/auth/confirm`,
  `/invite/[token]`.

## Not built yet

Offline workout store and sync (Part 2), push, Sentry, Storage buckets, edge functions, billing.
See [STATUS.md](STATUS.md).
