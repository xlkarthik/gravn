# Part 8: Hardening and release

**Build prompt milestone:** M6.
**Goal:** Gravn is secure, reliable and fast enough for public release, and both store submissions are ready, with every claim backed by a test that actually ran.
**Effort:** 3–4 weeks full-time, plus store review time.
**Depends on:** Parts 1–7.

> **Approval gate.** Submitting to the stores, releasing to production users, and any destructive migration need your explicit go-ahead.

## 8.1 Security review

- [ ] Run Supabase's Security Advisor and database linter; fix every warning or record why it's accepted.
- [ ] RLS audit, table by table, against [ref-permissions.md](ref-permissions.md). Confirm each table has RLS on and policies for every operation.
- [ ] Functions:
  - Every `security definer` function has a fixed `search_path`, checks the caller, and is executable only by the roles that need it.
  - Views use `security_invoker` or are revoked from client roles.
- [ ] Storage policies for every bucket: photos, exercise media, exports.
- [ ] Attack scripts (curl or a small test runner) with real user tokens:
  - cross-tenant IDs
  - role spoofing
  - self-promotion
  - editing someone else's entitlements
  - guessing storage paths
  - replaying sync operations
  - forging webhooks
- [ ] Rate limits on sensitive endpoints: invitations, the deletion request page, exports, password reset (Supabase Auth limits plus your own table-based limits for edge functions).
- [ ] Secrets:
  - gitleaks over the full git history.
  - Search the built JS bundles for key patterns.
  - Confirm no service-role key or webhook secret is in either app.
- [ ] Dependencies: `pnpm audit`; update anything with a known exploit.
- [ ] Web security headers: Content-Security-Policy, HSTS, `frame-ancestors`, and secure, HttpOnly, SameSite cookies.
- [ ] Auth settings:
  - password rules
  - email confirmation required
  - session expiry
  - sessions revoked on password change
  - leaked-password protection if your plan includes it
- [ ] Logs and audit events contain no measurements, photos, notes, tokens or passwords.
- [ ] Write a short threat model (`docs/threat-model.md`): assets, attackers, entry points, and the controls above.

## 8.2 Reliability

- [ ] Sync chaos tests: kill during upload, duplicate delivery, clock skew on the phone, very long offline periods (7+ days), app upgrade with queued operations.
- [ ] Restore drill: database **and** storage files into staging. Time it and update the runbook.
- [ ] Light load test on staging (for example k6) for `sync_push` and dashboard queries at about 3× expected peak. Check for slow queries and add indexes.
- [ ] Scheduled jobs survive a failure and retry without duplicates.

## 8.3 Performance

Proposed targets; adjust after measuring on the low-end Android phone.

| Check | Target |
|---|---|
| Cold start to Today screen, low-end Android | Under 3 seconds |
| Marking a set complete | Feels instant; the write is local |
| Long lists (clients, history, library) | Smooth scrolling with FlashList |
| Demo video start (cached) | Under 1 second |
| Owner dashboard (web), Lighthouse performance | 80+ on desktop |

- [ ] Check app size and remove unused dependencies.
- [ ] Images resized; no full-resolution photos in lists.

## 8.4 Accessibility and layout

- [ ] TalkBack (Android) and VoiceOver (iPhone) walkthrough of the core flows: sign in, Today, logging a set, rest timer, progress, settings.
- [ ] System font at its largest size: no clipped or overlapping text.
- [ ] Contrast meets WCAG AA. Set states and errors never rely on colour alone.
- [ ] Small phones (about 360 dp wide) and large phones; tablets if supported.
- [ ] iPad: decide `ios.supportsTablet` (D-23). If false, the app still runs on iPad in compatibility mode, and reviewers may test it there, so check it.

## 8.5 Release builds

- [ ] Version scheme: semantic version for the app (`1.0.0`), build numbers auto-incremented by EAS (`appVersionSource: remote`).
- [ ] Android:
  - App Bundle signed with the EAS-managed upload key; Play App Signing on.
  - **Download a backup of the credentials and store it safely.**
  - Target API matches Play's current requirement.
- [ ] iOS: distribution certificate and provisioning profile managed by EAS; build made with the Xcode version Apple currently requires (EAS images handle this).
- [ ] If using over-the-air updates (EAS Update): set the runtime-version policy, a staging channel, and a rollback procedure. Never ship native changes over the air.
- [ ] `min_supported_version` set for the release.

## 8.6 Google Play submission

**App content**
- [ ] Privacy policy URL
- [ ] App access instructions with demo logins for owner, trainer and member (no reviewer-only behaviour)
- [ ] Ads declaration: none
- [ ] Content rating questionnaire
- [ ] Target audience and content (ties to the age policy, D-07)
- [ ] Data safety form, including the account-deletion URL
- [ ] Health apps declaration (fitness features)
- [ ] Financial features: none

**Store listing**
- [ ] App name, short description and full description, written around outcomes per the business report: "know your workout, record every session, see measurable progress"
- [ ] Icon, feature graphic and phone screenshots
- [ ] A consumer story in the screenshots (programs, streaks, PRs, total lifted) alongside the gym story, and Premium pricing, period and renewal terms in the description

**Release**
- [ ] Production access granted (from the Part 4 closed test)
- [ ] Staged rollout plan (for example 10% → 50% → 100%)

## 8.7 App Store submission

**App information**
- [ ] Name, subtitle, keywords, description, support URL, privacy policy URL
- [ ] App Privacy answers matching `PRIVACY_DATA_MAP.md`
- [ ] Age rating questionnaire (Apple revised its age categories in 2025)

**Review information**
- [ ] Contact details
- [ ] Demo accounts for each role, with a seeded demo gym
- [ ] Notes explaining that gym plans are managed by gyms outside the app and that Premium is an in-app purchase

**Binary and compliance**
- [ ] Export compliance: the app uses SQLCipher (AES) for on-device data, not just HTTPS. Answer the encryption questions carefully, set `ITSAppUsesNonExemptEncryption` to match, and check whether a self-classification report is required (Apple's export compliance documentation).
- [ ] Privacy manifest: declare required-reason APIs through Expo's `ios.privacyManifests` config, and check that third-party SDKs ship their own.
- [ ] Sharing: add-only photo permission text for Save to Photos; Instagram Stories query scheme and Facebook App ID in Info.plist; matching Android `<queries>` entry. Test one-tap Stories on the release build of both phones.
- [ ] In-app purchases: products attached to the version, review screenshot, terms and privacy links in the app and in the description.
- [ ] Screenshots at the sizes App Store Connect currently requires (iPad too if supported).
- [ ] Phased release plan.

## 8.8 Documents to finish

- [ ] `RELEASE_CHECKLIST.md`: every step above, with the date done and by whom.
- [ ] `PRIVACY_DATA_MAP.md`: final, matching both store forms.
- [ ] `BILLING.md`: final policy matrix and sandbox results.
- [ ] `COSTS.md`: actual monthly bills so far vs the plan.
- [ ] `STATUS.md`: release candidate status, with Android and iOS results listed separately.
- [ ] Founder and legal sign-off list: age, consent, data location, retention and backup ageing. Don't claim the app is certified compliant.

## Go / no-go checklist

- [ ] No open P0 or P1 issues
- [ ] All acceptance demos from Parts 1–7 re-run on the release candidate, on both phones
- [ ] Security review items closed or accepted in writing
- [ ] Restore drill passed in the last 30 days
- [ ] Legal pages current; consent versions bumped if they changed
- [ ] Support email and WhatsApp staffed for launch week
- [ ] Rollback plan written

## Costs this part

Usually none. EAS Starter (US$19/month) is worth it if free-tier build queues slow release work.

## Risks

| Risk | Mitigation |
|---|---|
| Store rejection | Demo accounts, clear review notes, policy matrix done; budget a week for resubmission |
| Last-minute security finding | Run 8.1 early in the part, not on the last day |
| Lost Android signing credentials | Back them up when first created; Play App Signing allows an upload-key reset |
