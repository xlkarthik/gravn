# Reference: quality, security and privacy

How Gravn is tested and kept safe across all parts. Each part file lists its own tests; this file holds the shared rules.

## Definition of done (every feature)

- [ ] Reads and writes real data through real permissions (no mock data on finished screens)
- [ ] Database tests for any new table, policy or RPC
- [ ] Unit tests for any calculation or state logic
- [ ] Loading, empty, error, offline and permission-denied states
- [ ] Screen-reader labels, works at large font sizes, touch targets at least 48 dp
- [ ] Strings in the i18n catalog
- [ ] Checked on a physical iPhone **and** an Android phone; results noted separately in `STATUS.md`
- [ ] No sensitive data in logs, analytics, push payloads or error reports
- [ ] Docs updated if behaviour, permissions, data or costs changed
- [ ] CI green

## Test layers

| Layer | Tool | What it covers | Runs |
|---|---|---|---|
| Database | pgTAP via `supabase test db` | RLS for every table and role, RPC rules, limits, idempotency, constraints | CI, every push |
| Shared logic | Vitest | Units, PR formulas, entitlements, schedule rules, validation schemas | CI |
| Mobile components and hooks | jest-expo + React Native Testing Library | Set entry states, timer maths, sync queue, conflict handling | CI |
| Edge functions | Deno test (against local Supabase) | Webhook auth, duplicates, out-of-order events, export, deletion | CI |
| Web end-to-end | Playwright | Owner flows, invitation acceptance, deletion page | CI (against local stack) |
| Mobile end-to-end | Maestro | Sign in, log a workout offline, sync | Locally on the Android emulator; EAS Workflows' Maestro job (alpha) is an option later |
| Manual device checks | Your iPhone and Android phones | Everything native: notifications, camera, purchases, airplane mode, background behaviour | Every part's acceptance demo |
| Store sandbox | Apple sandbox, Google license testers | Purchase, restore, renewal, expiry | Part 7, then before each billing change |

A web preview or a JavaScript bundle never counts as proof that a native app works.

## CI pipeline (GitHub Actions)

On every push and pull request:

1. Install with the frozen lockfile
2. Lint and format check
3. Typecheck all packages
4. Unit tests (shared, mobile, web)
5. `supabase start` → `supabase db reset` (migrations + seed) → `supabase test db`
6. Edge function tests
7. Web build; Playwright against the local stack
8. Secret scan (gitleaks)
9. `npx expo-doctor` for the mobile app

EAS builds aren't run on every push; start them manually or on a release tag to save build credits.

## Device and OS matrix

| Device | Why |
|---|---|
| Your iPhone on current iOS | Main iOS device |
| Low-end Android (2–3 GB RAM) | Performance floor for members |
| Your everyday Android phone | Typical member phone |
| Android emulator (oldest supported Android and the newest) | Edge OS versions |
| iPhone at the minimum supported iOS (borrow one if possible) | Catches OS-version bugs |
| A laptop browser and a tablet browser | Owner dashboard |

## Security checklist

Applied from Part 1 and audited in Part 8.

**Database and API**
- [ ] RLS on every table; policies for every operation; tests for every role
- [ ] `security definer` functions: fixed `search_path`, caller checks, `execute` granted only to the roles that need it
- [ ] Views are `security_invoker` or not exposed to client roles
- [ ] Composite foreign keys keep references inside one workspace
- [ ] No client-writable role, entitlement, subscription or limit fields
- [ ] Rate limits on invitations, exports, the deletion request page and password reset

**Secrets**
- [ ] Only the anon key ships in apps; service-role and third-party secrets live in Supabase, EAS and Cloudflare settings
- [ ] gitleaks in CI; built bundles searched for key patterns before release
- [ ] Keys rotated quarterly and immediately after any suspected leak (runbook)

**Uploads**
- [ ] Bucket MIME and size limits, client-side checks, server-side type check, private by default
- [ ] Photos re-encoded on the phone (metadata removed); verified with a GPS test image

**Sessions**
- [ ] Email confirmation required; sessions revoked on password change; sign-out clears tokens, push tokens and the RevenueCat user
- [ ] Mobile: session encrypted with a key in SecureStore; SQLite encrypted with SQLCipher; key "this device only"
- [ ] Android app-data backup off

**Web**
- [ ] CSP, HSTS, `frame-ancestors`, secure cookies
- [ ] Server-side checks in addition to RLS on admin pages

**Logs**
- [ ] Safe error messages to users; no stack traces exposed
- [ ] Logs, audit events and Sentry contain no measurements, photos, notes, tokens or passwords

**Webhooks**
- [ ] Authenticated (shared secret header); raw events stored; duplicate IDs ignored; state refetched rather than trusting order

## Privacy checklist

- [ ] Collect only what a feature needs; explain why when asking for permission (camera, photos, notifications)
- [ ] No advertising SDKs. No general analytics SDK receives measurements, photos, notes or workout details.
- [ ] Every third party that receives data is listed in `PRIVACY_DATA_MAP.md`, with what it gets: Supabase, Expo push, Apple/Google push, Resend, Sentry, RevenueCat, Cloudflare, and later Razorpay
- [ ] Consent records for terms, privacy policy, photo sharing and (if applicable) parental consent
- [ ] Export of the user's own data; in-app deletion and a web deletion request page
- [ ] The deletion flow explains that store subscriptions are cancelled in the store, and links there
- [ ] Retention periods documented; backup ageing explained rather than promising instant removal from backups
- [ ] Trainer-only notes clearly labelled and never shown to members
- [ ] Joining a gym shares nothing from the personal workspace without an explicit share
- [ ] Store privacy forms (App Privacy, Data safety) match `PRIVACY_DATA_MAP.md`
- [ ] No medical diagnosis, treatment advice or automated AI coaching
- [ ] DPDP: notice, consent, security safeguards, breach process, erasure and children's data ready before about 13 May 2027 (lawyer confirms)

## Backups and restore

| What | How | Kept |
|---|---|---|
| Database | Supabase Pro daily backups | 7 days |
| Database (your copy) | Weekly `pg_dump`, encrypted, to a separate storage provider (GitHub Actions) | 4–8 weeks |
| Storage files (photos, media) | Weekly copy of buckets to the same separate provider | 4–8 weeks |
| Code and migrations | GitHub | Permanent |
| Signing credentials | Downloaded from EAS, stored in your password manager | Permanent |

- Restore drill in Part 3, again in Part 8, then quarterly. Each drill restores the database **and** files into staging and checks that the app works against it.
- Database backups never include files. The storage copy is a separate job and must be restored separately.
- Point-in-time recovery (US$100/month) becomes worth it once losing a day of data would hurt paying gyms.

## Accessibility checklist

- [ ] VoiceOver and TalkBack labels on every control; logical focus order
- [ ] Text scales to the largest system size without clipping
- [ ] WCAG AA contrast in the dark theme; states shown by shape or text as well as colour
- [ ] Touch targets at least 48 dp; one-handed reach for set logging
- [ ] Respect reduced-motion settings
- [ ] Number inputs show the unit and accept decimals with a comma or a point

## Performance targets

See [08-hardening-release.md](08-hardening-release.md#83-performance). Measure on the low-end Android phone, not the emulator.

## Code conventions

- TypeScript strict; no `any` without a comment explaining why
- Shared business rules live in `packages/shared` and are imported by mobile, web and tests, so a rule exists once
- One migration per change, with its pgTAP tests in the same commit
- Feature folders in the apps (`src/features/workouts/…`), not type folders
- Small commits with clear messages; a short note in `STATUS.md` at the end of each session
