# Pilot Release Checklist (`Part 3: Pilot Readiness`)

Use this checklist before cutting a pilot build or onboarding a real gym/trainer cohort.

## 1. Automated Verification Gates

- [x] `pnpm lint` passes across `@gravn/shared`, `@gravn/web`, and `@gravn/mobile`
- [x] `pnpm typecheck` passes across all packages
- [x] `pnpm test` passes all unit tests (including Part 3 measurements, gap-preserving series, weekly streaks, and membership expiry filters)
- [x] `pnpm --filter @gravn/web build` succeeds with all static and dynamic routes

## 2. Database & Migration Verification

- [x] `supabase/migrations/20261025000004_pilot_readiness.sql` applied cleanly
- [x] Global standard measurement definitions (`weight`, `body_fat`, `waist`, `chest`, `shoulders`, `arms`, `thighs`, `hip`, `calves`, `neck`, `height`) seeded
- [x] RLS enabled on all Part 3 tables (`measurement_definitions`, `measurement_entries`, `gym_memberships`, `streaks`, `high_fives`, `notifications`, `push_tokens`, `consents`, `deletion_requests`, `problem_reports`)
- [ ] Point-in-Time Recovery (PITR) or automated daily backup verified before paid production onboarding

## 3. Privacy, Legal & Store Compliance

- [x] `/privacy` page live and accessible without authentication
- [x] `/terms` page live and accessible without authentication
- [x] `/delete-account` public web deletion portal live and accessible without authentication
- [x] In-app `Delete Account` flow live in both Web (`Profile` tab) and Mobile (`AccountScreen`)
- [x] `PRIVACY_DATA_MAP.md` matches actual schema and Google Play Data Safety declarations

## 4. Core Pilot User Journeys

- [x] **Solo Member (`/home`):** Can start an empty workout or pick a pre-decided training split, log sets with tabular numerals, view gap-preserving body measurement charts (`Progress`), see weekly streak & coach high-fives, and switch back to a Gym workspace with 1 click (`← Gym A`).
- [x] **Trainer (`/w/[id]`):** Can create/architect splits from pre-decided templates, assign splits to clients, review completed sessions in `Activity Feed`, send 1-tap `🙌 High-Five` kudos, pause a client's streak for travel/injury, and log/view client body measurements.
- [x] **Gym Owner (`/w/[id]`):** Can search clients by name/email/phone, record physical gym membership `plan_label` + `start_date` + `end_date` + `status`, and see 7-day and 30-day membership expiry alerts on both `Overview` and `Members & Clients`.
