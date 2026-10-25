# Reference: architecture

This seeds the repo's `ARCHITECTURE.md` in Part 1. Versions are as of October 2026. Check Expo's and each library's current docs before installing, and pin what you install.

## System overview

```
 ┌──────────────────────┐     ┌──────────────────────┐
 │  Mobile app (Expo)    │     │  Web app (Next.js)    │
 │  iOS + Android        │     │  Owner dashboard,     │
 │  members, trainers,   │     │  platform admin,      │
 │  owners               │     │  legal + deletion pages│
 │  SQLite (SQLCipher)   │     │  on Cloudflare Workers│
 └─────────┬────────────┘     └──────────┬───────────┘
           │ HTTPS (user's JWT; anon key only)          │
           ▼                                            ▼
 ┌────────────────────────────────────────────────────────────┐
 │ Supabase (Mumbai)                                           │
 │  Auth ── Postgres + RLS ── RPC functions ── Storage (private) │
 │  Edge Functions (webhooks, push, email, export, deletion)    │
 │  pg_cron (reminders, deletion jobs, cleanup, reconciliation)  │
 └──────┬───────────────┬───────────────┬───────────────┬──────┘
        ▼               ▼               ▼               ▼
   Expo Push       Resend (SMTP)    RevenueCat ◄── App Store / Google Play
   (FCM / APNs)                    (webhooks)
                        Sentry (errors from all three apps)
```

No custom API server. Logic lives in three places, chosen by need:

| Where | Use for | Examples |
|---|---|---|
| RLS policies | Who can read or change which rows | Members see their own sessions; trainers see assigned clients |
| Postgres RPC functions | Multi-step changes that must be atomic or check limits | `accept_invitation`, `sync_push`, `invite_member` (limit lock), `publish_program` |
| Edge Functions | Anything needing a secret or an outside service | RevenueCat webhook, sending push, export builder, deletion processor |

## Stack

| Area | Choice | Notes |
|---|---|---|
| Mobile | React Native, Expo SDK 57, Expo Router, TypeScript | Dev builds, not Expo Go. iOS 16.4+, Android 7+, target API 36 |
| Builds | EAS Build and Submit | Profiles: development, preview, production |
| Web | Next.js (App Router), TypeScript | `@supabase/ssr`; hosted on Cloudflare Workers through OpenNext |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions (Deno), Cron | Mumbai region; Pro plan in production |
| Server state | TanStack Query | For online data; not used for offline drafts |
| Offline store | `expo-sqlite` with SQLCipher | One encrypted database per user |
| Secure storage | `expo-secure-store` | Encryption keys; session key |
| Forms and validation | react-hook-form + zod | Schemas shared from `packages/shared` |
| Lists | `@shopify/flash-list` | Long lists on low-end phones |
| Media | `expo-video`, `expo-image`, `expo-image-picker`, `expo-image-manipulator` | Manipulator re-encodes photos, dropping EXIF |
| Notifications | `expo-notifications` + Expo push service | Local notifications for the rest timer |
| Connectivity | `@react-native-community/netinfo` | Triggers sync |
| Purchases | `react-native-purchases` (RevenueCat) | Behind a billing adapter |
| Social sharing | `react-native-share`, `react-native-view-shot` (or a Skia snapshot), `expo-media-library` | Instagram Stories needs a Facebook App ID; check Expo SDK compatibility in Part 5 |
| Charts | Mobile: decide in Part 5 (victory-native or react-native-gifted-charts). Web: Recharts | |
| i18n | i18next + react-i18next, `expo-localization` | Catalogs in `packages/i18n` |
| Errors | Sentry (`@sentry/react-native`, `@sentry/nextjs`) | Scrub personal data |
| Email | Resend through Supabase custom SMTP and its API | SPF, DKIM, DMARC on your domain |
| Tests | pgTAP (`supabase test db`), Vitest, jest-expo + React Native Testing Library, Playwright, Maestro, Deno test | See [ref-quality-security.md](ref-quality-security.md) |
| CI | GitHub Actions | Free minutes cover a solo project |

No Redux or other global state library. Use React context for the signed-in user and current workspace, TanStack Query for server data, and SQLite for offline data.

## Repository layout

```
/ (repo root)
├─ apps/
│  ├─ mobile/                 Expo app
│  │  ├─ app/                 Expo Router routes: (auth), (member), (trainer), (owner)
│  │  ├─ src/features/        workouts, programs, progress, photos, billing, notifications…
│  │  ├─ src/offline/         SQLite schema, outbox, sync engine, conflict UI
│  │  ├─ src/lib/             supabase client, billing adapter, i18n setup
│  │  ├─ app.config.ts        variants: development / preview / production
│  │  └─ eas.json
│  └─ web/                    Next.js app
│     ├─ app/(owner)/         dashboard pages
│     ├─ app/(admin)/         platform admin
│     ├─ app/(public)/        privacy, terms, support, delete-account, invite
│     └─ lib/
├─ packages/
│  ├─ shared/                 DB types, zod schemas, units, metrics, entitlements, sync op types
│  ├─ design-tokens/          colours, spacing, type scale → RN theme + CSS variables
│  └─ i18n/                   en.json (later ml.json)
├─ supabase/
│  ├─ migrations/             timestamped SQL
│  ├─ functions/              edge functions (one folder each) + shared helpers
│  ├─ tests/                  pgTAP files, one per table or flow
│  ├─ seed.sql                synthetic data only
│  └─ config.toml
├─ docs/                      runbooks, research, threat model, asset-licenses.csv
├─ plan/                      this plan
├─ .github/workflows/ci.yml
├─ README.md  ARCHITECTURE.md  PERMISSIONS.md  BILLING.md  PRIVACY_DATA_MAP.md
├─ COSTS.md  RELEASE_CHECKLIST.md  DECISIONS.md  STATUS.md
└─ pnpm-workspace.yaml
```

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| Supabase | `supabase start` (Docker) | Free project (pauses when idle) | Pro project, Mumbai |
| Data | Seed (synthetic) | Seed (synthetic) | Real users only |
| Email | Supabase test inbox | Resend, test domain or subdomain | Resend, your domain |
| Web | `localhost` | `staging.` subdomain | Main domain |
| Mobile variant | Gravn Dev (development profile) | Gravn Preview (preview profile) | Gravn (production profile) |
| Billing | None | RevenueCat sandbox | RevenueCat production |
| Secrets | `.env.local` (git-ignored) | Supabase, EAS and Cloudflare settings | Same, separate values |

Migrations flow local → staging → production through the CLI. Production data never flows back down.

## Sign-in and sessions

- Email and password through Supabase Auth with email confirmation. Password reset by email link that opens the app.
- **Mobile:** the Supabase session is stored encrypted; its key is in `expo-secure-store`. The session refreshes automatically, and sign-out clears it along with push tokens and the RevenueCat user.
- **Web:** cookie sessions through `@supabase/ssr`; middleware refreshes them. Server components check access, and RLS enforces it anyway.
- Roles and workspace membership are never put into the token. RLS looks them up per request, so removing someone takes effect immediately.

## Offline sync

### Scope

Offline covers the member's current plan, the exercise details it needs, and the active and recent sessions. Trainers and owners need a connection for everything else.

### Local data (per user, encrypted)

| Table | Contents |
|---|---|
| `plan_cache` | Active assignment, program version snapshot, days and items |
| `exercise_cache` | Name, instructions, media URL and thumbnail for exercises in the plan |
| `sessions`, `session_exercises`, `session_sets` | Drafts and recent history, using IDs generated on the phone |
| `outbox` | `op_id`, `type`, `entity_id`, `payload`, `base_revision`, `created_at`, `attempts`, `status`, `last_error` |
| `timers` | Rest timer `ends_at` per session |
| `meta` | Last pull time, schema version, the user ID this database belongs to |

### Flow

1. The user edits a set → write to SQLite → add an outbox operation (`op_id` from `expo-crypto`'s `randomUUID`).
2. The sync engine sends pending operations in order, in small batches, to `sync_push`. It runs on foreground, reconnect, a short debounce after edits, and on manual retry.
3. For each operation the server:
   1. Checks the caller is the subject (or allowed) and still a member of the workspace.
   2. Inserts `(user_id, op_id)` into `sync_operations`. If that already exists, it returns the stored result (idempotent).
   3. Compares `base_revision` with the row's `revision`. If they match, it applies the change and increments `revision`. If not, it writes both versions to `sync_conflicts` and returns `conflict`.
4. The app marks each operation `synced`, `error` (retry with backoff and jitter; permanent errors shown to the user), or `conflict` (the user chooses).
5. After a push, the app pulls the server's current state for the affected session and the active assignment.

### Rules

- Sessions keep a snapshot of the planned day; plan edits never change a started session.
- Membership is checked against the server on every reconnect (`get_my_access`). Data for workspaces the user lost is purged locally.
- **Offline limit:** a removed trainer or member keeps whatever was cached on their phone until it next connects. Trainers therefore cache nothing about clients offline.
- Database schema changes ship with local migrations. `min_supported_version` stops very old builds from syncing with a newer server.
- Sign-out with pending operations requires a choice: sync now or discard. Each user has a separate encrypted database, so drafts never leak between accounts.

## Notifications

- Push tokens are registered after permission is granted and stored in `push_tokens` (user, device, platform, last seen).
- Events create rows in `notifications`, with a unique `dedupe_key` such as `assignment:{id}:v{version}`.
- A dispatcher (an edge function called by `pg_cron`, or right after the event) sends through the Expo push service, records deliveries, checks receipts, and removes dead tokens.
- Preferences and quiet hours are checked before sending, using the user's timezone.
- Payloads contain a title, generic body, route and IDs only. The app re-checks access when a notification is opened.
- Rest timer alerts are **local** notifications scheduled on the phone, not push.

## Media and photos

| Bucket | Visibility | Path | Limits |
|---|---|---|---|
| `exercise-media-global` | Public or signed (D-15) | `exercise_id/file` | MP4 or images; size cap |
| `exercise-media-workspace` | Private to the workspace | `workspace_id/exercise_id/file` | Same |
| `progress-photos` | Private: owner and active shares only | `user_id/photo_id.jpg` | JPEG; about 300 KB after on-device re-encode |
| `exports` | Private: owner only | `user_id/export_id.zip` | Deleted after 24 hours |

- Storage policies call `security definer` helpers (for example `can_view_photo(name)`) that check shares.
- Signed URLs last minutes, not days.
- Uploads land in a pending state until a server function checks the real file type.
- Database backups don't contain files; the weekly storage copy (Part 3) does.

## Plans, entitlements and billing

- **Gyms and trainers:** `workspace_subscriptions` is set by a platform admin (manual invoice), a time-limited `access_grant`, a trial, or later Razorpay webhooks. Never by the client.
- **Consumers:** RevenueCat (user ID = Supabase user ID) → webhook → refetch subscriber state → `consumer_entitlements`.
- One function, `can_use(feature, workspace)`, is used by RLS, RPCs and the UI. The UI's copy is a display cache only.
- Member limits are enforced inside the invite and activate RPCs, which lock the workspace row.

## Background jobs (`pg_cron`)

| Job | Frequency |
|---|---|
| Notification dispatch retry | Every minute or two |
| Membership expiry reminders | Hourly (sends at local 9 am) |
| Deletion processing (scheduled requests) | Hourly |
| Export cleanup | Daily |
| Invitation expiry cleanup | Daily |
| RevenueCat reconciliation | Daily |
| `sync_operations` pruning (keep 90 days) | Weekly |
| Backup copy of database and storage | Weekly (GitHub Actions, not `pg_cron`) |

## Configuration and feature flags

`app_config` holds `min_supported_version`, a maintenance message, and simple flags (for example `premium_enabled`). Everyone can read it; only platform admins can change it, and changes are audited.

## Observability

- Sentry for the mobile app, web app and edge functions, with release tracking and personal data scrubbed.
- Supabase logs and reports for slow queries and API errors.
- An uptime check on the web app and one edge function.
- Business metrics come from SQL views in the database (Part 4), not a third-party analytics SDK. Body measurements, photos, notes and workout details never go to analytics or ads services.
