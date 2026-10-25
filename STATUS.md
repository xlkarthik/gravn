# Status

Last updated: 25 Oct 2026. Current part: **Part 3, Pilot Readiness** (Android and web; iOS deferred, D-40).

- [ ] Part 0: Groundwork (founder tasks: accounts, devices, pilot interviews)
- [x] **Part 1: Foundation** (code + schema + tests complete; applied on local Docker)
- [x] **Part 2: Workout loop** (code + schema + tests complete; applied on local Docker)
- [x] **Part 3: Pilot Readiness** (Warm Luxury Athletic UI redesign + measurements, gym memberships & expiry alerts, weekly streaks, coach high-fives, privacy/terms/deletion portals, problem reporting)
- [ ] Parts 4–9

## Part 1, Part 2 & Part 3: what exists

| Area                                                                                                                                                                                                                                                                                                                                                                                           | State                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Monorepo (pnpm 12, Expo SDK 58, Next.js 16.4, shared package)                                                                                                                                                                                                                                                                                                                                  | Built                                                                                                                        |
| Schema v1 + Part 2 workout loop + Part 3 pilot readiness (33 tables, RLS on every table, immutability triggers, RPCs, 60 synthetic exercises, standard measurement definitions, gym memberships, streaks, high-fives, notifications, deletion requests, seed)                                                                                                                                  | Built; **applied & seeded on local Docker**                                                                                  |
| pgTAP permission, immutability, offline sync and attack tests (13 files, `supabase/tests/001`–`012`)                                                                                                                                                                                                                                                                                           | Written; ready for `pnpm db:test`                                                                                            |
| Shared workout & progress engine (`@gravn/shared`: units/kg conversion, `setVolumeKg`, `detectSetPr`, `summarizeSession`, `pickNextProgramDay`, `buildMeasurementSeries`, `computeWeeklyStreak`, `daysUntilMembershipExpiry`, `filterExpiringMemberships`, schemas)                                                                                                                            | Built & unit-tested (59/59 pass)                                                                                             |
| Web (`Warm Luxury Athletic` redesign): Member Personal Studio (`/home` with `Workout`, `Splits`, `Progress`, `History`, `Profile` & `← Gym A` quick-return), Trainer & Gym Owner Workspace (`/w/[id]` Overview with 7d/30d expiry alerts, Members & Clients dossier with search & measurements, Training Splits, Activity Feed with 1-tap High-Fives), `/privacy`, `/terms`, `/delete-account` | Built; typechecks & lints cleanly                                                                                            |
| Mobile: auth, onboarding, invitations, member/trainer/owner shells (`D-56`), exercise library, program builder & assignment, Today screen & offline workout logger (`D-61`), Progress & Body Tracking (`progress.tsx`), Profile privacy & account deletion                                                                                                                                     | Built; typechecks & lints cleanly                                                                                            |
| Offline workout store (`apps/mobile/src/lib/offline.ts`: per-user SQLite + AES-GCM payload encryption in SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `D-60`; idempotent outbox + LWW sync with exponential backoff + unsynced sign-out guard, `D-59`)                                                                                                                                        | Built; not yet run on a physical device                                                                                      |
| Repo docs & compliance                                                                                                                                                                                                                                                                                                                                                                         | `README.md`, `STATUS.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `PERMISSIONS.md`, `PRIVACY_DATA_MAP.md`, `RELEASE_CHECKLIST.md` |

## Checks run (25 Oct 2026, Windows 11, Node 24.18, pnpm 12.14)

| Command                                | Result                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm lint` (shared, web, mobile)      | Pass (0 errors, 0 warnings)                                                      |
| `pnpm typecheck` (shared, web, mobile) | Pass                                                                             |
| `pnpm test` (shared, vitest)           | 59/59 pass (`access`, `invitations`, `schemas`, `workouts`)                      |
| `supabase db reset` (Docker Supabase)  | **Pass.** All Part 1, Part 2 & Part 3 migrations and `supabase/seed.sql` applied |
| iOS                                    | Deferred (D-40)                                                                  |

## Next steps

1. Proceed to **Part 4: Trainer Core** (`plan/04-trainer-core.md`) or **Part 5: Progress, Body Tracking & Adherence** (`plan/05-progress-and-retention.md`) when ready.
2. When ready to onboard external pilot gyms, review `RELEASE_CHECKLIST.md` and `PRIVACY_DATA_MAP.md`.
