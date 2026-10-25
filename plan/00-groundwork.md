# Part 0: Groundwork

**Goal:** clear the slow, non-code blockers before they stall the build.
**When:** start now. Most items run alongside Part 1, and several involve waiting (identity checks, D-U-N-S numbers, lawyer turnaround).
**Effort:** about a week of your time, spread over 2–4 calendar weeks.
**Depends on:** nothing.

## 0.1 Name and brand

The product is called **Gravn** (decided 10 Oct 2026; "GymOS" was already taken). Logo files in the main folder: `Gravn_Logo.png` (primary, tagline "Gravity builds intensity") and `Gravn_Logo_Mono.png` (flat version, tagline "Train • Track • Improve").

- [ ] Trademark search for "Gravn" on WIPO's Global Brand Database, USPTO, EUIPO and IP India, especially classes 9 (software), 41 (fitness training) and 42 (SaaS). Watch for **Gravl**, an existing AI personal-trainer app one letter away; get a lawyer's view on the confusion risk before filing.
- [ ] Register the domains. All of these were free when checked on 10 Oct 2026: `gravn.app`, `getgravn.com`, `joingravn.com`, `gravnapp.com`, `gravnhq.com`. One main domain serves app links, sending email, legal pages and the owner dashboard.
- [ ] Reserve the app name "Gravn" by creating the app record in App Store Connect as soon as the Apple account is active.
- [ ] Choose the bundle ID / application ID in reverse-domain form from the main domain (for example `app.gravn.mobile` if `gravn.app` is the main domain). **It can never change after the first store release.**
- [ ] Decide and write down the pronunciation (for example "GRAV-en") so everyone says it the same way. "Graven" means "the grave" in Swedish, Norwegian and Danish, so test it with Scandinavian speakers before launching there.
- [ ] Optional: reserve social media handles.

## 0.2 Business and legal

- [ ] Choose a legal entity with a CA. The choice affects store accounts:

  | | Individual | LLP or private limited company |
  |---|---|---|
  | Seller name shown in stores | Your personal name | The company name |
  | Google's 12-tester closed-test rule | Applies | Exempt (organisation account) |
  | D-U-N-S number | Not needed | Needed (free, can take 1–2 weeks) |
  | Yearly compliance cost | Low | Higher (filings; audit for a private limited company) |
  | Liability in gym contracts | Personal | Limited |

- [ ] Open a business bank account. You'll need it for store payouts and gym invoices.
- [ ] Ask the CA about:
  - GST registration (₹20 lakh services threshold) and whether selling through the stores changes that.
  - GST on Google Play sales: Google says Indian developers determine their own GST and pay GST on Google's service fee; Google deducts TDS and GST TCS.
  - Apple: proceeds in India are calculated on the tax-exclusive price.
  - GST invoices for gyms, and whether founding-offer prices include or exclude GST.
- [ ] Engage a lawyer (needed by Part 3) for:
  - privacy policy and terms of use
  - a data-processing agreement with gyms (who is responsible for member data: the gym, Gravn, or both)
  - DPDP Act readiness (most duties apply from about 13 May 2027)
  - age policy: 18+ only, or parental consent for younger members
  - photo consent wording

## 0.3 Accounts

Use a business email you control (not a personal Gmail) so the accounts can be handed over later. Turn on two-factor authentication everywhere and store credentials in a password manager.

- [ ] **Apple Developer Program** (₹8,700/year). Needed in Part 1: on Windows, the only way to run the app on an iPhone is an EAS build installed through ad hoc provisioning. Organisation enrolment needs the D-U-N-S number.
- [ ] **Google Play Console** (US$25 once). Identity verification can take several days.
- [ ] **Expo** account (free). Create the project.
- [ ] **GitHub** account with a private repository (free).
- [ ] **Supabase** account (free). Don't create the production project until Part 3.
- [ ] Later, when the part calls for it: Resend and Cloudflare (Part 3), Sentry (Part 1 or 3), RevenueCat (Part 7), Razorpay (Part 7, only if automating gym billing), and a free Meta for Developers app to get the Facebook App ID that one-tap Instagram Stories sharing requires (Part 5).

## 0.4 Devices

- [ ] An iPhone on iOS 16.4 or later; current iOS is better. Expo SDK 57's minimum is 16.4, and future SDKs will raise it.
- [ ] A low-end Android phone (2–3 GB RAM class). Many members will use these, and it shows performance problems early.
- [ ] Your everyday Android phone as a second Android device.
- [ ] Android emulator through Android Studio.

## 0.5 Windows development machine

- [ ] Node.js LTS (Node 24 is already installed) and pnpm (enable with `corepack enable`).
- [ ] Git and VS Code.
- [ ] Docker Desktop with WSL2. The local Supabase stack runs about ten containers; 16 GB of RAM is comfortable.
- [ ] Android Studio with the Android SDK and an emulator image. JDK 17 is only needed if you build Android locally instead of on EAS.
- [ ] Supabase CLI and EAS CLI.
- [ ] Maestro CLI for mobile end-to-end tests (check its current Windows install instructions; it may need WSL2).
- [ ] Note: the iOS Simulator doesn't exist on Windows. All iOS testing happens on the physical iPhone through EAS builds.

## 0.6 Pilot gyms, testers and content

- [ ] Shortlist 8–10 Kerala gyms and aim for 3–5 pilots: one small gym where the owner also trains, one mid-size gym with 2+ trainers, and one independent trainer.
- [ ] Interview owners and trainers for 30 minutes each:
  - How do they plan and send workouts today (WhatsApp, paper, spreadsheet)?
  - How many members, and how many would use an app?
  - Which phones do members use?
  - What would they pay?

  Keep notes in `docs/research/`; they'll settle several decisions.
- [ ] Draft a one-page pilot agreement: free during the pilot, then the founding offer; how data is handled; permission to use their feedback.
- [ ] Find a trainer to film exercise demos (Part 5) and agree a release form.
- [ ] Line up 15–20 Android testers (pilot members, friends) for Google's closed test in Part 3. Twelve must stay opted in for 14 continuous days, so recruit spares.

## 0.7 Decisions to make before Part 1

See [ref-decisions-risks.md](ref-decisions-risks.md) for proposed defaults.

- [x] D-01 App name: **Gravn** (decided 10 Oct 2026). The bundle ID is still open (see 0.1).
- [ ] D-02 Package manager (proposed: pnpm workspaces)
- [ ] D-03 Supabase region (proposed: Mumbai)
- [ ] D-04 Keep business documents outside the code repo or in a private `docs/business/` folder

## Exit checklist

- [ ] Apple and Google developer accounts active
- [ ] iPhone and Android test phones in hand
- [ ] Docker, the Android emulator and both CLIs run on the PC
- [ ] Name, domain and bundle ID decided
- [ ] At least 3 gym interviews done; ideally 3 gyms agreed to pilot
- [ ] Lawyer and CA engaged, with a date for the legal pages

## Costs this part

Apple ₹8,700/year, Google ₹2,400 once, domain ₹800–1,500/year, devices ₹0–35,000. CA and lawyer fees start here (₹35,000–80,000 across Parts 0–3, per the business report's ranges).

## Risks

| Risk | Mitigation |
|---|---|
| "Gravn" is refused or challenged as too close to Gravl or another mark | Trademark search and a lawyer's opinion before registering domains or printing anything; keep a backup name |
| Apple or Google identity checks stall | Start on day one; Part 1 can run on the Android emulator while iOS waits |
| No gyms agree to pilot | Interviews still shape the product; offer a longer free period; start with an independent trainer |
