# Reference: direct-to-consumer (B2C) model

Gravn makes money in two ways:

1. **B2B:** gyms and independent trainers pay a monthly subscription on the web. This is the cash-flow anchor in the business plan.
2. **B2C:** anyone can download Gravn from the App Store or Google Play, train on their own for free, and upgrade to **Gravn Premium**.

This document defines the second one. B2C brings reach (every user can share cards and invite friends), extra revenue, and a home for people between gyms. It must never undercut what gyms pay for.

## Who it's for

| Person | Why they come | What keeps them |
|---|---|---|
| Self-trained gym-goer | Wants to log lifts and see progress without a trainer | Streaks, PRs, total lifted, history |
| Beginner | Doesn't know what to do in the gym | A clear starter program that tells them what to lift today |
| Home or dumbbell trainee | Trains at home with little equipment | Home and bodyweight programs |
| Former gym member | Left a gym but wants to keep training | Their history and habits carry on in their personal space |
| Gym member wanting more | Their gym covers the gym plan, but they want personal extras | Premium for their personal workspace |

## The consumer journey

1. **Discover:** app store search, a friend's share card on Instagram, a trainer's recommendation, or a poster at a pilot gym.
2. **Sign up:** email and password, then "I'm training on my own". A personal workspace is created.
3. **Setup in about 60 seconds:** goal (build muscle, get stronger, lose fat, general fitness), experience, days per week, and equipment (gym, dumbbells, bodyweight). Gravn recommends a starter program. "I'll build my own" and "Just log a workout" are always there too.
4. **First workout the same day:** guided by the program, with set feedback, the finish celebration and "what's next". The streak starts.
5. **Weeks 1–3:** reminders on planned days, PRs, first badges, share cards. The habit forms here, entirely on the free plan.
6. **Upgrade moments:** a calm, dismissible Premium screen appears only when a member reaches for something Premium covers. Examples: history older than the free window, a Premium program, progress photos, advanced charts, or a fourth custom routine. Also once after a real milestone, such as a 2-week streak ("See your full progress"). Never during a set.
7. **Buy:** monthly or yearly through the App Store or Google Play. Yearly is shown as best value.
8. **Stay:** the engagement layer, a monthly progress report (Premium), and steady progression in the program.
9. **Bridge to B2B:** a solo user can join a gym or a coach by invitation at any time. Their personal history stays private unless they share it.

## Training without a trainer: Gravn programs

A solo user has no trainer assigning plans, so Gravn supplies them.

- **Program library** of 6–8 programs at launch, written and reviewed by a qualified coach. Examples:
  - beginner full body, 3 days a week
  - upper/lower, 4 days
  - push/pull/legs
  - 5×5 strength
  - dumbbell-only home
  - bodyweight
  - a short "return to training" program
- **Same engine as gym programs.** Library programs are global programs (like the global exercise catalog), built with the same builder, versioning and logging.
- **Progression suggestions:** when every set of an exercise hits its target reps, the next session suggests a small increase. The coach sets the rules per program; the member can always override. Suggestions are labelled as suggestions, never medical or clinical advice.
- **Own routines:** members can build their own routines with the same builder trainers use, scoped to their personal workspace.
- **Freestyle:** "Just log a workout": pick exercises as you go.
- **Safety:** beginner defaults are conservative. A short "train within your limits; stop if you feel pain; check with a doctor if you have a medical condition" notice appears at setup. Program content is reviewed before it's marked as reviewed.

## Free and Premium

The business plan sets the outline (Free: workout logging, limited history, basic measurements; Premium: full history, advanced charts, progress photos, personal records, progress reports). The detailed split below is a **proposal** (D-34). The rule behind it: Free should build the habit; Premium should deepen insight. Never sell the habit itself.

| Capability | Free | Premium |
|---|---|---|
| Log unlimited workouts (freestyle, routines, programs) | ✓ | ✓ |
| Gravn programs | 2 starter programs | Full library |
| Own routines | Up to 3 | Unlimited |
| Workout history you can view | Last 30 days (older data kept, exportable) | Everything |
| Standard body measurements | ✓ | ✓ |
| Custom measurements | — | ✓ |
| Charts | Basic, last 30 days | All ranges and comparisons |
| Live PR celebrations | ✓ | ✓ |
| Personal records page, estimated 1-rep max, PR history | — | ✓ |
| Progress photos and comparisons | — | ✓ |
| Monthly progress report | — | ✓ |
| Streaks, badges, total lifted, share cards, weekly recap | ✓ | ✓ |
| Data export and account deletion | ✓ | ✓ |
| Ads | Never | Never |

Monthly and yearly Premium unlock exactly the same features. Gym members get gym-covered features through their gym's plan inside the gym's workspace. Personal Premium only adds personal-workspace features and never starts a second gym subscription. An invitation never unlocks Premium.

## Pricing and offers

- **India launch prices:** ₹199/month and ₹1,499/year (about ₹125/month), from the business plan.
- **Other countries:** prices come from the stores' price tiers for each storefront, chosen before launching in that country (D-36). The app always shows the store's localised price, never a hard-coded rupee figure.
- **Introductory offer:** proposed: a 7-day free trial on the yearly plan only, configured in the stores (D-35). The 30-day *gym* trial never applies to consumers.
- **Future:** a higher tier (₹299) only when there are real extra features (business plan). Family sharing is off at launch.
- **Payment:** always Apple or Google in-app purchase, through RevenueCat. No external payment links or "cheaper on our website" wording.

## Paywall rules

- [ ] Never block logging, history export or account deletion.
- [ ] Show the Premium screen only when the member reaches for a Premium feature, or once after a milestone. Never more than once a day, and never during a workout.
- [ ] Show what's included, the store price, the renewal terms, and links to the terms and privacy policy (required for auto-renewing subscriptions).
- [ ] No fake countdowns, no pre-ticked upsells, no "you'll lose your streak" pressure.
- [ ] One place to manage the subscription, which opens the store's own page.

## How consumers find Gravn

No paid advertising at launch. The business plan uses B2C for reach while gyms carry the revenue.

| Channel | How it works | Where it's built |
|---|---|---|
| App store search | Name, subtitle, keywords ("workout log", "gym tracker", "PR"), screenshots that show outcomes | Part 8 |
| Share cards | Every badge, PR and milestone posted to Instagram or WhatsApp carries the brand | Part 5 |
| Gyms as distribution | Every pilot and paying gym brings members into the app; they keep it when they leave | Parts 3–4 |
| Trainers | Independent coaches bring clients; clients may keep training solo later | Part 1 onwards |
| Instagram content | Gym-culture posts, member PR highlights (with permission), program tips | Part 9 |
| Referrals | "Give a month, get a month" | Future |
| Easy switching | Import workout history from Strong or Hevy exports | Future |

## Economics

Figures from the [cost page](../Gravn_Cost_and_Feasibility.html). Ask the CA to confirm the GST treatment.

| Item | Monthly ₹199 | Yearly ₹1,499 |
|---|---|---|
| Price paid | ₹199 | ₹1,499 |
| Less 18% GST inside the price | ₹168.64 | ₹1,270.34 |
| Less 15% store fee | **₹143.35 net** | **₹1,079.79 net (₹90/month)** |
| RevenueCat | Free under US$2,500 a month, then 1% | Same |

- About **349 monthly subscribers** cover the business plan's ₹50,000 monthly running costs (the report said 296, before GST).
- The tech cost per consumer is a few rupees a month at most, so each paying subscriber is high margin.
- The risk is conversion, not cost.

## Funnel metrics

Track these from the first public release (Part 9). Set targets after the first month of real data rather than guessing.

| Step | Measure |
|---|---|
| Store page → install | Store conversion rate (from App Store Connect and Play Console) |
| Install → account | Sign-up rate |
| Account → setup done | Setup completion |
| Setup → first workout within 24 hours | Activation |
| Day 7 and day 30 | Retention of activated users |
| Active → Premium screen viewed | Upgrade reach |
| Premium screen → trial or purchase | Conversion |
| Trial → paid | Trial conversion (if D-35 is adopted) |
| Paid → month-2 renewal | Early churn |
| Yearly share | Share of subscribers on the yearly plan |
| Refunds | Refund rate (from the stores) |

## Store and policy notes

- Premium is a digital subscription, so it must use in-app purchase (Apple 3.1.1; Google Play Billing).
- Introductory offers are managed by the stores. Eligibility is per Apple ID or Google account.
- Subscription screens need clear pricing, period, auto-renewal and cancellation information, plus links to terms and privacy.
- Restore purchases, cross-device access through the same Gravn account, and the restore/transfer policy follow Part 7 (D-21).
- Health data rules: no medical claims; programs are fitness guidance, not treatment.

## Where it's built

| Part | B2C work |
|---|---|
| [1](01-foundation.md) | "I'm training on my own" path and the personal workspace |
| [2](02-workout-loop.md) | Freestyle workouts and own routines in the personal workspace |
| [5](05-progress-media-privacy.md) | Gravn program library, 60-second setup and recommendation, progression suggestions |
| [7](07-plans-billing.md) | Free/Premium limits, paywall, introductory offer, store prices per country |
| [8](08-hardening-release.md) | Consumer store listing and screenshots |
| [9](09-launch-operations.md) | Funnel metrics, Instagram content, referral rewards later |
