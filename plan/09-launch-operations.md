# Part 9: Launch and operations

**Goal:** release publicly without surprises, then run Gravn as a small, steady business: weekly checks, predictable upgrades, clear triggers for spending more.
**Depends on:** Part 8 approval.

## 9.1 Launch week

- [ ] Android: staged rollout starting at about 10%. Hold if crash-free sessions drop below 99% or any P0 appears.
- [ ] iOS: phased release; pause it if problems appear.
- [ ] Message pilot gyms: what changed, how members move from TestFlight or Play testing to the store version.
- [ ] Watch Sentry, Supabase logs and support messages at least twice a day.
- [ ] Rollback options, written down before launch:
  - Halt the staged or phased rollout.
  - Ship a fix build (both stores; iOS review can take a day or more).
  - JS-only fix through EAS Update, if enabled.
  - Revert a migration only through a forward migration; never edit production by hand.

## 9.2 Weekly operating rhythm

| When | Task |
|---|---|
| Weekly | Business metrics from the report's section 15: MRR, net new MRR, gym churn, activation, member weekly activity, trainer engagement, B2C conversion, support load |
| Weekly | Sentry new issues; sync errors older than 24 hours; failed scheduled jobs |
| Weekly | Support inbox and WhatsApp to zero; tag every issue |
| Weekly | Consumer funnel from [ref-b2c.md](ref-b2c.md#funnel-metrics): install, activation, retention, Premium conversion, renewals, refunds |
| Monthly | Cloud bills vs `COSTS.md`; usage vs plan limits (database size, storage, egress, monthly users, emails) |
| Monthly | Dependency updates (patch and minor); security advisories |
| Monthly | Check a backup restores (rotate: database one month, storage the next) |
| Quarterly | Full restore drill; review access (who has admin, which keys exist) and rotate keys |
| Each Expo SDK release (about 3 a year) | Upgrade within a couple of months; read the changelog for minimum OS changes |
| Yearly | Apple developer renewal; domain renewal; legal page review |

## 9.3 Store rules that change on a schedule

- **Google Play** raises the required target Android API level each year (usually from 31 August). New Expo SDKs keep up; plan an SDK upgrade before the deadline.
- **Apple** requires builds from newer Xcode and iOS SDK versions each spring. EAS build images track this.
- Re-read the Apple guidelines and Google payments policy before each major release that touches billing. Update `BILLING.md`.

## 9.4 Scaling triggers

From the cost page's model. Upgrade when the trigger hits, not before.

| Trigger | Action | Added cost |
|---|---|---|
| Free build queue slows releases | EAS Starter | US$19/month |
| More than 3,000 emails a month or 100 a day | Resend Pro | US$20/month |
| More than 5,000 errors a month, or a second person needs access | Sentry Team | ~US$26/month |
| Database CPU or memory regularly above 70%, or slow queries after indexing | Next Supabase compute size (Small +$5, Medium +$50) | See the cost page |
| Data you can't afford to lose a day of (many paying gyms) | Point-in-time recovery | US$100/month |
| More than 100,000 requests a day on the dashboard | Cloudflare Workers paid | US$5/month |
| Premium revenue above US$2,500 a month | RevenueCat starts charging 1% | Automatic |
| Over-the-air updates for more than 3,000 users | EAS Update usage | US$0.005 per user |
| Support takes more than a day a week | Part-time support help | Salary |
| Over 300 GB of monthly data transfer | Put a CDN in front of media; compress demos further | Varies |

## 9.5 Incident response

Keep the full runbook in `docs/runbooks/incident.md`. Summary:

1. **Contain:** lock affected accounts, rotate leaked keys, disable the faulty feature through `app_config`, halt rollouts.
2. **Assess:** what data, whose, how many, since when. Use audit logs.
3. **Notify:** for a personal-data breach, the DPDP Rules require informing the Data Protection Board and affected people within set timelines. Call your lawyer the same day. Tell affected gyms directly.
4. **Fix and verify:** patch, add a regression test, confirm the fix in production.
5. **Write up:** a short post-incident note in `docs/incidents/`, with follow-up tasks.

## 9.6 Compliance calendar

| Date or cadence | Item |
|---|---|
| About 13 May 2027 | Most DPDP Rules duties apply: notice, consent, security safeguards, breach reporting, erasure, children's data |
| Yearly | Apple Developer Program renewal (₹8,700) |
| Yearly | Domain renewal |
| As advised by the CA | GST returns, income tax, TDS reconciliation; ROC filings if a company |
| Yearly | Legal page review; re-confirm data retention periods |
| Each release | Store privacy forms match `PRIVACY_DATA_MAP.md` |

## 9.7 Deferred backlog

From the build prompt and business report. Revisit each only when users ask for it repeatedly or it unlocks revenue.

| Item | Why deferred | Revisit when |
|---|---|---|
| Malayalam translation | Strings are ready; translation costs money and review time | Pilots or sales show members need it |
| Trainer web program builder | Phone-first for launch | Trainers ask to build on laptops |
| Referral rewards | Not needed for pilots | After 20+ paying gyms |
| Annual gym billing (pay 10, get 12) | Manual invoices first | Owners ask for yearly invoices |
| ₹299 Premium tier | No extra features yet | AI insights or deeper reports exist |
| SMS one-time-password login | Recurring cost | Email sign-in blocks real users |
| Google or Apple sign-in | Adding any third-party sign-in on iOS triggers Apple's guideline 4.8 (offer Sign in with Apple or an equivalent) | Sign-up drop-off is high |
| WhatsApp automation | Cost and policy work | Manual WhatsApp support becomes too slow |
| The Gravn community: feed, follows, reactions, comments, real-time chat | Moderation load; it builds on the engagement layer's activity events, share cards and high-fives | Strong demand; moderation staffed |
| Physical membership payment collection | Separate payment and tax rules | Gyms insist; legal and tax review done |
| White-label apps | Separate store listings and maintenance per gym | Business tier demand with setup fees |
| Enterprise branches and chains | Complexity | Real chain customer |
| AI coaching, nutrition, wearables, payroll, accounting, CRM | Out of scope for this release | Product–market fit proven |
| Full offline gym administration | Not required | Owners need it in low-signal gyms |
