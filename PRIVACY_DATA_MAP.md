# Privacy Data Map (Google Play Data Safety & DPDP Compliance)

Last updated: 25 Oct 2026 (`Part 3: Pilot Readiness`, `§3.5`).

This document maps every user data type collected by **Gravn** (`@gravn/web` & `@gravn/mobile`) to Google Play Data Safety categories, storage tables, encryption controls, and deletion behavior.

## 1. Data Inventory & Google Play Data Safety Mapping

| Google Play Category        | Data Type                                            | Required / Optional | Database Tables                                                                              | Purpose                                                      | Shared with Third Parties?                                | Deleted on Account Deletion? |
| --------------------------- | ---------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| **Personal Info**           | Name (`display_name`)                                | Required            | `user_profiles`, `client_records`                                                            | Account identification, coach roster display                 | No (visible only within joined workspaces via RLS)        | Yes                          |
| **Personal Info**           | Email address                                        | Required            | `auth.users`, `invitations`, `deletion_requests`                                             | Authentication, workspace invitations, account deletion      | No                                                        | Yes                          |
| **Personal Info**           | Phone number                                         | Optional            | `user_profiles`, `client_records`                                                            | Optional gym/coach contact coordination                      | No                                                        | Yes                          |
| **Health and Fitness**      | Workout sessions, sets, PRs, streaks                 | Core functionality  | `workout_sessions`, `session_exercises`, `sets`, `personal_records`, `streaks`, `high_fives` | Workout logging, split adherence, progression, coach review  | No (visible only to assigned trainer/owner in a gym)      | Yes                          |
| **Health and Fitness**      | Body measurements (weight, body fat, circumferences) | Optional            | `measurement_definitions`, `measurement_entries`                                             | Progress charts and body composition tracking                | No (visible only to subject + authorized workspace coach) | Yes                          |
| **App Activity & Messages** | Coach session comments & problem reports             | Optional            | `comments`, `notifications`, `problem_reports`                                               | Trainer-member feedback, high-fives, pilot bug reporting     | No                                                        | Yes                          |
| **Device or Other IDs**     | Expo push token                                      | Optional            | `push_tokens`                                                                                | Delivering workout, invite, and coach feedback notifications | Expo Push Service (delivery transport only)               | Yes                          |

## 2. Security & Encryption Controls

1. **In Transit:** All API traffic between Next.js/Expo clients and Supabase uses HTTPS / TLS 1.3.
2. **At Rest (Cloud):** PostgreSQL storage encrypted at rest; every table in `public` enforces Row-Level Security (`RLS`) policies verified by pgTAP tests (`supabase/tests/001`–`012`).
3. **At Rest (Mobile Offline Queue):** Local SQLite workout & measurement queues (`apps/mobile/src/lib/offline.ts`) encrypt sensitive JSON payloads with AES-GCM using a 256-bit key stored in Expo `SecureStore` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
4. **PII Scrubbing:** Client-side error and problem reports omit health measurements, passwords, and raw tokens.

## 3. Account & Data Deletion Flows

Gravn provides two compliant deletion paths required by Google Play and Apple App Store guidelines:

1. **In-App Self-Service Deletion:**
   - **Web:** `Personal Studio → Profile → Delete Account` (calls `request_account_deletion` RPC).
   - **Mobile:** `Profile → Privacy → Delete My Account & Data` (flushes/discards local encrypted SQLite outbox and calls `request_account_deletion` RPC).
2. **Public Web Deletion Portal (No App Install Required):**
   - **URL:** `/delete-account` (`apps/web/app/delete-account/page.tsx`)
   - Allows any user to submit a permanent deletion request by email address (`request_public_deletion` RPC).
