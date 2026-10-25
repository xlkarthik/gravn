# Reference: decisions and risks

Open decisions with a proposed default, so building never waits on them. Proposed defaults are reversible engineering assumptions unless marked otherwise. Move each to "Decided" in the repo's `DECISIONS.md`, with date and reason, once settled.

## Open decisions

| ID | Decision | Proposed default | Needed by | Who decides |
|---|---|---|---|---|
| D-01 | Bundle ID and main domain | The name is decided (**Gravn**, see Decided below). Bundle ID from the main domain, for example `app.gravn.mobile` for gravn.app (permanent once published) | Part 1 | You |
| D-02 | Package manager | pnpm workspaces; `nodeLinker: hoisted` if native builds misbehave | Part 1 | You |
| D-03 | Supabase region | Mumbai (lower latency for Kerala; data stays in India) | Part 1 (prod in Part 3) | You + lawyer |
| D-04 | Business documents in the code repo? | Keep them out, or in a private `docs/business/` folder | Part 1 | You |
| D-05 | Legal entity | Decide with the CA; an organisation account avoids Google's 12-tester rule but needs a D-U-N-S number | Part 0 | You + CA |
| D-06 | GST registration; are prices GST-inclusive? | Ask the CA; plan Premium at ₹143 net per ₹199 | Part 3 (gyms), Part 7 (stores) | CA |
| D-07 | Age policy | 18+ only at launch; parental consent later if gyms need teen members | Part 3 | You + lawyer |
| D-08 | What the gym keeps after a member leaves | See [ref-permissions.md](ref-permissions.md#leaving-a-gym): gym keeps roster, membership and attendance; loses workout and measurement details; member keeps own history | Part 3 | You + lawyer |
| D-09 | Account deletion timing | Login disabled at once; data deleted within 7 days (a short window to cancel), confirmed by email | Part 3 | You + lawyer |
| D-10 | Workout schedule model | Sequence ("next is Day 2") with optional weekday hints | Part 2 | You, after pilot interviews |
| D-11 | Free consumer history window | 30 days visible, configurable; older data kept, exportable and deletable. Labelled a proposal, not a business requirement. | Part 7 | You |
| D-12 | Can owners see members' workouts and measurements? | Yes within the gym's own workspace (owners often train too); photos only if shared with them personally | Part 3 | You + lawyer; check with pilots |
| D-13 | Member counting | Active + outstanding invitations count; archived and staff don't | Part 3 (dashboard), Part 7 (limits) | You |
| D-14 | What happens when a trial or grant ends | 14 days read-only, then locked; data never deleted | Part 7 | You |
| D-15 | Global exercise media: public bucket or signed URLs | Public (it's demo content, and it caches better); workspace media stays private | Part 5 | You |
| D-16 | Mobile chart library | Decide after a 1-day spike (victory-native or react-native-gifted-charts); check Expo SDK compatibility | Part 5 | You |
| D-17 | Web hosting | Cloudflare Workers with OpenNext (free, then $5/month); Vercel Pro ($20/seat) if the adapter causes trouble | Part 3 | You |
| D-18 | Founding offer terms | Keep ₹1,499 for the first year, but only for gyms that sign within the launch window; the cost page shows the revenue impact | Part 7 | You |
| D-19 | Exercise media source | Film your own core library with a pilot gym's trainer; buy a licensed pack only to fill gaps, with written proof of rights | Part 5 | You |
| D-20 | Independent-trainer plan billing | Unresolved; Apple says single-user sales must use in-app purchase. Choose: also offer it as in-app purchase, or web-only and accept review risk. | Part 7 (before submission) | You |
| D-21 | RevenueCat restore behaviour | "Transfer if there are no active subscriptions" (stops one person's restore from taking another's active Premium) | Part 7 | You |
| D-22 | Offline Premium cache on the phone | 72 hours, then recheck with the server | Part 7 | You |
| D-23 | iPad support | Off at launch (`supportsTablet: false`); check the app in iPad compatibility mode | Part 8 | You |
| D-24 | Over-the-air updates (EAS Update) | Off at launch; turn on once you have a release process, and budget for usage beyond 3,000 users | Part 8 | You |
| D-25 | Malayalam | Strings ready from Part 1; translate when pilots or sales show the need | Part 4 review | You |
| D-27 | Streak model | Weekly streak against the plan's session count (default 2 for self-guided); one freeze per 4 weeks; trainer pause | Part 3 | You |
| D-28 | Leaderboards | Opt-in, gym-only, consistency-based (sessions or streak weeks), never weight; none for under-18s | Part 6 | You |
| D-29 | Celebration sound | Haptics on, sound off by default; both can be turned off | Part 2 | You |
| D-30 | Personal records for free consumers | The business plan lists "personal records" under Premium, but the engagement layer celebrates PRs for everyone. Proposed: everyone gets live PR celebrations (the habit hook); the full PR history and records page is Premium for solo users; gym members get it through their gym's plan | Part 7 | You |
| D-31 | Share card defaults | Weights and display name shown, gym hidden unless the gym enables co-branding; the member can change any of them per share | Part 5 | You |
| D-32 | Gym logo on share cards | Gyms can turn on co-branding (proposed: Growth plan and above); members can always remove it | Part 5 | You |
| D-33 | B2C launch timing | Free solo use and Premium purchases both go live with the public store release (Part 8), after Part 7's sandbox testing. The business plan suggested Premium at Months 5–6 | Part 7 | You |
| D-34 | Free/Premium split | As proposed in ref-b2c.md: Free builds the habit (unlimited logging, 2 starter programs, 3 own routines, 30-day history view, all rewards); Premium deepens insight (full program library and history, advanced charts, PR records, photos, monthly report) | Part 7 | You |
| D-35 | Introductory offer | 7-day free trial on the yearly plan only, through the stores | Part 7 | You |
| D-36 | Prices outside India | Store price tiers chosen per country before launching there; the app always shows the store's price | Before each new country | You |
| D-37 | Who writes Gravn programs | A qualified coach (possibly a pilot gym's head coach in exchange for free months), with content review and licence records | Part 5 | You |
| D-38 | Logging missed workouts | Members can log a workout up to 7 days late and it counts towards that week's streak; older backfills are kept but don't change past streaks. Every edit recomputes awards exactly once | Part 2 | You |
| D-39 | Tracking types in the pilot | Weight × reps, reps only, added and assisted weight, time, distance, distance + time; cardio activities, classes and custom fields at launch | Part 2 | You |
| D-26 | One person as owner and trainer in the same gym | Allowed (multiple roles per membership) | Part 1 | You |

### Decided

Move entries here (or to `DECISIONS.md`) with the date and the reason.

| ID | Decision | Date | Reason |
|---|---|---|---|
| D-01a | Product name: **Gravn** | 10 Oct 2026 | "GymOS" was taken. gravn.app, getgravn.com, joingravn.com and gravnapp.com were free, and no app was named Gravn on either store. Accepted risks: one letter from Gravl (an AI personal-trainer app); "graven" means "the grave" in Scandinavian languages. Logo: Gravn_Logo.png. |

## Conflicts between the business report and the build prompt

The build prompt says to flag conflicts rather than silently resolve them.

| Topic | Report says | Prompt or plan says | Action |
|---|---|---|---|
| Year-1 revenue | ₹3,500 per gym from month 1 | Founding offer ₹1,499 for the first 50 gyms | Revenue roughly halves in Year 1; see the cost page. Decide D-18. |
| Premium net revenue | ₹169.15 per ₹199 | GST inside store prices → ~₹143 | Use ₹143 for planning until the CA confirms (D-06) |
| MVP timing | "MVP completion" in Months 1–2 | Six milestones take 27–36 full-time weeks, including the engagement layer, self-guided programs and flexible workouts | Pilot slice at weeks 11–15; full release later |
| White-label | ₹9,999–₹19,999/month plans | Deferred | Not offered at launch |
| Annual gym billing and referrals | In the launch offer | Deferred unless pilots need them | Revisit after the pilot |
| Free-history length | "Limited history" | 30 days as a proposal | D-11 |

## Risk register

Likelihood and impact: H = high, M = medium, L = low.

| ID | Risk | Likelihood | Impact | Mitigation | Watch for |
|---|---|---|---|---|---|
| R-01 | Offline sync takes much longer than estimated | H | H | Native spike first; narrow offline scope; idempotent server design; chaos tests | Part 2 running past 6 weeks |
| R-02 | A permission bug exposes one gym's data to another | M | H | RLS on every table; pgTAP per role; attack scripts; review in Part 8 | Any test touching two gyms failing |
| R-03 | Trainers don't adopt; they keep using WhatsApp | M | H | Watch them use it; make program creation faster than a WhatsApp message; templates and copying | Trainer engagement below 50% by pilot week 3 |
| R-04 | App Store rejects the gym or trainer billing model | M | H | Policy matrix; no purchase links or prices in the app; decide D-20; clear review notes | Rejection citing 3.1.1 or 3.1.3 |
| R-05 | Founder overload (build + sell + support) | H | M | Pilot capped at 5 gyms; batched weekly fixes; written quick starts; FAQ | Build progress stalls two weeks in a row |
| R-06 | Unlicensed exercise media reaches production | L | H | Licence manifest; placeholders clearly labelled; film your own | Any global media without a manifest entry |
| R-07 | Data loss (bad migration, deleted bucket) | L | H | Forward-only migrations; staging first; daily and weekly backups; restore drills | A restore drill fails |
| R-08 | Year-1 revenue below plan | H | M | Use the corrected model; keep ₹5 lakh runway; Premium as a supplement, not the anchor | MRR behind the corrected curve for 2 months |
| R-09 | Store, tax or privacy rules change mid-build | M | M | Recheck policies at Parts 3, 7 and 8; lawyer and CA on call | Policy update emails from Apple and Google |
| R-10 | Expo SDK upgrade breaks native modules | M | M | Upgrade within a couple of months of each release; keep native dependencies few | `expo-doctor` warnings |
| R-11 | Windows-only setup slows iOS work | M | M | Physical iPhone; EAS builds; register the device in week 1; consider renting cloud macOS only if truly blocked | iOS-only bugs you can't reproduce |
| R-12 | Google's 14-day closed test resets | M | L | Recruit 15–20 testers; check the count weekly | Opted-in testers below 13 |
| R-13 | Cloud costs spike (video egress) | L | M | Caching, size limits, alerts on usage; cost page triggers | Monthly egress above 200 GB |
| R-15 | Name confusion or a trademark challenge from Gravl, an existing AI personal-trainer app | M | H | Trademark search and lawyer's opinion before filing; distinct logo and positioning; keep a backup name ready | A store reviewer or Gravl raises confusion |
| R-16 | Engagement features feel gimmicky, nag people, or push them to overtrain | M | M | Calm, premium celebrations; weekly streaks with freezes; 3-nudge weekly cap; guardrail metrics (opt-outs, injury pauses) | Push opt-out rate above 10% |
| R-17 | Flexibility makes logging slower or confusing | M | H | One-tap default path; advanced options behind More; test with pilot members and time a full workout log | A typical set takes more than 2 taps |
| R-14 | Personal-data breach | L | H | Security checklist; least privilege; incident runbook; lawyer contact ready | Unusual access patterns, Sentry auth errors |
