# Part 7: Plans and billing

**Build prompt milestone:** M5.
**Goal:**
- The server decides what each workspace and user may do, through a plan catalog and feature matrix.
- Gym trials and pilot access are time-limited and audited.
- B2C Premium (monthly and annual) works through Apple and Google billing via RevenueCat, tested in sandbox on both phones.
- The B2B billing path is decided only after a policy review.

**Effort:** 3–5 weeks full-time.
**Depends on:** Parts 3–6. The store paperwork in 7.0 has waiting time, so start it during Part 6.

Three things stay separate in data, UI and wording:

1. **Premium:** a consumer's digital subscription, bought in the app through Apple or Google.
2. **Gravn subscriptions:** what a gym or independent trainer pays for the software, on the web.
3. **Physical gym memberships:** what a member pays their gym. Recorded only; never collected by Gravn in the MVP.

## 7.0 Store paperwork (start early)

**Apple (App Store Connect)**
- [ ] Accept the Paid Apps agreement.
- [ ] Add bank details and tax forms.
- [ ] Enrol in the App Store Small Business Program, for a 15% commission instead of 30%.

**Google (Play Console)**
- [ ] Set up the payments profile and merchant account.
- [ ] Add tax information.

**Tax**
- [ ] Confirm the GST treatment with the CA before setting prices: Apple calculates proceeds on the tax-exclusive price; Google leaves GST on the sale to Indian developers.

## 7.1 Policy matrix first

Write `BILLING.md` before building any payment flow. One row per combination of customer type, platform and what's being bought.

| Customer | Buys | Where it's sold | Rule to check | Proposed approach | Risk |
|---|---|---|---|---|---|
| Consumer | Premium monthly/annual | iOS app | Apple 3.1.1: in-app purchase for digital content | Apple in-app purchase through RevenueCat | Low |
| Consumer | Premium monthly/annual | Android app | Google Play payments policy | Google Play Billing through RevenueCat | Low |
| Gym owner | Gym plan | Web dashboard | Apple 3.1.3(f) and (c); Google Play payments policy | Web only; the app shows plan status, never prices, buttons or links to buy | Medium: verify before launch |
| Independent trainer | Trainer plan | Web, or in-app? | Apple 3.1.3(c): "consumer, single user, or family sales must use in-app purchase" | **Decision D-20:** also sell through in-app purchase, or web only and accept review risk | High |
| Gym member | Gym-covered features | Nobody (the gym pays) | Apple 3.1.1: no unlock codes | Access comes from gym membership in that gym's workspace only | Low |
| Member | Physical gym membership | Outside Gravn | Apple 3.1.3(e) | Not collected in the MVP; recorded manually | Low |

- [ ] Re-read the current Apple guidelines and Google payments policy when writing this. Record the date checked.
- [ ] Flag every unresolved row. Don't activate a flow while its row is unresolved.
- [ ] Never add external purchase links, payment web views or "buy on our website" wording inside the apps unless current rules and any required enrolment explicitly allow that exact flow.

## 7.2 Plan catalog and feature matrix

- [ ] Tables (see [ref-data-model.md](ref-data-model.md#plans-and-billing-part-7)): `plans`, `plan_features`, `features`, `workspace_subscriptions`, `access_grants`, `consumer_entitlements`, `billing_events`.
- [ ] Seed the targets from the business plan:
  - Gyms: Starter ₹1,999 (30 members), Growth ₹3,999 (75), Professional ₹6,999 (150), Business ₹9,999 (300), Unlimited ₹14,999.
  - Trainers: Solo ₹499 (10 clients), Trainer Pro ₹999 (30), Online Coach ₹1,999 (100).
  - Consumers: Free; Premium ₹199/month or ₹1,499/year (store prices are loaded from the stores, not this table).
- [ ] Each feature has a status, **available** or **future**. Only available features may appear in any plan description, store text or paywall.
- [ ] Map implemented features to tiers as the prompt describes:
  - **Starter:** core workouts, library, measurements, progress, basic reports.
  - **Growth:** adds custom measurements, photos, extended history, attendance, expiry tracking and notifications.
  - **Professional:** adds implemented analytics and in-app branding.
  - **Business:** its extras stay marked as future.
- [ ] Record any proposed tier simplification for your approval in `DECISIONS.md`. Don't present invented caps (trainer seats, storage quotas) as agreed pricing.
- [ ] Changes to the catalog are versioned and audited; only platform admins can make them.

## 7.3 Limits

- [ ] Counting rule (D-13, proposed): **active members plus outstanding invitations count; archived members don't.** Document it in `PERMISSIONS.md` and show it on the dashboard.
- [ ] Enforce limits inside the RPCs that invite or activate members. Each RPC locks the workspace row (`select … for update`) so two simultaneous invitations can't both slip under the limit.
- [ ] Hitting the limit: a clear message to the owner with plan options (on the web). Members never see it.
- [ ] Downgrades never delete records. Over-limit gyms can't add members until they're under the limit; existing members keep working.
- [ ] Storage and upload quotas are separate from member limits, and generous enough not to bother normal use.

## 7.4 Trials, founding offer and pilot access

- [ ] **30-day gym trial:** starts when a gym workspace is created by a verified owner; one trial per owner and gym. B2C users never get it automatically.
- [ ] **Founding offer:** ₹1,499/month for up to 50 members, first year only, first 50 eligible gyms.
  - The 50-slot cap is enforced in the database (counter with a constraint, or a slots table).
  - Eligibility rules and dates are checked on the server.
- [ ] **Access grants for pilots:** time-limited, with reason, granted by, and revocable. Every grant and revocation is audited. No hidden reviewer-only behaviour and no production billing bypasses.
- [ ] Trial or grant expiry: what changes is decision D-14 (proposed: read-only for 14 days, then locked; data kept, never deleted).

## 7.5 Entitlement resolution

- [ ] One server function answers "may this user use feature F in workspace W?". RLS policies, RPCs and the app's UI all use it.
- [ ] Rules:
  - Gym-funded features apply only inside that gym's workspace. Members never pay again for them.
  - Premium applies to the user's personal workspace. It can add personal features but never starts a second gym subscription.
  - An invitation grants only membership of that workspace, never Premium.
  - The app may cache entitlements for display, but the server rechecks on every protected request.
- [ ] Free history window (D-11, proposed 30 days, configurable):
  - Free consumers *see* the last 30 days of history.
  - Older data is kept, never deleted.
  - Export and deletion always cover everything.

## 7.6 Premium through RevenueCat

**Store setup**
- [ ] App Store Connect: one subscription group with two products (monthly, annual), localised names and descriptions, and a review screenshot.
- [ ] Play Console: one subscription with two base plans (monthly, annual).
- [ ] RevenueCat: a project with both apps, entitlement `premium`, and one offering containing both packages.

**App**
- [ ] `react-native-purchases` behind a small billing adapter in the app.
- [ ] After sign-in, call `Purchases.logIn(supabaseUserId)`; on sign-out, `logOut`. The RevenueCat user ID is always the Supabase user ID.
- [ ] Paywall: prices and periods come from store product data, never hard-coded rupees. Monthly and annual unlock the same features. Show what's included, the renewal terms, and links to the terms of use and privacy policy (required for auto-renewing subscriptions).
- [ ] Handle success, failure, user cancellation, pending (for example awaiting payment approval), and already-subscribed. Never show a purchase prompt to someone with an active subscription on their linked account.
- [ ] A **Restore purchases** button.
- [ ] **Manage subscription** opens the originating store's subscription page.

**Restore and transfer policy (D-21)**
- [ ] Pick RevenueCat's restore behaviour (transfer to the new user ID, transfer only if there's no active subscription, or keep with the original). Explain the result to users in plain language in `BILLING.md`.

## 7.7 Webhooks and reconciliation

- [ ] Edge function `revenuecat-webhook`:
  1. Check the `Authorization` header matches the secret configured in RevenueCat; reject anything else.
  2. Store the raw event with its unique event ID. A duplicate ID is acknowledged and ignored.
  3. Don't trust event order. Fetch the subscriber's current state from RevenueCat's REST API and write the result to `consumer_entitlements`.
  4. Keep sandbox and production events apart (environment field); sandbox never grants production access.
- [ ] A daily reconciliation job re-checks recently changed and soon-to-expire subscribers, to catch missed webhooks.
- [ ] Offline entitlement cache on the phone is bounded (D-22, proposed 72 hours) and then rechecked.
- [ ] Clients can never write subscription or entitlement rows (RLS test).
- [ ] Account deletion also deletes the RevenueCat customer through its API, and the deletion screen explains how to cancel the store subscription.

## 7.8 Sandbox testing (both platforms, recorded separately)

- [ ] Apple sandbox tester accounts; Google license testers.
- [ ] For each platform, test and record the result:
  - [ ] Monthly purchase
  - [ ] Annual purchase
  - [ ] User cancels at the payment sheet
  - [ ] Failed payment
  - [ ] Pending transaction (where the platform supports it)
  - [ ] Renewal (sandbox renewals are accelerated)
  - [ ] Expiry after cancelling auto-renew
  - [ ] Restore on a fresh install
  - [ ] Restore while signed in as a different Gravn account (checks the D-21 policy)
  - [ ] Grace period and billing retry (where the sandbox supports it)
  - [ ] Refund or revocation (where the sandbox supports it; otherwise note the gap)
- [ ] A gym member using gym-covered features never sees a paywall for them.

## 7.9 Gym billing path

- [ ] **MVP:** owners pay by UPI or bank transfer. You issue an invoice (GST format per the CA). A platform admin marks it paid, which activates or extends the subscription, and the action is audited.
- [ ] **Later, after the policy matrix is reviewed:** Razorpay subscriptions on the web dashboard only (about 3.5% including GST on fees), with signed webhooks, duplicate-event handling and reconciliation. Never linked from inside the apps.
- [ ] Annual gym billing ("pay 10 months, get 12") and referral rewards stay deferred unless pilots need them.

## 7.10 Consumer (B2C) plan details

Design: [ref-b2c.md](ref-b2c.md).

- [ ] Enforce the Free/Premium split (D-34) through the entitlement function: 2 starter programs vs the full library; 3 own routines vs unlimited; the 30-day history view; charts; the PR records page; progress photos; the monthly progress report.
- [ ] **Monthly progress report** (Premium): one in-app page with the month's sessions, volume, PRs and measurement changes.
- [ ] Paywall rules from ref-b2c: never block logging, export or deletion; show the Premium screen only when a member reaches for a Premium feature or once after a milestone; at most once a day; never during a workout; no fake countdowns or streak pressure.
- [ ] Introductory offer if D-35 is adopted: a 7-day free trial on the yearly plan, configured in both stores, with eligibility tested in sandbox.
- [ ] Store prices per country (D-36): India mapped to the nearest store tiers for ₹199 and ₹1,499; other countries set before launching there.

## Tests

- [ ] Entitlement unit tests covering the matrix: each plan, trial, grant, Premium, and expired and over-limit states.
- [ ] Concurrent invitations at the member limit: exactly the allowed number succeed.
- [ ] Founding-offer slot 51 is refused.
- [ ] Forged webhook (wrong or missing secret) is rejected.
- [ ] Replayed webhook (same ID) causes no change.
- [ ] Out-of-order events end in the correct state.
- [ ] A client attempt to write `consumer_entitlements` or `workspace_subscriptions` is denied.
- [ ] Sandbox results on both platforms recorded in `BILLING.md`.
- [ ] Free limits: a free user can't open a fourth routine, Premium programs, photos or history beyond the window, but can always log, export and delete. Upgrading unlocks them at once; downgrading never deletes data.

## Acceptance demo

1. A consumer buys Premium monthly on the iPhone and annual on Android (sandbox). Premium features unlock; the server shows the entitlement.
2. On a fresh install, Restore brings Premium back.
3. The subscription expires in sandbox; Premium features lock, and older history beyond 30 days is hidden but still exportable.
4. A gym member uses gym-covered features with no paywall.
5. A trial gym converts after you record a manual payment; the audit log shows who did what.
6. Ten simultaneous invites against a gym with 2 slots left: 2 succeed.

## Exit checklist

- [ ] `BILLING.md` with the policy matrix, decisions and sandbox results per platform
- [ ] All unresolved policy rows flagged; no flow active while its row is unresolved
- [ ] CI green

## Costs this part

RevenueCat is free under US$2,500 a month of tracked revenue (1% after). Store fees are 15% (Apple Small Business Program; Google subscriptions). Razorpay charges per transaction only when used.

## Risks

| Risk | Mitigation |
|---|---|
| Apple rejects web billing for trainer plans | Decide D-20 before submission; consider in-app purchase for trainer plans |
| Webhooks missed or out of order | Refetch state from RevenueCat; daily reconciliation |
| Store paperwork delays sandbox testing | Start 7.0 during Part 6 |
| Price points differ from targets | Stores use set price tiers per country; pick the nearest and record it |
