# Part 3: Pilot readiness

**Build prompt milestones:** pulls specific items forward from M3 (basic measurements, account deletion), M4 (owner basics, membership expiry, push, monitoring) and M6 (environments, legal pages, test distribution).
**Goal:** a real gym can use Gravn safely for 4–8 weeks on the production backend. Members install it through TestFlight and Google Play closed testing.
**Effort:** 3–4 weeks full-time (the engagement items in 3.8 add a few days).
**Depends on:** Part 2. Also needs the legal pages from the lawyer and the domain from Part 0.

> **Approval gate.** This part creates the first paid resource (Supabase Pro) and the first production deployment. An AI assistant must stop and ask before doing either.

## 3.1 Environments

- [ ] **Staging:** a Supabase Free project. It pauses after a week idle, which is fine for staging. Synthetic data only.
- [ ] **Production:** Supabase Pro (US$25/month) in the **Mumbai** region. The region can't change without a migration.
- [ ] Apply migrations only through the CLI (`supabase db push`), from CI or a written checklist. Never change the production schema by hand in the dashboard.
- [ ] Secrets:
  - Supabase function secrets for server keys.
  - EAS environment variables per build profile.
  - Cloudflare environment variables for the web app.
  - The service-role key never appears in either client or in the repo.
- [ ] Email:
  - Custom SMTP through Resend (free tier) on your domain, with SPF, DKIM and DMARC records.
  - Brand the auth email templates (verify, reset, invite).
  - Supabase's built-in sender can't be used. It only reaches your own team, at 2 emails an hour.
- [ ] Web: deploy staging and production to Cloudflare Workers (OpenNext adapter) on your domain.
- [ ] Universal links (`apple-app-site-association`) and Android app links (`assetlinks.json`) on the domain, so invitation and reset links open the app.
- [ ] Backups:
  - Supabase Pro's daily backups are kept 7 days.
  - Add a weekly `pg_dump` **and** a copy of storage files to a separate encrypted bucket (GitHub Actions on a schedule). Database backups don't include photo or media files.
  - Do one restore drill into staging and write down the steps.
- [ ] Monitoring:
  - Sentry on mobile, web and edge functions, with personal data scrubbed.
  - A free uptime check on the web app and one edge function.
  - Alerts to your email and phone.
- [ ] `app_config.min_supported_version` plus a **Please update** screen. This must exist before anyone has an old build installed.

## 3.2 Basic measurements

A subset of Part 5, built on the final data model so nothing is redone.

- [ ] `measurement_definitions` with a global standard set:
  - weight (kg) and height (cm)
  - body fat (%)
  - chest, waist, hip, neck, shoulders, arms, thighs and calves (cm)
- [ ] `measurement_entries`: subject, workspace, definition, value and unit as entered, canonical value, measured date, recorded by, optional note.
- [ ] Trainer or member can record. History is listed by date.
- [ ] A simple line chart per measurement. **Gaps stay gaps**: a missing entry is never drawn as zero.

## 3.3 Owner basics

- [ ] Overview (mobile and web):
  - active member count
  - trainers and how many clients each has
  - members without a plan
  - workouts logged this week
- [ ] Member search; archive and restore a member (archived members don't count toward limits).
- [ ] Physical gym membership: start date, end date and status. This records the member's gym membership, not payments and not the gym's Gravn subscription.
- [ ] A list of memberships expiring in the next 7 and 30 days.

## 3.4 Notifications v1

- [ ] Firebase project for Android push (FCM v1 credentials uploaded to EAS) and an APNs key through EAS credentials.
- [ ] Ask for notification permission in context, the first time a plan is assigned. Never ask at launch.
- [ ] `push_tokens` table, refreshed on login and removed on logout.
- [ ] An edge function sends through the Expo push service and checks delivery receipts.
- [ ] Events:
  - workout assigned or updated (to the member)
  - membership expiring (to the owner, and to the member if the gym enables it)
- [ ] Each notification has a unique dedupe key, so the same event is never sent twice.
- [ ] Payloads carry generic text and IDs only. Never measurements, photos or notes.
- [ ] Tapping a notification deep-links to the right screen, and the app checks access before showing anything.

## 3.5 Privacy and legal minimum

- [ ] Privacy policy, terms of use and a support page on the web, reviewed by the lawyer. Link them from sign-up and from Settings.
- [ ] Record which version of the terms and privacy policy each user accepted (`consents` table).
- [ ] Age policy at sign-up, as decided (D-07): 18+ only, or a parental-consent flow.
- [ ] **In-app account deletion v1:**
  1. Settings → Delete account → sign in again to confirm → see what will be deleted and when.
  2. A scheduled job deletes the user's rows, stored files and push tokens, then the auth user.
  3. A confirmation email is sent.
  4. Logging in is disabled immediately; the data itself is deleted by the job.
- [ ] **Public deletion request page** on the web (Google Play requires one): enter email → verification link → confirm → status page.
- [ ] `PRIVACY_DATA_MAP.md` v1: each data category, where it's stored, who can see it, how long it's kept, and every SDK that receives data (Sentry, Expo push, Resend).
- [ ] Optional now, required in Part 5: data export v1 (JSON of the user's own records).

## 3.6 Test distribution

**iOS**
- [ ] Create the App Store Connect app record.
- [ ] TestFlight internal testing (your Apple ID), then external testing for pilot members. The first external build goes through Beta App Review, so give it demo accounts.

**Android**
- [ ] Create the Play Console app. Upload to internal testing, then to a **closed testing** track.
- [ ] Get at least 12 testers opted in; Google's 14-day continuous clock starts now (personal accounts only).
- [ ] Complete the Play items closed testing needs: privacy policy URL, Data safety form, app access instructions with a demo login.

**Both**
- [ ] Icon, app name and short description for testers.
- [ ] Draft the App Store privacy "nutrition label" answers now; they're needed in Part 8.
- [ ] Start `RELEASE_CHECKLIST.md` with the steps for pilot builds.

## 3.7 Pilot onboarding kit

- [ ] One-page quick starts: owner, trainer, member install (TestFlight link and Play testing link). English now; Malayalam if pilots ask.
- [ ] Support: a support email and a WhatsApp Business number (handled manually, no automation).
- [ ] In-app **Report a problem** that records app version, device and screen (no personal data beyond the user ID).
- [ ] An onboarding checklist you can follow with an owner in under an hour: create the gym → invite trainers → add members → build the first program during the visit → a member installs and logs a set.
- [ ] Pilot success metrics agreed ([04-pilot-run.md](04-pilot-run.md)).

## 3.8 Engagement: weekly streak and coach high-fives

Design: [ref-engagement.md](ref-engagement.md). These two give pilot members a reason to come back every week, and give trainers a one-tap way to motivate clients.

**Weekly streak**
- [ ] A week counts when the member completes their weekly target: the session count of their assigned plan, or a personal goal (default 2) for self-guided users.
- [ ] Rest days never break a streak; there are no daily streaks.
- [ ] One automatic freeze every 4 weeks. Trainers can pause a client's streak for injury, illness or travel. Freezes are never sold.
- [ ] Today shows the streak ("6-week streak") and this week's progress ("1 of 3 sessions").
- [ ] Supportive copy when a streak ends ("New streak starts this week"). No guilt messages.
- [ ] Computed on the server from synced sessions, in the member's timezone, idempotent.

**Coach high-fives**
- [ ] One tap on a client's finished session sends a high-five, with an optional one-line comment.
- [ ] The member gets a push notification and an inbox item ("Coach Anu high-fived your workout").
- [ ] The trainer's client list highlights new sessions and PRs since their last visit.

## Tests

- [ ] Deletion integration test: after processing, the user's rows, stored files, push tokens and auth user are gone, and audit entries no longer identify them.
- [ ] Deletion page: verification link expires; it can't delete someone else's account.
- [ ] Push dedupe: the same event triggered twice sends once.
- [ ] Streak: rest days don't break it; a freeze or trainer pause keeps it; a week that ends at midnight in the member's timezone counts correctly; recomputing never double-counts.
- [ ] High-fives: only the member's assigned trainer can send one; one per trainer per session.
- [ ] Measurement chart with missing dates draws gaps.
- [ ] Forced update: an old build version sees the update screen.
- [ ] Restore drill completed and timed.
- [ ] The full Part 2 acceptance demo re-run against **production** with a test gym, which is then deleted.

## Acceptance demo

1. Onboard a test gym from nothing in under an hour using only the onboarding kit.
2. A member installs from TestFlight (iPhone) and the Play closed test (Android) and logs a workout.
3. The owner sees the workout on the web dashboard; an expiring membership appears in the list.
4. The member deletes their account in the app; it's gone from the database and storage.
5. Someone requests deletion through the web page and completes it.
6. A trainer high-fives a member's session. The member gets the notification, and Today shows the streak and this week's progress.

## Exit checklist

- [ ] Production and staging running; migrations reproducible
- [ ] Backups and restore drill done
- [ ] Monitoring and alerts verified by triggering a test error
- [ ] Legal pages live and linked
- [ ] TestFlight and Play closed testing working; 14-day clock started
- [ ] Onboarding kit ready

## Costs this part

| Item | Cost |
|---|---|
| Supabase Pro | US$25/month (~₹2,500), from the first real gym |
| Resend, Cloudflare Workers, Sentry, uptime check | Free tiers |
| Legal pages and review | ₹20,000–50,000 (report's range) |
| Business registration and accounting setup | ₹15,000–30,000 (report's range) |

## Risks

| Risk | Mitigation |
|---|---|
| Legal pages not ready | Engage the lawyer in Part 0; the pilot can't start without them |
| Beta App Review rejects the first external build | Give demo accounts per role and clear review notes; no hidden reviewer-only behaviour |
| Testers drop out and reset Google's 14-day clock | Recruit 15–20; check the count weekly |
| Email lands in spam | SPF, DKIM, DMARC on day one; test with Gmail and Outlook |
