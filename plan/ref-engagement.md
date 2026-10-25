# Reference: engagement layer

**Goal:** make every workout feel rewarding, so members *want* to come back tomorrow. Logging a day, finishing a session, beating last week's numbers or hitting a PR should each produce a moment worth returning for. This layer is also the foundation for the Gravn community later.

**Principle:** build a strong habit, not a compulsion. Reward real training, never app opens or screen time. Celebrate effort, make progress visible, and give people a reason to return, without guilt, fake urgency, or anything that pushes someone to train when they should rest. That keeps members healthy and gym owners on side, and it fits Gravn's premium, calm brand.

## The habit loop

| Stage | What Gravn does | Examples |
|---|---|---|
| **Trigger** | A well-timed, personal reason to open the app | "Push day is ready", a coach's high-five, the Sunday recap |
| **Action** | Make logging the fastest part of the workout | Today opens straight to the next set; one-tap complete |
| **Reward** | Specific, earned, sometimes surprising | Set-complete feel, a PR celebration, a milestone, "+7.5 kg on squat since March" |
| **Investment** | Something that grows the more they use it | Streak weeks, total lifted, badges, history, coach relationship, later followers |

Bigger rewards should be rarer and less predictable (a surprise milestone, a coach message) than the small ones on every set. Variety keeps them meaningful.

## Building blocks and where they're built

| # | Block | Part | Summary |
|---|---|---|---|
| 1 | Set feedback | [2](02-workout-loop.md) | Haptic tap and a subtle animation on every completed set |
| 2 | Session finish moment | [2](02-workout-loop.md) | Celebration screen: what you did, how it compares with last time, and what's next |
| 3 | Live PR detection | [2](02-workout-loop.md) (basic), [5](05-progress-media-privacy.md) (all PR types) | "New PR" appears the moment a set beats your best, even offline |
| 4 | Weekly streak | [3](03-pilot-readiness.md) | Weeks in a row hitting your training target; rest days never break it |
| 5 | Coach high-fives | [3](03-pilot-readiness.md) | Trainer taps once on a session; the member gets a notification |
| 6 | Total lifted | [5](05-progress-media-privacy.md) | Lifetime kilograms lifted, with real-world comparisons |
| 7 | Milestones and badges | [5](05-progress-media-privacy.md) | First workout, 10/50/100 sessions, streak weeks, tonnage marks, PRs in each main lift |
| 8 | Share to Instagram and socials | [5](05-progress-media-privacy.md) | Every badge, PR, streak, milestone, workout and recap as a branded card: one tap to Instagram Stories, the share menu for everything else |
| 9 | Weekly recap | [6](06-owner-ops-notifications.md) | A Sunday-evening summary of the week and a preview of next week |
| 10 | Smart reminders | [6](06-owner-ops-notifications.md) | A nudge on planned training days at the member's usual time, with a weekly cap |
| 11 | Gym challenges | [6](06-owner-ops-notifications.md) | Owner-run monthly challenges and opt-in consistency boards |
| 12 | Community | [9](09-launch-operations.md) backlog | Feed, follows, reactions and comments, built on everything above |

## Details

### 1. Set feedback (Part 2)
- A light haptic tap on each completed set (`expo-haptics`) and a quick check animation (under 300 ms).
- The rest timer ending gets its own distinct haptic. Sound is optional and off by default.
- Never slow down logging. Feedback must never block the next input.

### 2. Session finish moment (Part 2)
- A short celebration (under 1.5 seconds, skippable) in the logo's ember glow, then a summary:
  - duration, sets, total volume
  - **compared with last time**, in plain words ("+5 kg total on bench since last Monday")
  - PRs earned this session
  - streak status
- End with **what's next**: the next workout's name and day. Ending on a clear next step is the strongest reason to come back.
- With "reduce motion" turned on, show the summary with no animation.

### 3. Live PR detection (Part 2 basic, Part 5 full)
- Part 2 covers two PR types: heaviest weight for at least 1 rep, and most reps in a bodyweight set.
- Part 5 adds estimated 1-rep max (Epley, labelled as an estimate) and best session volume per exercise.
- Detection runs on the phone against cached history, so it works offline. It shows as provisional, and the server confirms it after sync.
- From Part 5, PRs cover every tracking type: longest hold, longest distance, fastest pace over a set distance.
- One celebration per PR type per exercise per session; never a pile-up.
- Implausible jumps (for example a lift several times higher than the member's best) are held for confirmation instead of celebrated, which stops typos or cheating from becoming records.

### 4. Weekly streak (Part 3)
- A week counts when the member completes their **weekly target**: the number of sessions in their assigned plan, or a personal goal (default 2) for self-guided users.
- Any completed workout counts towards the target, including cardio, classes and sports.
- Rest days never break a streak. Daily streaks are deliberately avoided, because they push people to train when they should recover.
- **Freezes:**
  - Members get one automatic freeze every 4 weeks.
  - Trainers can pause a client's streak for injury, illness or travel.
  - Freezes are never sold.
- The streak shows on Today ("6-week streak") along with this week's progress ("1 of 3 sessions").
- If a streak ends, the copy is supportive ("New streak starts this week"). No guilt, no "you lost everything".

### 5. Coach high-fives (Part 3)
- One tap on a client's finished session sends a high-five, with an optional one-line comment.
- The member gets a push notification and an inbox item: "Coach Anu high-fived your workout."
- The trainer's client list highlights new sessions and PRs, so high-fives take seconds. This is the earliest social reward, and it uses the trainer relationship gyms already have.

### 6. Total lifted (Part 5)
- A lifetime total of weight × reps across all completed sets, shown in kilograms or tonnes. It's Gravn's signature number.
- Real-world comparisons at milestones: a car (~1.5 t), an elephant (~6 t), a city bus (~12 t), a blue whale (~150 t). Fun, global and very shareable.
- Bodyweight sets aren't counted in tonnage, unless the user logs added weight. They count towards session and streak milestones instead.

### 7. Milestones and badges (Part 5)
- A server-defined catalog (start with about 20), awarded on the server after sync, so awards are consistent across devices and can't be forged by editing the app. Examples:
  - **Sessions:** 1st, 10th, 25th, 50th, 100th
  - **Streaks:** 4, 12, 26, 52 weeks
  - **Total lifted:** 1 t, 10 t, 50 t, 100 t, 250 t
  - **PRs:** first PR; PRs in squat, bench, deadlift and overhead press
  - **Consistency:** a full month on plan
- Calm, premium visuals in the logo's style: off-white marks, a single ember highlight. No cartoon confetti.
- Badges can never be bought.

### 8. Share to Instagram and socials (Part 5)
Every reward can be posted. Each share carries the Gravn brand to new people: the first growth loop, long before the community exists.

**What can be shared**
- Badges and milestones (including total-lifted comparisons: "I've lifted a city bus").
- Personal records.
- Streak milestones (4, 12, 26, 52 weeks).
- Finished workouts.
- The weekly recap.
- Challenge finishes.

**Where it goes**
- **Instagram Stories in one tap:** the card arrives as a movable sticker over a branded background, through Meta's *Sharing to Stories*.
  - This needs a free Facebook App ID. Since January 2023, Instagram shows "The app you shared from doesn't currently support sharing to Stories" without one.
  - Background images must be at least 720×1280.
- **Everything else through the phone's share menu:** Instagram feed and DMs, WhatsApp chats and Status, Facebook, X, Snapchat, Telegram and others. This works even when Instagram isn't installed.
- **Save to Photos,** using the add-only photo permission.
- **Later:** one-tap TikTok and Snapchat sharing through their developer kits, which need separate registration and review.

**The card**
- Two formats: Story (9:16, 1080×1920) and feed (4:5, 1080×1350).
- Rendered on the phone at high resolution; nothing is uploaded to Gravn.
- Gravn's dark style with the ember accent: the badge or number, the date, the member's display name if they choose, and a small Gravn logo with the website address.
- Optional gym logo when the gym turns on co-branding (D-32). Members can always remove it.

**Control and privacy**
- A preview before every share, with simple toggles: show weights, show my name, show my gym (defaults in D-31).
- Body measurements and progress photos are never put on a card.
- Sharing is always started by the member. Gravn never posts on anyone's behalf, never asks for social-media logins and never sees the member's social accounts.
- A **Share** button appears on big moments only (badge, PR, streak milestone), once per moment, never as a nag. A setting hides share prompts entirely.
- Gravn logs only an anonymous "shared a badge card" event, plus the destination where the phone reports it. It never keeps the image.
- No sharing for under-18s unless a parent allows it, if younger members are ever admitted (D-07).

**Build notes**
- `react-native-share`: Instagram Stories with the App ID, `stickerImage` and `backgroundImage`; the system share sheet for the rest.
- A view snapshot (`react-native-view-shot` or a Skia snapshot) to render the card.
- `expo-media-library` for saving.
- Instagram query entries: `LSApplicationQueriesSchemes` on iOS, `<queries>` on Android.
- Check Expo SDK compatibility when Part 5 starts.

### 9. Weekly recap (Part 6)
- Sunday evening in the member's timezone: sessions, total volume, PRs, streak, and next week's plan. In-app first; a push only if the member allows it.
- Trainers get a recap for their clients; owners get one for the gym (active members, sessions, PRs).

### 10. Smart reminders (Part 6)
- On planned training days, at the member's usual training time (learned from history), for example "Leg day is ready."
- A streak reminder only if this week's target is still reachable, and at most once a week.
- Hard cap of 3 nudges per member per week across all types. Quiet hours and per-type preferences are always respected.

### 11. Gym challenges and boards (Part 6)
- An owner creates a monthly challenge, for example "12 sessions in October". Members opt in.
- Boards rank **consistency** (sessions or streak weeks), not weight lifted, so beginners can win too.
- Boards show display name and count only, are visible only inside that gym, and members can leave at any time.

## Guardrails

These are design rules, and each needs a test or review item.

- [ ] Reward completed training only; never app opens, time in the app or notification taps.
- [ ] No guilt or shame copy, no fake urgency, no countdowns to "lose" progress.
- [ ] Rest days and planned deloads are rewarded as part of the plan, never punished.
- [ ] No streak repairs, badges or boosts for money. Premium can add insight, never rescue.
- [ ] No random paid rewards (loot boxes). Stores also require odds disclosure for these.
- [ ] Sharing is always started by the member, with a preview; Gravn never posts for anyone, and measurements and progress photos never appear on a card.
- [ ] Leaderboards are opt-in, gym-only and consistency-based. No leaderboards for under-18s if they're ever allowed (D-07).
- [ ] Notification cap and quiet hours are enforced on the server.
- [ ] Achievements, streaks, high-fives and recaps are personal data: they're included in export and removed on deletion.
- [ ] Every animation respects "reduce motion"; haptics and sounds can be turned off.

## Data and server rules

- Tables are listed in [ref-data-model.md](ref-data-model.md#engagement-parts-2-3-5-6).
- Awards and streaks are computed by the server from synced sessions and are idempotent: re-running the computation never awards twice.
- The phone shows provisional results immediately (offline-friendly), and the server's result is final.
- An `activity_events` log (session completed, PR, badge, high-five, share) feeds the recap, the metrics and the future community feed. It never stores measurements, photos or notes.

## Metrics

Add these to the pilot dashboard (Part 4) and weekly operations (Part 9). The targets are proposals.

| Metric | Why | Proposed target |
|---|---|---|
| Day-7 and day-30 retention of activated members | Is the habit forming? | D30 at least 40% |
| Members with at least 1 session per week | Core habit | 60%+ |
| Median weekly streak length | Investment | Growing month over month |
| Sessions with a "vs last time" improvement | Visible progress | Tracked |
| High-fives per trainer per week | Coach engagement | 5+ |
| Share-card shares per 100 sessions | Growth loop | Tracked |
| Push opt-out rate *(guardrail)* | Are nudges annoying? | Below 10% |
| Streak pauses for injury or illness *(guardrail)* | Are people training through pain? | Reviewed monthly |
