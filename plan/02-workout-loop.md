# Part 2: Workout loop

**Build prompt milestone:** M2.
**Goal:** the core loop works end to end. The owner adds a trainer and a member, the trainer builds and assigns a plan, the member logs the workout (even offline), and the trainer reviews the synced result.
**Effort:** 3–5 weeks full-time (streamlined per D-59, D-60, D-61).
**Depends on:** Part 1.

## 2.0 Spike first (1–2 days)

Before building screens, prove the local persistence and notification pieces work:

- [ ] `expo-sqlite` with AES-GCM payload encryption (`expo-crypto` + key in `expo-secure-store`, matching session storage; see D-60). Write, kill the app, reopen, read.
- [ ] Encryption key generated on first run and stored in `expo-secure-store` with "when unlocked, this device only" accessibility, so iCloud and device-transfer backups never carry the key.
- [ ] A local notification scheduled for a rest-timer deadline fires with the app in the background and after a force-quit.

If any of these fail, solve them now; the rest of the part depends on them.

## 2.1 Exercise catalog (basic)

- [ ] Tables: `exercises`, `muscle_groups`, `equipment`, `exercise_media`, `exercise_favorites`.
  - Each exercise has an explicit scope: `global`, `workspace` or `personal`.
  - A check constraint ties the scope to the right owner column, so a missing owner can never mean "public".
- [ ] Load type per exercise: weighted, bodyweight, assisted, or timed.
- [ ] Seed about 60 synthetic exercises, including squat, bench press, deadlift, lateral raise, lat pulldown, bicep curl, leg extension, leg press, push-up, pull-up and plank. Every demo is a placeholder clearly labelled **"Placeholder: not licensed for release"**.
- [ ] Search by name (trigram or full-text), filters by muscle group and equipment, and favourites.
- [ ] Only platform publishers can change the global catalog. Add the RLS test.
- [ ] Custom exercises for everyone: anyone can create an exercise in seconds and choose what it tracks (see 2.8). Gym exercises are shared with that gym; personal ones stay private. Media uploads come in Part 5.

## 2.2 Program builder (trainer, mobile and web)

- [ ] Programs belong to a workspace. Structure: weeks → days → items. Accessible on both mobile and the web dashboard (`/w/[id]/programs`, D-58).
- [ ] Each item has: exercise, order, number of sets, target reps (single number or a range), target weight and unit, rest in seconds, instructions and notes.
- [ ] Reorder items with drag handles **and** up/down buttons, so it works with a screen reader.
- [ ] Duplicate a program, and "copy for a client" (a client-specific copy the trainer can then adapt).
- [ ] Versioning:
  - Editing works on a draft.
  - **Publish** creates an immutable `program_version`.
  - Assignments point at a version.
  - Sessions keep a snapshot of what was planned. A later template edit never rewrites a finished session or changes a workout in progress.
- [ ] Assign a version to one or more clients with a start date. End or replace an assignment.
- [ ] Schedule model (decision D-10): fixed weekdays ("Mon/Wed/Fri") or a sequence ("next workout is Day 2"). Proposed default: sequence, with optional weekday hints. Ask pilot trainers.

## 2.3 Member: Today and workout logging

- [ ] **Today** shows the next planned workout from the active assignment, or a clear empty state ("Your trainer hasn't assigned a plan yet").
- [ ] Workout overview: exercises, instructions, demo player (placeholder media), and **Start**.
- [ ] Set entry, designed for one hand:
  - Large weight and reps steppers.
  - Decimal weights (2.5 kg steps; any decimal by typing).
  - Bodyweight and zero-weight sets.
  - Mark complete, add or remove a set, notes.
  - Skip an exercise with a reason.
- [ ] Every set has an explicit state, with distinct visuals that don't rely on colour alone:
  - **Not recorded** (null, no data)
  - **Zero** (0 entered on purpose)
  - **Completed**
  - **Incomplete**
  - **Skipped**
- [ ] Previous comparable performance per exercise: the last completed session with the same exercise (and the same plan item when available).
- [ ] Rest timer:
  - The deadline (`ends_at`) is saved in SQLite, and a local notification is scheduled for it.
  - The countdown is always computed from the deadline, so backgrounding or a restart never corrupts it.
- [ ] Finish shows a summary: completed and skipped sets, total volume, duration, and the comparison with last time.
- [ ] Units:
  - Store the value and unit exactly as entered, plus a canonical kg column for comparisons.
  - Display follows the user's preference.
  - Conversion functions live in `packages/shared` with tests.
  - Changing the display unit never rewrites stored values.

## 2.4 Offline storage and sync

Full design: [ref-architecture.md, Offline sync](ref-architecture.md#offline-sync).

**Local storage**
- [ ] One SQLite database per user (file named from a hash of the user ID), with sensitive payloads encrypted via AES-GCM (`expo-crypto` + key in `expo-secure-store`, D-60). Tables carry `workspace_id`.
- [ ] Cache: the active assignment's plan snapshot, the exercise metadata it needs, session and set drafts, and the outbox.
- [ ] Write-through: every meaningful edit (a set value, a completion, a skip) is written to SQLite first, then queued as an operation with a client-generated UUID.

**Sync engine**
- [ ] Runs when the app comes to the foreground, when connectivity returns (NetInfo), shortly after edits (debounced), and from a manual **Retry** button.
- [ ] Exponential backoff with jitter. Each operation shows its own state: pending, synced or error.
- [ ] A small status indicator shows pending, synced, or needs attention.

**Server**
- [ ] `sync_push(ops jsonb)` RPC:
  - Checks the caller owns each operation's subject and still has access to the workspace.
  - Is idempotent through a unique `(user_id, op_id)` in `sync_operations`.
  - Upserts by client IDs (Last-Write-Wins per set/session; D-59) and returns a result per operation.
- [ ] Conflicts (D-59):
  - Rows carry a `revision`, and each operation sends the `base_revision` it was made from.
  - On a mismatch, the server applies LWW and logs both versions in `sync_conflicts` for diagnostics (no 3-way conflict UI on mobile).
- [ ] Pull: fetch the current assignment, version and exercises after login, on foreground, and after a push.

**Access and lifecycle**
- [ ] On reconnect, call `get_my_access()` and purge local data for any workspace the user lost access to. The offline limit (cached data stays visible until the next connection) goes in `PERMISSIONS.md`.
- [ ] Sign-out with unsynced operations: explain what's pending, then offer **Sync now** or **Discard and sign out** (with confirmation). Another account on the same phone never sees those drafts, because each user has a separate encrypted database.
- [ ] Android: turn off auto-backup for app data (`android.allowBackup: false`, or backup rules). iOS: the database is encrypted and its key never leaves the device.

## 2.5 Trainer review and feedback

- [ ] Client list showing assigned clients only, with last workout date and adherence (sessions completed vs planned this week).
- [ ] Client detail: current assignment, recent sessions, missing-plan warning.
- [ ] Session detail: planned vs actual for each set, skipped exercises with reasons, notes.
- [ ] Feedback thread on a session: trainer comments, member replies, visible to both. Trainer-only private notes come in Part 5.
- [ ] Owner basics needed for the loop: add trainer and member (Part 1 invites), assign a trainer to a member, see members without a plan.

## 2.6 Moment feedback (engagement layer, first slice)

Design: [ref-engagement.md](ref-engagement.md). This is what makes logging feel rewarding from the first workout.

- [ ] A light haptic tap (`expo-haptics`) and a quick check animation on every completed set. Never slows the next input.
- [ ] A distinct haptic when the rest timer ends. Sound is optional and off by default.
- [ ] Live PR detection on the phone against cached history: heaviest weight for at least 1 rep, and most reps in a bodyweight set. Shown as provisional and confirmed by the server after sync. Implausible jumps are held for confirmation, not celebrated.
- [ ] Finish screen: a short, skippable celebration in the brand's ember glow, then duration, sets, volume, the **comparison with last time** in plain words, PRs earned, and **what's next** (the next workout's name and day).
- [ ] "Reduce motion" removes the animations; haptics can be turned off in settings.
- [ ] Log an `activity_events` row for session completed and PR, with no measurements or notes in it.

## 2.7 Training on your own (B2C, first slice)

Design: [ref-b2c.md](ref-b2c.md). Solo users have no trainer, so they need a way to train from day one.

- [ ] **Just log a workout:** a freestyle session where the member picks exercises as they go, with the same set entry, rest timer, PRs and offline sync.
- [ ] **Own routines:** the program builder also works inside the personal workspace, so solo users can build and follow their own routines.
- [ ] Today shows the next session of the member's own routine, or offers "Just log a workout" when there's no plan.

## 2.8 Flexible workouts (first slice, streamlined per D-61)

The default path stays as fast as the best trackers: weight × reps, one tap to complete. Every advanced option sits behind **More** on the set or exercise, so flexibility never slows down basic logging.

**What an exercise tracks** (chosen when the exercise is created; overridable per program item)
- [ ] Schema supports all tracking types; Part 2 UI ships `weight_reps` (default), `reps` (bodyweight), and `time` (holds, planks). Additional types (`added_weight`, `assisted`, `distance`, `distance_time`) follow in Part 5.

**Sets and targets**
- [ ] Set types in Part 2 UI: `warmup`, `working`, and `failure` (schema also includes `drop` and `amrap`). Warm-ups never count towards PRs or volume.
- [ ] Targets: single reps, a range (8–12), or time; optional RPE and a note on any set. (Per-set target pyramids deferred until requested by pilot trainers.)

**Structure**
- [ ] Straight sets and supersets (group two or more exercises that alternate, with rest after each round).

**Editing**
- [ ] Mid-workout: add or remove sets, skip an exercise with a reason, or add an exercise that wasn't planned. The plan snapshot keeps what was planned; the log keeps what happened.
- [ ] Save any workout, including a freestyle one, as a routine; duplicate routines.
- [ ] A unit per exercise when needed (a kg barbell, a lb dumbbell set); increments remembered per exercise. (Retroactive past-workout streak/badge recomputation deferred to Part 5.)

## 2.9 Timers (first slice)

Every timer is stored as an end time, not a running counter, so it stays accurate when the app is in the background, the phone is locked, or the app is closed. A local notification fires when it ends.

- [ ] **Rest timer:** starts automatically when a set is completed. Default rest comes from the plan, adjustable per exercise and per set, with ±15-second buttons and Skip. A distinct haptic and sound when rest ends.
- [ ] **Countdown for timed sets** (planks, holds, timed carries): a 3-2-1 get-ready, then the countdown, with the time logged automatically.
- [ ] **Stopwatch** for timed efforts with no target (counts up), logged as the set's time.
- [ ] **Cues:** timer sounds and haptics are on by default, because they're functional (unlike celebration sounds, D-29). They briefly lower the member's music instead of stopping it, and each can be turned off.

## Tests

**Unit**
- [ ] Unit conversion and rounding
- [ ] PR detection: heaviest weight, bodyweight reps, mixed kg/lb history, 0 kg sets, and an implausible jump held for confirmation
- [ ] Every tracking type logs, syncs and summarises correctly; volume and total lifted count only weight × reps, and never warm-up sets
- [ ] Timers stay correct after backgrounding, locking, closing and reopening the app, and after the phone's clock changes
- [ ] Set-state rules (null vs 0 vs incomplete vs skipped)
- [ ] Schedule rules (which day is "today")
- [ ] Backoff timing
- [ ] LWW sync and diagnostic conflict logging
- [ ] Previous-performance lookup

**Database**
- [ ] A member can only write their own sessions
- [ ] A trainer can read sessions of assigned clients only
- [ ] Replaying the same operation twice creates one row
- [ ] An operation pointing at another tenant's IDs is rejected
- [ ] An edited template leaves completed sessions unchanged

**Integration**
- [ ] Push the same batch twice
- [ ] Push batches out of order
- [ ] Revoke access mid-queue

**End to end (Maestro, Android emulator)**
- [ ] Log a workout offline, reconnect, and see it synced

**Manual, on Android (iOS deferred per D-40)**
- [ ] Airplane mode during logging
- [ ] Force-quit mid-workout
- [ ] Phone restart
- [ ] Low battery mode
- [ ] Rest timer while the screen is locked

## Acceptance demo

1. The owner (web) adds a trainer and a member, and assigns the trainer.
2. The trainer (web or phone) builds a 3-day program, publishes it, and assigns it to the member.
3. The member (phone) turns on airplane mode, opens Today, and logs a workout:
   - 0 kg bodyweight sets and 2.5 kg increments
   - one exercise skipped with a note
   - a superset of two exercises, a timed plank with a countdown, and a set to failure
   - adding an extra exercise mid-workout that wasn't planned
   - one set heavier than the member's best, which shows a live PR and then the finish celebration with "what's next"
   - the rest timer running while the app is in the background
   - a force-quit mid-workout, then reopening and finishing
4. The member goes online. The status shows synced, and replaying the queue creates no duplicates.
5. The trainer edits the template. The member's finished session is unchanged.
6. The trainer reviews the session and comments; the member replies.

## Exit checklist

- [ ] Acceptance demo passes on Android and web, recorded separately
- [ ] CI green, including the new database and unit tests
- [ ] Sync design and offline limits documented in `ARCHITECTURE.md` and `PERMISSIONS.md`
- [ ] Schema changes reflected in generated types

## Costs this part

₹0.

## Business tasks in parallel

Lawyer drafts the legal pages; sign pilot agreements; recruit Android testers; build a simple landing page; collect gym logos and sample workouts for pilot setup.

## Risks

| Risk | Mitigation |
|---|---|
| Sync takes far longer than planned | Keep offline scope to the active session and current plan; LWW sync without conflict UI (D-59); spike first |
| Notification issues on Android | Section 2.0 spike on a physical phone before building screens |
| Trainers find the builder slower than WhatsApp | Web program builder available alongside mobile (D-58); add templates and "copy last week" before more features |
