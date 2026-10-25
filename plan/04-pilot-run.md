# Part 4: Pilot run

**Goal:** prove with 3–5 real gyms that trainers and members use Gravn every week, find what's missing, and finish Google's closed-test requirement.
**Duration:** 4–8 calendar weeks. It runs **alongside** Parts 5 and 6; split your time about 70% building and 30% pilot support and fixes.
**Depends on:** Part 3.

## 4.1 Onboarding each gym

The business report's advice: sit with the owner, set up the gym during the visit, build one workout together, and let the owner see the member experience straight away.

- [ ] Visit in person. Follow the onboarding checklist from Part 3.
- [ ] Before you leave: at least 1 trainer active, at least 5 members invited, the first program published and assigned, and one member has logged a set in front of you.
- [ ] Leave the printed quick starts and the support WhatsApp number.
- [ ] Note the time it took and every point where they got stuck.

## 4.2 Weekly rhythm

| Day | Task |
|---|---|
| Monday | Check the metrics below; message any gym whose numbers dropped |
| Midweek | 15-minute call or visit with each owner or head trainer |
| Friday | Triage the week's feedback; plan next week's fixes; update `STATUS.md` |

## 4.3 Metrics

The report's weekly metrics, with proposed pilot targets. These targets are a starting point, not agreed numbers.

| Metric | Definition | Proposed pilot target |
|---|---|---|
| Activation | Gym added a trainer, 5+ members and a first logged workout within 7 days | Every pilot gym |
| Weekly active members | Members who logged at least one workout this week ÷ invited members | 50% by week 3 |
| Trainer engagement | Trainers who created or updated a plan or measurement this week | 75% of trainers |
| Sessions per active member | Logged sessions per week | 2+ |
| Day-30 retention | Activated members still logging 30 days after their first session | 40%+ |
| High-fives | High-fives sent per trainer per week | 5+ |
| Sync health | Operations stuck in error for more than 24 hours | 0 |
| Crash-free sessions | From Sentry | 99%+ |
| Support load | Messages per gym per week, and your time spent | Falling week over week |

Compute these from the database with SQL views that only platform admins can read. No third-party analytics needed.

## 4.4 Triage rules

| Priority | Examples | Response |
|---|---|---|
| P0 | Data loss, wrong person sees data, can't sign in, sync stuck | Fix the same day; tell the affected gym |
| P1 | Blocks a core task (can't assign, can't log) | Fix this week |
| P2 | Slow, confusing or annoying | Backlog; batch into the next release |
| Idea | New feature requests | Log with the gym's name; count repeats before building |

Keep an issue list in GitHub Issues with labels `pilot`, `P0`, `P1`, `P2`, `idea`.

## 4.5 Things to learn during the pilot

Each answer updates [ref-decisions-risks.md](ref-decisions-risks.md):

- [ ] Weekday schedule vs sequence (D-10)
- [ ] Do owners want to see members' measurements, or only trainers? (D-12)
- [ ] Is manual attendance useful, or is it busywork?
- [ ] Which reminders do owners actually want?
- [ ] Does any trainer build programs on a laptop? (decides whether a web program builder moves up)
- [ ] Malayalam: needed for members, trainers, or neither?
- [ ] Pricing: would they pay the founding price? Which tier fits their member count? Monthly or yearly?
- [ ] Which exercises are missing from the catalog?
- [ ] Which rewards do members mention or react to (PRs, streaks, high-fives, the finish screen), and which feel like noise?

## 4.6 Data and safety during the pilot

- [ ] Real personal data lives only in production. Never copy it to staging or your laptop.
- [ ] Look at real member data only when needed to fix a reported problem, and note that you did in the issue.
- [ ] If anything could have exposed data, follow the incident runbook ([09-launch-operations.md](09-launch-operations.md#95-incident-response)) and talk to the lawyer.

## 4.7 Closing the pilot

- [ ] Google closed test: 12+ testers opted in for 14 continuous days, then apply for production access in Play Console.
- [ ] Ask each gym for a short written or video testimonial (with consent) and permission to name them.
- [ ] Offer the founding plan and record who accepts. Payment collection comes in Part 7; until then, record it manually.
- [ ] Write a one-page pilot report in `docs/research/pilot-report.md`: metrics, top problems, decisions made, what to build next.

## Exit checklist

- [ ] At least 3 gyms used Gravn weekly for 3+ consecutive weeks
- [ ] No open P0 issues
- [ ] Google production access granted (or the organisation account is exempt)
- [ ] Pilot report written; decision log updated
- [ ] At least one testimonial or case study

## Costs this part

Supabase Pro continues (~₹2,500/month). Travel for visits is in the report's ₹12,000/month sales budget.

## Risks

| Risk | Mitigation |
|---|---|
| Trainers stop updating plans after week 1 | Watch them use it; make copying last week's plan one tap; ask what they still do in WhatsApp |
| Members don't install | Install with them at the gym; the owner announces it; a poster with the test link |
| Pilot support eats all build time | Batch fixes into weekly releases; cap support time; route questions to the quick starts |
| Pilot gyms expect custom features | Log requests; build only what two or more gyms ask for |
