# Part 6: Owner operations and notifications

**Build prompt milestone:** the rest of M4.
**Goal:** owners can run their gym's day-to-day from the web dashboard, with essential actions on mobile. Notifications are complete and respect preferences, and you can see when something breaks.
**Effort:** 3–4 weeks full-time (including the engagement items in 6.8).
**Depends on:** Part 3. Use the pilot's feedback (Part 4) to cut or reorder items.

## 6.1 Owner web dashboard

- [ ] Overview:
  - active members (and how they're counted)
  - trainers and their client counts
  - workouts logged per week (trend)
  - members without a plan
  - memberships expiring soon
- [ ] Members table: search, filters (trainer, membership status, last workout), bulk invite.
- [ ] Member detail: membership dates and status, trainer, plan, recent activity, measurements (if the owner may see them; decision D-12).
- [ ] Trainers: list, clients per trainer, reassign clients, remove a trainer (access ends immediately).
- [ ] Settings: gym profile, staff, notification defaults, data and privacy info.
- [ ] Layout built for desktop (sidebar, tables, filters) and still usable on a tablet.

## 6.2 Physical gym memberships and attendance

- [ ] Membership records: plan name (free text), start and end dates, status (active, paused, expired, cancelled), notes. **No payment collection.** Payments for physical memberships stay manual in the MVP.
- [ ] Manual attendance: staff tap members on a quick check-in list (mobile). Shows today's count and each member's history.
- [ ] Keep this clearly separate from the gym's Gravn subscription (Part 7) in both the UI and the data.

## 6.3 Notifications, complete

- [ ] In-app notification inbox: list, read/unread, tap to open (with an access check).
- [ ] Preferences per type (workout assigned or updated, trainer feedback, membership reminder) and per channel (push; email optional).
- [ ] Quiet hours in the user's timezone. Reminders scheduled for a sensible local time (for example 9 am).
- [ ] Membership reminders 7, 3 and 1 days before the end date (configurable per gym), to the owner and optionally to the member. Sent by a scheduled job (`pg_cron`), with dedupe keys.
- [ ] No sensitive data in payloads or email subjects.

## 6.4 Faster onboarding

- [ ] CSV import of members as pending client records: name, phone, email, membership dates. Preview, validation and a duplicate check before anything is saved. Members still claim their record by invitation.
- [ ] Owner setup checklist in the app: add trainers → add members → assign first plan → first workout logged.

## 6.5 In-app gym branding (extension point)

- [ ] `workspace_branding`: logo and one accent colour, shown in the app header and on the owner dashboard for that gym's members.
- [ ] Reject accent colours that fail contrast against the dark theme.
- [ ] Gated to the Professional tier in Part 7. White-label apps stay deferred.

## 6.6 Platform admin (web only)

- [ ] Workspaces list: type, member count, plan or trial status (read-only until Part 7), created date, last activity.
- [ ] Moderation queue (from Part 5).
- [ ] Deletion requests and their status.
- [ ] Pilot metric views (from Part 4).
- [ ] Every admin action writes an audit event.
- [ ] No impersonation of users. Support works from audit logs, the user's description and screenshots they choose to send.

## 6.7 Operations and monitoring

- [ ] Scheduled jobs list with last run and result (reminders, deletion processing, export cleanup, invitation expiry, backup job). Alert when one fails.
- [ ] Sentry alerts for new error types and crash spikes.
- [ ] Supabase usage review: database size, storage, egress, slow queries. Add indexes for any slow query.
- [ ] Runbooks in `docs/runbooks/`:
  - restore from backup
  - rotate a leaked key
  - lock a compromised account
  - roll back a bad migration
  - handle a suspected data breach

## 6.8 Engagement: weekly recap, smart reminders and gym challenges

Design: [ref-engagement.md](ref-engagement.md).

- [ ] **Weekly recap** every Sunday evening in the member's timezone: sessions, volume, PRs, streak and next week's plan. In-app first; push only if allowed. Trainers get one for their clients, owners one for the gym.
- [ ] **Smart reminders** on planned training days at the member's usual time ("Leg day is ready"). A streak reminder only if this week's target is still reachable, at most once a week.
- [ ] A hard cap of **3 nudges per member per week** across all types, enforced on the server, plus quiet hours and per-type preferences.
- [ ] **Gym challenges:** the owner creates a monthly challenge (for example "12 sessions in October"); members opt in.
- [ ] **Consistency boards:** rank sessions or streak weeks, never weight lifted. Display name and count only, visible only inside that gym, leave any time, and never shown to members under 18.

## Tests

- [ ] Dashboard counts: active members exclude archived ones and count pending invitations per the rules in [ref-permissions.md](ref-permissions.md#counting-members).
- [ ] Reminder job sends once per member per threshold, in the right timezone, and respects opt-out and quiet hours.
- [ ] Attendance permissions: staff can record; members can only see their own.
- [ ] Nudge cap: no member gets more than 3 nudges in a week across all types; quiet hours and opt-outs respected.
- [ ] Challenge boards show only opted-in members of that gym, and no weights.
- [ ] CSV import rejects bad rows and doesn't create duplicates.
- [ ] Playwright: owner signs in, finds a member, reassigns their trainer, and sees the change on the trainer's phone.

## Acceptance demo

1. The owner imports 20 members from CSV, invites them, and assigns trainers in bulk.
2. A membership set to expire in 3 days triggers one reminder at the right local time.
3. Staff record attendance on a phone; the owner sees today's count on the web.
4. A trainer is removed and loses access immediately; their clients appear as "needs a trainer".
5. A test error fires an alert to your phone.
6. A member receives the Sunday recap. The owner starts a monthly challenge, two members join, and the board shows their session counts.

## Exit checklist

- [ ] Acceptance demo passes; web checked on a laptop and a tablet
- [ ] Runbooks written
- [ ] CI green

## Costs this part

None new. Email reminders may push Resend past its free 3,000 a month at around 2,000 members (Resend Pro is US$20).

## Risks

| Risk | Mitigation |
|---|---|
| Reminder spam or duplicates | Dedupe keys and per-type preferences; test with clock changes |
| Dashboard numbers don't match what owners count | Show how each number is calculated; agree definitions with pilot owners |
| Attendance unused | Build only if the pilot shows demand; it's marked incremental in the prompt |
