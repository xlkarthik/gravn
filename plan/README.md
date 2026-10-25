# Gravn development plan

This folder breaks Gravn into parts you can build, test and finish one at a time. It's the map; the repo's `STATUS.md` (created in Part 1) says where you are on it.

Source documents, all in the main project folder:

- [Gravn_AI_Build_Prompt.md](../Gravn_AI_Build_Prompt.md): the engineering spec. Where this plan and the prompt differ, the plan explains why.
- [Gravn_Full_Business_and_Financial_Report.pdf](../Gravn_Full_Business_and_Financial_Report.pdf): pricing, go-to-market and the financial model.
- [Gravn_Cost_and_Feasibility.html](../Gravn_Cost_and_Feasibility.html): service prices (checked 10 Oct 2026), the monthly cost calculator and the corrections to the report's Year-1 numbers.

## How to use this plan

1. Do the parts in order. Part 0 overlaps Part 1, and Part 4 (the pilot) runs alongside Parts 5 and 6.
2. Each part file has the same sections: goal, what it depends on, a build checklist, tests, an acceptance demo, an exit checklist, costs it triggers, business tasks to run in parallel, and risks.
3. Tick checkboxes as you finish items. A part is done only when its **exit checklist** is complete and its **acceptance demo** has run on a real iPhone *and* a real Android phone.
4. When reality differs from the plan, change the plan and log the reason in [ref-decisions-risks.md](ref-decisions-risks.md) (and in the repo's `DECISIONS.md` once it exists).
5. Starting an AI coding session: *"Read plan/README.md, the current part file, and STATUS.md. Continue with the next unchecked item."*

## Parts at a glance

| Part | Name | Build prompt milestone | Effort (full-time weeks) | Done when |
|---|---|---|---|---|
| [0](00-groundwork.md) | Groundwork | — | ~1 week of your time over 2–4 weeks | Store accounts active, devices in hand, dev machine ready, pilot gyms lined up |
| [1](01-foundation.md) | Foundation | M1 | 3–4 | Sign-in, workspaces, invitations and role-based navigation work on Android, iOS and web; database permissions tested |
| [2](02-workout-loop.md) | Workout loop | M2 | 5–7 | Trainer assigns a plan, member logs it offline with any exercise type, supersets and timers, trainer reviews the synced result |
| [3](03-pilot-readiness.md) | Pilot readiness | Parts of M3, M4, M6 | 3–4 | A real gym can use Gravn on the production backend via TestFlight and Play closed testing |
| [4](04-pilot-run.md) | Pilot run | — | 4–8 calendar weeks, alongside Parts 5–6 | 3–5 gyms use it weekly; Google's 14-day closed test is complete |
| [5](05-progress-media-privacy.md) | Progress, media and privacy | Rest of M3 | 7–8 | Circuits, intervals, cardio, custom measurements, charts, private photos, notes, exercise media, total lifted, badges, share cards, Gravn programs for solo users, export, full deletion |
| [6](06-owner-ops-notifications.md) | Owner operations and notifications | Rest of M4 | 3–4 | Owner dashboard, attendance, notification inbox, weekly recap, smart reminders, gym challenges, monitoring |
| [7](07-plans-billing.md) | Plans and billing | M5 | 3–5 | Plan limits, trials, Premium purchases on both stores (sandbox), webhook-backed entitlements |
| [8](08-hardening-release.md) | Hardening and release | M6 | 3–4 | Security and reliability tested, store submissions approved |
| [9](09-launch-operations.md) | Launch and operations | — | Ongoing | Public release, weekly operating rhythm, scaling triggers |

### Timeline (one developer, full-time, with an AI coding assistant)

| Week (cumulative) | Milestone |
|---|---|
| −2 to 2 | Part 0: accounts, devices, decisions, pilot interviews |
| 1–4 | Part 1 done |
| 8–11 | Part 2 done |
| **11–15** | **Part 3 done: first pilot gym starts** |
| 18–23 | Part 5 done |
| 21–27 | Part 6 done |
| 24–32 | Part 7 done |
| **27–36** | **Part 8 done: store submission** |

At about 20 hours a week, roughly double every number. Two things moved the dates. Basic measurements and account deletion moved forward into the pilot (Part 3), because a pilot gym will expect measurements and real personal data needs a working deletion path. The engagement layer also adds about 3 weeks across Parts 2, 3, 5 and 6, self-guided programs for people training on their own add about 1 more week (Part 5), and flexible workouts with timers (custom tracking types, supersets, circuits, intervals and cardio countdowns) add about 2 more (Parts 2 and 5).

### The engagement layer

Every workout should feel rewarding enough that members want to come back: instant set feedback, live PRs, a finish screen that shows progress and what's next, weekly streaks, coach high-fives, total lifted, badges, share cards, weekly recaps and gym challenges. It's built in slices inside Parts 2, 3, 5 and 6, with guardrails against guilt, nagging and overtraining. The full design is in [ref-engagement.md](ref-engagement.md).

### Two ways Gravn earns

- **B2B:** gyms and independent trainers subscribe on the web. This is the cash-flow anchor.
- **B2C:** anyone can download Gravn, train on their own for free with Gravn's coach-written programs, and upgrade to Premium through the App Store or Google Play.

The B2C model (who it's for, the journey, the Free/Premium split, pricing, paywall rules, acquisition, economics and funnel metrics) is defined in [ref-b2c.md](ref-b2c.md).

### Why the order differs from the build prompt

The prompt runs M1 → M6 in sequence. This plan inserts a **pilot gate** after M2 and pulls forward only what a real gym needs: basic measurements, owner basics, membership expiry, push for new workouts, account deletion, legal pages and production environments. Reasons:

- The business report makes gyms the cash anchor and asks for pilots within months. Waiting for B2C billing (M5) before any gym uses the app delays learning by 8–12 weeks.
- The pilot doubles as Google Play's required closed test (12 testers, 14 continuous days) for new personal developer accounts.
- Pilot feedback should shape Parts 5–7 before they're built.

## Critical path

```
Part 0 accounts ──► Part 1 ──► Part 2 ──► Part 3 ──► Part 4 pilot ─────────────┐
   (Apple fee needed       (sync is the        (prod env, legal,          │
    for iPhone builds)      riskiest work)      TestFlight/Play test)      ▼
                                              Part 5 ──► Part 6 ──► Part 7 ──► Part 8 ──► Part 9
                                                                  (store products,  (store
                                                                   tax forms,        review)
                                                                   agreements)
```

Slow external items to start early: legal review (Part 0 → needed in Part 3), D-U-N-S number if registering a company, Apple Paid Apps agreement and tax/banking forms (before Part 7 sandbox testing), exercise video filming (before Part 5 ends), and 12+ Android testers (Part 3).

## Reference documents

| File | Use it for |
|---|---|
| [ref-architecture.md](ref-architecture.md) | Stack, repo layout, environments, offline sync design, notifications, media, billing flow, background jobs |
| [ref-data-model.md](ref-data-model.md) | Every table by domain, key columns, constraints and conventions |
| [ref-permissions.md](ref-permissions.md) | Roles, who can see and change what, leaving a gym, revocation, member counting |
| [ref-quality-security.md](ref-quality-security.md) | Testing strategy, CI, definition of done, security, privacy, backups, accessibility, performance, device matrix |
| [ref-b2c.md](ref-b2c.md) | The direct-to-consumer model: journey, Gravn programs, Free vs Premium, pricing, paywall rules, acquisition, economics, funnel |
| [ref-engagement.md](ref-engagement.md) | The habit loop: rewards, streaks, PRs, badges, recaps, challenges, guardrails and metrics |
| [ref-decisions-risks.md](ref-decisions-risks.md) | Open decisions with proposed defaults, and the risk register |

## Rules that apply to every part

These come from the build prompt. They're repeated here because they're easy to lose during a long build.

- **Authorization lives in the database and trusted server code.** Never trust a role, workspace ID, subscription flag or hidden button sent by the app. Users can't promote themselves or edit their own entitlements.
- **Test both phones from Part 1.** A web preview or a JavaScript bundle doesn't prove either native app works. Record Android and iOS results separately.
- **No mock screens called finished.** A screen is done when it reads and writes real data under real permissions.
- **Synthetic data outside production.** Never copy production data into local or staging.
- **No paid resources, store publishing, production deploys or destructive migrations without your explicit go-ahead.** This applies to AI assistants working in the repo.
- **Never invent test results.** If something wasn't run, say so in `STATUS.md`.
- **Record assumptions** in `DECISIONS.md` instead of silently choosing.

## Repo documents the build produces

| Document | First created | Kept current through |
|---|---|---|
| `README.md` (setup and run) | Part 1 | Every part |
| `STATUS.md` | Part 1 | Every session |
| `DECISIONS.md` | Part 1 (seeded from [ref-decisions-risks.md](ref-decisions-risks.md)) | Every part |
| `ARCHITECTURE.md` | Part 1 (seeded from [ref-architecture.md](ref-architecture.md)) | Parts 2, 3, 5, 7 |
| `PERMISSIONS.md` | Part 1 (seeded from [ref-permissions.md](ref-permissions.md)) | Parts 2, 5, 7 |
| `COSTS.md` | Part 1 (from the cost page) | Parts 3, 7, 9 |
| `PRIVACY_DATA_MAP.md` | Part 3 | Parts 5, 7, 8 |
| `BILLING.md` | Part 7 (policy matrix first) | Part 8 |
| `RELEASE_CHECKLIST.md` | Part 3 (pilot builds) | Part 8 |

## Status board

Copy this into `STATUS.md` when the repo exists, or tick it here.

- [ ] Part 0: Groundwork
- [ ] Part 1: Foundation
- [ ] Part 2: Workout loop
- [ ] Part 3: Pilot readiness
- [ ] Part 4: Pilot run
- [ ] Part 5: Progress, media and privacy
- [ ] Part 6: Owner operations and notifications
- [ ] Part 7: Plans and billing
- [ ] Part 8: Hardening and release
- [ ] Part 9: Launch

## Spending by part

Details and current prices are on the [cost page](../Gravn_Cost_and_Feasibility.html).

| Part | New cash costs |
|---|---|
| 0 | Apple ₹8,700/yr, Google ₹2,400 once, domain ₹800–1,500/yr, test devices ₹0–35,000, CA and lawyer start |
| 1–2 | ₹0 in services (local and free tiers). An AI coding plan is optional (Claude Pro ~₹2,000/month). |
| 3 | Supabase Pro ~₹2,500/month from the first real gym; legal pages ₹20,000–50,000; business registration ₹15,000–30,000 |
| 5 | Exercise filming ₹0–15,000 |
| 7 | Nothing new until revenue: RevenueCat is free under US$2,500 a month; Razorpay charges per transaction |
| 8–9 | Optional upgrades as usage grows (EAS Starter $19, Resend Pro $20, Sentry Team $26, larger database compute) |
