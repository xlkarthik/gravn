# Part 5: Progress, media and privacy

**Build prompt milestone:** the rest of M3.
**Goal:**
- Members and trainers can track progress properly: custom measurements, charts, personal records and private progress photos.
- Exercise demos are real and licensed.
- Users control who sees what, can export their data, and can delete everything.

**Effort:** 7–8 weeks full-time (including the engagement items in 5.9, the consumer programs in 5.10, and the flexible workouts and timers in 5.11).
**Depends on:** Part 3; runs during the pilot (Part 4).

## 5.1 Exercise media and custom exercises

- [ ] Media format:
  - Short looping MP4 (H.264), muted, 720p or lower, 3–15 seconds, a few MB at most, plus a poster thumbnail.
  - Prefer MP4 over GIF: GIFs are several times larger for the same clip.
- [ ] Storage bucket for exercise media:
  - Global catalog media can be public or behind signed URLs (decision D-15).
  - Gym custom media is private to that workspace.
  - Set the bucket's allowed MIME types and maximum file size.
- [ ] Upload workflow for trainers and owners (custom exercises):
  - Pick or record a video, with client-side checks on type, size and duration.
  - Upload to a pending path. A server function checks the file's real type (magic bytes, not the extension) before marking it ready.
  - Rejected files are deleted, and the user is told why in plain words.
- [ ] Player: `expo-video` with caching for the current plan's exercises, a thumbnail, and an accessible play/pause.
- [ ] Review status:
  - Custom content is labelled **"Added by your gym"**.
  - Only platform-reviewed global content is shown as reviewed.
  - Nothing user-uploaded is presented as reviewed coaching guidance.
- [ ] Personal users can create private exercises, visible only to them.
- [ ] **Asset licence manifest:**
  - Each global media file records its source, rights holder, licence, whether commercial use is allowed, and a link to the release form or licence proof.
  - Kept as a `media_assets` table *and* `docs/asset-licenses.csv` in the repo.
- [ ] Film your own core library (40–60 moves) with a pilot gym's trainer, with signed releases. Replace the placeholders and record each in the manifest.
- [ ] List any missing release assets in `STATUS.md`. Never fill gaps with media you don't have rights to.

## 5.2 Custom measurements

- [ ] Workspaces (and personal users) can define custom numeric measurements:
  - label
  - unit kind (length, mass, percent, count, time) and unit
  - minimum, maximum and decimal places
  - optional description
- [ ] Definitions are versioned:
  - Changing a label or unit creates a new version.
  - Old entries keep the label and unit they were recorded with.
  - Retired definitions are archived, never deleted, so history survives.
- [ ] Entry screens validate against the definition's rules and show the unit clearly.

## 5.3 Charts and progress

- [ ] Date filters: 4 weeks, 12 weeks, 6 months, 1 year, all time (subject to the free-history window in Part 7).
- [ ] Measurement charts: one series per chart, gaps for missing dates, values in the user's display unit.
- [ ] Workout history: calendar or list of sessions with completion status.
- [ ] Completion consistency: planned sessions completed per week, as a percentage.
- [ ] Personal records, each with a written definition shown in an "How this is calculated" sheet:
  - Heaviest weight lifted for at least 1 rep.
  - Estimated one-rep max, using Epley: `weight × (1 + reps / 30)`, only for sets of 1–10 reps, labelled as an estimate.
  - Most reps in a bodyweight set.
  - Highest session volume for the exercise (sum of weight × reps).
- [ ] Unit tests for every formula, including edge cases: 0 kg, missing reps, mixed units.
- [ ] No clinical interpretation, health scores or "transformation" ratings.
- [ ] Mobile charts: decide after a short spike (D-16; for example victory-native, which uses Skia, or react-native-gifted-charts). Check compatibility with the current Expo SDK.

## 5.4 Progress photos

- [ ] Take or pick a photo. Before upload, resize to about 1440 px on the long side and re-encode to JPEG at roughly 300 KB. Re-encoding drops the original metadata (EXIF, GPS); confirm with a test file that has GPS data.
- [ ] Private bucket, path `user_id/photo_id.jpg`. Storage policies allow only the owner, or someone with an active share, to read.
- [ ] View through short-lived signed URLs (a few minutes). **Not cached offline by default.**
- [ ] Timeline, optional note, and side-by-side comparison of two dates.
- [ ] Delete removes the file and the row.
- [ ] Sharing:
  - The member grants a specific trainer access to specific photos (or "all photos") for coaching.
  - The screen explains exactly who will see them.
  - Revoking takes effect on the next request.
  - **Owners have no access** unless the member shares with the owner as a person.
- [ ] A consent record for each share, worded so it's clearly not permission for marketing use.

## 5.5 Notes

- [ ] Two kinds, labelled clearly everywhere they appear:
  - **"Private to trainers"**: visible to the gym's trainers and owner, never to the member.
  - **"Shared with member"**.
- [ ] The member's view never includes private notes, and the API can't return them to the member (RLS test).

## 5.6 Personal history and gym data

- [ ] Joining a gym doesn't share anything from the member's personal workspace.
- [ ] Optional explicit grant: "Share my personal workout history with Trainer X", with the same revoke behaviour as photos.
- [ ] Leaving a gym follows the rules in [ref-permissions.md](ref-permissions.md#leaving-a-gym). Implement them and show the member what happens before they leave.

## 5.7 Export and full deletion

- [ ] **Export:**
  - The member requests an export of their own records: profile, sessions and sets, measurements, shared notes and comments, and optionally photos.
  - A server function builds JSON and CSV files plus a photos zip, and stores them privately.
  - The member gets a signed link that expires within 24 hours. Old exports are deleted automatically.
- [ ] **Full deletion** extends the Part 3 version to cover photos, exports, media they uploaded, shares and conflicts. Audit entries are pseudonymised (the user ID is replaced).
- [ ] The deletion screen explains that deleting the account doesn't cancel an App Store or Play subscription. It links to the store's manage-subscription page and doesn't block deletion. This matters once Premium exists in Part 7.

## 5.8 Reporting and blocking

Needed before public release because users can share content: comments, custom exercise media and shared photos.

- [ ] Report a comment or custom exercise, with a reason.
- [ ] Block a user, which hides their comments from you.
- [ ] Platform-admin moderation queue on the web: review, remove content, warn or suspend. Every action is audited.

## 5.9 Engagement: total lifted, milestones and share cards

Design: [ref-engagement.md](ref-engagement.md).

- [ ] **Total lifted:** a lifetime sum of weight × reps over completed sets, in kg or tonnes, as Gravn's signature number. Real-world comparisons at milestones (a car ~1.5 t, an elephant ~6 t, a city bus ~12 t, a blue whale ~150 t). Bodyweight sets count towards session milestones, not tonnage.
- [ ] **PRs, complete:** add estimated 1-rep max (labelled as an estimate) and best session volume to the live detection from Part 2, with the same one-celebration-per-type rule.
- [ ] **Milestones and badges:** a server-defined catalog of about 20 (sessions 1/10/25/50/100; streaks 4/12/26/52 weeks; total lifted 1/10/50/100/250 t; first PR; PRs in squat, bench, deadlift and overhead press; a full month on plan). Awarded on the server after sync, idempotent, never bought. Calm visuals in the logo's style.
- [ ] A profile view of badges, total lifted, best lifts and streak history.
- [ ] **Share to socials:** every badge, milestone, PR, streak milestone, total-lifted milestone, finished workout and weekly recap gets a branded card in Story (9:16) and feed (4:5) formats, rendered on the phone. Details in [ref-engagement.md](ref-engagement.md#8-share-to-instagram-and-socials-part-5).
- [ ] **One-tap Instagram Stories** through Meta's Sharing to Stories, using the Facebook App ID from Part 0. Everything else (WhatsApp and Status, Facebook, X, Snapchat, Telegram) goes through the system share sheet. Plus **Save to Photos** with add-only permission.
- [ ] **Share preview** with toggles: show weights, show my name, show my gym. Measurements and progress photos never appear on a card.
- [ ] A **Share** button on big celebrations only, once per moment, and a setting to hide share prompts.
- [ ] Sharing is always started by the member: no auto-posting and no social logins. Log only an anonymous share event.
- [ ] Achievements, total lifted, streaks and high-fives are included in data export and removed on account deletion.

## 5.10 Training on your own: Gravn programs and setup

Design: [ref-b2c.md](ref-b2c.md#training-without-a-trainer-gravn-programs).

- [ ] **Gravn program library:** 6–8 programs written and reviewed by a qualified coach (D-37): beginner full body, upper/lower, push/pull/legs, 5×5 strength, dumbbell-only home, bodyweight, and return to training. Stored as global programs with the same builder, versioning and logging as gym programs.
- [ ] **60-second setup:** goal, experience, days per week and equipment, then a recommended program, with "I'll build my own" and "Just log a workout" always available.
- [ ] **Progression suggestions:** when every set of an exercise hits its target reps, suggest a small increase next session, using the coach's rules for that program. Always overridable and labelled as a suggestion.
- [ ] A short safety notice at setup (train within your limits; stop if you feel pain; check with a doctor if you have a medical condition). No medical claims.
- [ ] Program content goes through the same review status and licence records as exercise media.

## 5.11 Flexible workouts and timers, complete

Builds on 2.8 and 2.9.

- [ ] **Circuits and blocks:** circuits (several exercises in rounds), EMOM (every minute on the minute), AMRAP (as many rounds as possible within a time cap) and custom interval blocks, in programs and routines.
- [ ] **Interval timer:** any work/rest pattern (Tabata 20/10 × 8, HIIT, EMOM) with rounds, a get-ready countdown, and beep or voice cues. Works with the screen locked; transitions are pre-scheduled as local notifications within each platform's limit.
- [ ] **Cardio:** treadmill, bike, rower, cross-trainer, running, walking, cycling, swimming. Log duration, distance, pace, calories, incline or level, and heart rate if known. Countdowns by time ("20 minutes") or by target distance, with halfway and final-minute cues.
- [ ] **Classes and sports:** log yoga, football, badminton, Zumba or anything else as a timed activity with notes; members can create their own activity types. Every completed workout of any kind counts towards the weekly streak; only weight × reps counts towards total lifted.
- [ ] **Advanced targets:** % of 1-rep max (weight calculated from the member's estimate), tempo (for example 3-1-1-0), left and right sides for single-arm or single-leg work, rest-pause and cluster sets.
- [ ] **Custom fields and machine settings:** add any number field to an exercise (seat height, incline, band colour, pin position); Gravn remembers the last settings per exercise.
- [ ] **Plate calculator:** which plates to load for a target barbell weight, using the bar and plates available (set per gym or per person).
- [ ] **Routine folders** for people with many routines.
- [ ] **PRs for every tracking type:** heaviest, most reps, longest hold, longest distance, fastest pace over a set distance.

## Tests

- [ ] Photo privacy matrix:
  - owner denied
  - unshared trainer denied
  - shared trainer allowed
  - after revoke, denied
  - signed URL fails after expiry
  - a direct storage path guess is denied
- [ ] The GPS test image has no location data after upload.
- [ ] Upload with a wrong type or oversized file is rejected; a renamed `.exe` is rejected by the server check.
- [ ] Definition change keeps old entries' label and unit.
- [ ] Chart gaps; personal-record formulas.
- [ ] Private notes never reach the member, including through direct API calls.
- [ ] Export contains everything the member owns and nothing they shouldn't see.
- [ ] Deletion leaves no rows or files for the user (scripted check).
- [ ] Badge engine: awards once, survives re-sync and replayed operations, and recomputes correctly after a session is edited or deleted.
- [ ] Total lifted matches a hand-calculated fixture, including mixed kg/lb history.
- [ ] Share cards never contain measurements or progress photos, and respect the weights, name and gym toggles.
- [ ] Sharing on both phones: Instagram Stories opens with the card as a sticker; the share sheet still works when Instagram isn't installed; Save to Photos asks only for add-only permission.
- [ ] Program recommendation gives a sensible program for every combination of goal, experience, days and equipment; progression suggestions follow each program's rules and never appear after a missed set.
- [ ] The interval timer runs a 20-minute EMOM and a Tabata accurately with the screen locked on both phones, and cues play over music without stopping it.
- [ ] Cardio, classes and sports sync, count towards the weekly streak, and never count towards total lifted.

## Acceptance demo

1. A trainer creates a custom measurement ("Resting heart rate", count). The member records it over several dates with one gap, and the chart shows the gap.
2. The member uploads a progress photo. The owner and an unassigned trainer can't open it. The member shares it with their trainer, who can, then revokes, and the trainer can't.
3. A trainer adds a custom exercise with a demo video, which plays on the member's phone.
4. The member exports their data and opens the files.
5. The member deletes their account; the scripted check finds nothing left.
6. A second member passes 1 tonne total lifted, sees the milestone with its comparison, posts the badge to Instagram Stories in one tap, and sends a PR card to WhatsApp.
7. A new solo user finishes setup in about a minute, gets a recommended program, logs the first workout the same day, and sees a progression suggestion at the next session.
8. A member runs a Tabata interval with the phone locked, logs a 20-minute treadmill countdown, and loads a barbell using the plate calculator.

## Exit checklist

- [ ] Acceptance demo passes on both phones
- [ ] Media manifest complete for every global demo; placeholders listed
- [ ] `PRIVACY_DATA_MAP.md` and `PERMISSIONS.md` updated
- [ ] CI green

## Costs this part

Filming ₹0–15,000. Program writing by a qualified coach: budget to agree, or trade free months with a pilot gym's head coach (D-37). Storage stays well inside Supabase Pro's 100 GB.

## Risks

| Risk | Mitigation |
|---|---|
| Video uploads are huge | Size and duration limits on the client and the bucket; a clear message on how to trim |
| Photo privacy bug | The test matrix above runs in CI; storage policies reviewed in Part 8 |
| Licensing gaps at launch | Film early in the pilot; launch with fewer exercises rather than unlicensed ones |
