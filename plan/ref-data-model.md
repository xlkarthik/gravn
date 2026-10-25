# Reference: data model

A starting design for the Supabase Postgres schema, grouped by domain, with the part that introduces each table. Column lists show the important fields, not every one. Refine during each part, and keep the repo's migrations as the source of truth.

## Conventions

- `snake_case` names; plural table names.
- Primary keys are `uuid`. Rows created offline (sessions, sets, measurement entries) use IDs generated on the phone; others use `gen_random_uuid()`.
- Every table has `created_at timestamptz default now()`; mutable tables add `updated_at` (trigger-maintained).
- Store timestamps as `timestamptz` (UTC). Store calendar dates (measurement date, membership end) as `date`, with the user's or gym's timezone kept on the profile or workspace.
- Tenant-owned rows carry `workspace_id`. Composite foreign keys such as `(workspace_id, member_id)` make it impossible to reference a row from another workspace at the database level.
- Private personal rows carry `user_id` (owner) and are checked against `auth.uid()`.
- Prefer enums or check constraints over free text for states.
- Never reuse null to mean "public" or "all". Scope is explicit.
- Migrations are forward-only. Never edit a migration that has run anywhere shared; write a new one.
- RLS is on for every table, and every table has pgTAP tests.

## Identity and workspaces (Part 1)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `user_id` (PK, = `auth.users.id`), `display_name`, `timezone`, `locale`, `unit_system` (`metric`/`imperial`), `date_of_birth` or `age_confirmed` (per D-07) | Created by a trigger on sign-up |
| `workspaces` | `id`, `type` (`gym`/`coach`/`personal`), `name`, `timezone`, `created_by` | Exactly one `personal` workspace per user (unique partial index) |
| `workspace_members` | `id`, `workspace_id`, `user_id`, `status` (`active`/`archived`), `joined_at`, `archived_at` | Unique `(workspace_id, user_id)` |
| `member_roles` | `workspace_member_id`, `role` (`owner`/`trainer`/`member`) | A person can be owner and trainer in the same gym (D-26). A coach workspace uses owner + member roles for coach and clients. |
| `client_records` | `id`, `workspace_id`, `display_name`, `email`, `phone`, `created_by`, `claimed_by_member_id` | Pending people not yet signed up; never public |
| `invitations` | `id`, `workspace_id`, `email`, `role`, `client_record_id`, `token_hash`, `expires_at`, `accepted_at`, `revoked_at`, `created_by` | Only the hash is stored; single use; email must match on accept |
| `trainer_assignments` | `id`, `workspace_id`, `trainer_member_id`, `client_member_id`, `started_at`, `ended_at` | Composite FKs keep both in the same workspace |
| `platform_admins` | `user_id`, `can_publish_catalog`, `can_manage_billing` | Granted only by migration or an existing admin, audited |
| `app_config` | `key`, `value jsonb` | `min_supported_version`, flags |
| `audit_events` | `id`, `actor_user_id`, `workspace_id`, `action`, `target_type`, `target_id`, `metadata jsonb`, `created_at` | No sensitive payloads; pseudonymised on account deletion |

## Exercises and programs (Part 2; media in Part 5)

| Table | Key columns | Notes |
|---|---|---|
| `exercises` | `id`, `scope` (`global`/`workspace`/`personal`), `workspace_id`, `owner_user_id`, `name`, `instructions`, `tracking_type` (`weight_reps`/`reps`/`added_weight`/`assisted`/`time`/`distance`/`distance_time`/`activity`), `custom_fields jsonb`, `default_rest_seconds`, `review_status` | Check: global → both owner fields null; workspace → `workspace_id` set; personal → `owner_user_id` set |
| `muscle_groups`, `equipment` | `id`, `name_key` | Translation keys, not English text |
| `exercise_muscle_groups`, `exercise_equipment` | joins | |
| `exercise_media` | `id`, `exercise_id`, `storage_path`, `kind` (`video`/`image`/`thumbnail`), `duration_ms`, `bytes`, `status` (`pending`/`ready`/`rejected`), `media_asset_id` | |
| `media_assets` | `id`, `source`, `rights_holder`, `license`, `commercial_use`, `proof_url`, `release_form_ref`, `notes` | Licence manifest (also exported to `docs/asset-licenses.csv`) |
| `exercise_favorites` | `user_id`, `exercise_id` | |
| `activity_types` | `id`, `scope`, `workspace_id`, `owner_user_id`, `name`, `fields jsonb` | Classes, sports and custom activities (Part 5) |
| `plate_sets` | `id`, `scope`, `workspace_id`, `owner_user_id`, `bar_weight`, `unit`, `plates jsonb` | For the plate calculator (Part 5) |
| `programs` | `id`, `scope` (`global`/`workspace`/`personal`), `workspace_id`, `owner_user_id`, `name`, `description`, `created_by`, `client_member_id` (null = reusable template), `current_draft_version_id`, `archived_at` | |
| `program_versions` | `id`, `program_id`, `version_number`, `status` (`draft`/`published`), `published_at`, `published_by` | Published versions are immutable (trigger blocks updates) |
| `program_days` | `id`, `program_version_id`, `week_index`, `day_index`, `title`, `weekday_hint` | |
| `program_blocks` | `id`, `program_day_id`, `position`, `type` (`straight`/`superset`/`circuit`/`emom`/`amrap`/`interval`), `rounds`, `work_s`, `rest_s`, `time_cap_s` | Groups items; drives supersets, circuits and the interval timer |
| `program_items` | `id`, `program_day_id`, `block_id`, `exercise_id`, `position`, `tracking_type` (override), `rest_seconds`, `instructions`, `notes` | Targets live per set in `program_item_sets` |
| `program_item_sets` | `id`, `program_item_id`, `set_index`, `set_type` (`warmup`/`working`/`drop`/`failure`/`amrap`/`rest_pause`/`cluster`), `target_reps_min`, `target_reps_max`, `target_weight_value`, `target_weight_unit`, `target_percent_1rm`, `target_rpe`, `target_duration_s`, `target_distance_m`, `tempo`, `side`, `rest_seconds` | Per-set targets make pyramids and ramps possible |
| `assignments` | `id`, `workspace_id`, `client_member_id`, `program_version_id`, `start_date`, `status` (`active`/`ended`), `assigned_by`, `ended_at` | One active assignment per client (partial unique index), unless you decide otherwise |
| `training_profiles` | `user_id`, `goal`, `experience`, `days_per_week`, `equipment`, `updated_at` | Answers from the 60-second setup; drives program recommendations (Part 5) |
| `progression_rules` | `program_version_id`, `exercise_id`, `increment_value`, `increment_unit`, `rule` | Coach-set suggestion rules for Gravn library programs |

## Workout logging and sync (Part 2)

| Table | Key columns | Notes |
|---|---|---|
| `workout_sessions` | `id` (phone-generated), `user_id`, `workspace_id`, `assignment_id`, `program_version_id`, `program_day_id`, `planned_snapshot jsonb`, `status` (`in_progress`/`completed`/`abandoned`), `started_at`, `finished_at`, `logged_late` (backdated), `revision` | The snapshot freezes what was planned |
| `session_exercises` | `id`, `session_id`, `block_id`, `exercise_id`, `swapped_from_exercise_id`, `position`, `skipped`, `skip_reason`, `settings jsonb` (machine settings), `notes`, `revision` | |
| `session_sets` | `id`, `session_exercise_id`, `set_index`, `planned_reps`, `planned_weight_value`, `planned_weight_unit`, `actual_reps` (null = not recorded), `actual_weight_value`, `actual_weight_unit`, `actual_weight_kg` (generated), `set_type`, `actual_duration_s`, `actual_distance_m`, `actual_calories`, `rpe`, `side` (`left`/`right`/`both`), `custom_values jsonb`, `state` (`not_recorded`/`completed`/`incomplete`/`skipped`), `completed_at`, `revision` | 0 is a real value; null is "no data" |
| `session_comments` | `id`, `session_id`, `author_user_id`, `body`, `created_at`, `edited_at`, `hidden_at` | Feedback thread, member + assigned trainer |
| `sync_operations` | `user_id`, `op_id`, `op_type`, `result jsonb`, `received_at` | PK `(user_id, op_id)` makes replays idempotent; pruned after 90 days |
| `sync_conflicts` | `id`, `user_id`, `entity_type`, `entity_id`, `client_version jsonb`, `server_version jsonb`, `resolved_at`, `resolution` | Nothing is discarded silently |

## Measurements and progress (basic in Part 3; custom in Part 5)

| Table | Key columns | Notes |
|---|---|---|
| `measurement_definitions` | `id`, `scope` (`global`/`workspace`/`personal`), `workspace_id`, `owner_user_id`, `key`, `archived_at` | Global standard set seeded: weight, height, body fat, chest, waist, hip, neck, shoulders, arms, thighs, calves |
| `measurement_definition_versions` | `id`, `definition_id`, `version`, `label`, `unit_kind`, `unit`, `min_value`, `max_value`, `decimals` | A new version on any change |
| `measurement_entries` | `id` (phone-generated), `subject_user_id`, `workspace_id` (null = personal), `definition_version_id`, `value`, `unit`, `value_canonical`, `measured_on` (date), `recorded_by`, `note` | Label and unit come from the version recorded with |
| `personal_records` (optional cache) | `user_id`, `exercise_id`, `record_type`, `value`, `session_id`, `achieved_at` | Recomputable from sets; formulas in `packages/shared` |

## Photos, notes, sharing and consent (Part 5)

| Table | Key columns | Notes |
|---|---|---|
| `progress_photos` | `id`, `user_id`, `storage_path`, `taken_on`, `note`, `width`, `height`, `bytes`, `created_at` | Private by default |
| `photo_shares` | `id`, `photo_id` (null = all photos), `owner_user_id`, `grantee_user_id`, `workspace_id`, `purpose` (`coaching`), `granted_at`, `revoked_at` | To a person, never to a whole workspace |
| `history_shares` | `id`, `owner_user_id`, `grantee_user_id`, `workspace_id`, `granted_at`, `revoked_at` | Personal workout history shared with a trainer |
| `notes` | `id`, `workspace_id`, `subject_member_id`, `author_user_id`, `visibility` (`trainers_only`/`shared_with_member`), `body`, `session_id` | |
| `consents` | `id`, `user_id`, `type` (`terms`/`privacy`/`photo_share`/`parental`/…), `version`, `granted_at`, `withdrawn_at` | |
| `content_reports` | `id`, `reporter_user_id`, `target_type`, `target_id`, `reason`, `status`, `handled_by`, `handled_at` | |
| `user_blocks` | `blocker_user_id`, `blocked_user_id` | |

## Gym operations and notifications (Parts 3 and 6)

| Table | Key columns | Notes |
|---|---|---|
| `gym_memberships` | `id`, `workspace_id`, `member_id`, `plan_label`, `start_date`, `end_date`, `status` (`active`/`paused`/`expired`/`cancelled`), `notes` | The member's physical membership; no payment data |
| `attendance` | `id`, `workspace_id`, `member_id`, `attended_on`, `checked_in_at`, `recorded_by`, `method` (`manual`) | Unique per member per day unless you allow multiple visits |
| `workspace_branding` | `workspace_id`, `logo_path`, `accent_color` | Gated by plan |
| `notifications` | `id`, `user_id`, `workspace_id`, `type`, `title_key`, `body_key`, `params jsonb`, `route`, `dedupe_key` (unique), `created_at`, `read_at` | Inbox; no sensitive data |
| `notification_preferences` | `user_id`, `type`, `push`, `email`, `quiet_start`, `quiet_end` | |
| `push_tokens` | `id`, `user_id`, `device_id`, `platform`, `token`, `last_seen_at`, `revoked_at` | |
| `notification_deliveries` | `id`, `notification_id`, `channel`, `status`, `provider_ref`, `attempts`, `last_error` | |

## Plans and billing (Part 7)

| Table | Key columns | Notes |
|---|---|---|
| `features` | `key`, `description`, `status` (`available`/`future`) | Only `available` features can be advertised |
| `plans` | `code`, `audience` (`gym`/`trainer`/`consumer`), `name`, `target_price_inr`, `billing_period`, `member_limit`, `client_limit`, `version`, `active` | Targets from the business plan |
| `plan_features` | `plan_code`, `plan_version`, `feature_key` | |
| `workspace_subscriptions` | `id`, `workspace_id`, `plan_code`, `status` (`trialing`/`active`/`past_due`/`read_only`/`cancelled`/`expired`), `source` (`trial`/`manual`/`grant`/`razorpay`), `founding_offer`, `current_period_start`, `current_period_end` | Written only by server code |
| `access_grants` | `id`, `workspace_id`, `plan_code`, `starts_at`, `ends_at`, `reason`, `granted_by`, `revoked_at`, `revoked_by` | Audited, time-limited |
| `founding_offer_slots` | `slot_number` (1–50), `workspace_id`, `claimed_at` | The table's size enforces the 50-gym cap |
| `manual_payments` | `id`, `workspace_id`, `amount_inr`, `paid_on`, `method` (`upi`/`bank`), `reference`, `invoice_number`, `recorded_by` | |
| `consumer_entitlements` | `user_id`, `entitlement` (`premium`), `active`, `expires_at`, `store`, `product_id`, `environment` (`sandbox`/`production`), `period_type`, `updated_from_event_id`, `updated_at` | Written only by the webhook and reconciliation job |
| `billing_events` | `id`, `provider` (`revenuecat`/`razorpay`), `event_id` (unique per provider), `type`, `app_user_id`, `environment`, `payload jsonb`, `received_at`, `processed_at`, `error` | Raw log; duplicates ignored |

## Privacy operations (Parts 3 and 5)

| Table | Key columns | Notes |
|---|---|---|
| `deletion_requests` | `id`, `user_id`, `email`, `source` (`in_app`/`web`), `status` (`requested`/`verified`/`scheduled`/`processing`/`completed`/`cancelled`), `verification_token_hash`, `scheduled_for`, `completed_at` | Kept minimally after completion as proof of deletion (no profile data) |
| `data_exports` | `id`, `user_id`, `status`, `storage_path`, `expires_at` | Files deleted after expiry |
| `rate_limits` | `key`, `window_start`, `count` | Simple fixed-window limiter for edge functions |

## Engagement (Parts 2, 3, 5, 6)

Design: [ref-engagement.md](ref-engagement.md). All computed by server code from synced sessions; clients never write award rows.

| Table | Key columns | Notes |
|---|---|---|
| `activity_events` | `id`, `user_id`, `workspace_id`, `type` (`session_completed`/`pr`/`badge`/`high_five`/`share`/`streak_week`), `ref_id`, `created_at` | Feeds recaps, metrics and the future community feed; never stores measurements, photos or notes |
| `personal_records` | (see Measurements and progress) | Now also drives live PR celebrations |
| `streaks` | `user_id`, `scope_workspace_id` (null = personal), `weekly_target`, `current_weeks`, `best_weeks`, `last_counted_week`, `freezes_available`, `paused_until`, `paused_by` | One row per user per scope; recomputable |
| `lifetime_stats` | `user_id`, `total_kg`, `sessions_completed`, `updated_at` | Total lifted; recomputable from sets |
| `achievements` | `key`, `category`, `tier`, `title_key`, `description_key`, `criteria jsonb`, `active` | Server-defined catalog |
| `user_achievements` | `user_id`, `achievement_key`, `earned_at`, `source_session_id` | Unique `(user_id, achievement_key)` makes awarding idempotent |
| `high_fives` | `id`, `session_id`, `from_user_id`, `to_user_id`, `comment`, `created_at` | Unique `(session_id, from_user_id)` |
| `weekly_recaps` | `user_id`, `week_start`, `stats jsonb`, `delivered_at` | One per user per week |
| `challenges` | `id`, `workspace_id`, `title`, `metric` (`sessions`/`streak_weeks`), `target`, `starts_on`, `ends_on`, `created_by` | Owner-created, gym-only |
| `challenge_participants` | `challenge_id`, `member_id`, `joined_at`, `left_at` | Opt-in |

## Indexes to add from the start

- `workspace_members (user_id, workspace_id)` and `(workspace_id, status)`
- `trainer_assignments (trainer_member_id) where ended_at is null`
- `assignments (client_member_id) where status = 'active'`
- `workout_sessions (user_id, started_at desc)` and `(workspace_id, started_at desc)`
- `session_exercises (exercise_id)` for previous-performance lookups (with the session's user)
- `measurement_entries (subject_user_id, definition_version_id, measured_on)`
- `notifications (user_id, created_at desc)`, unique `dedupe_key`
- `gym_memberships (workspace_id, end_date)` for expiry lists
- Trigram index on `exercises.name` for search

## Retention (proposed; confirm with the lawyer)

| Data | Kept for |
|---|---|
| Account data | Until the user deletes the account |
| Gym roster and membership records after a member leaves | Decision D-08 (proposed: while the gym's account exists, archived) |
| `sync_operations` | 90 days |
| Exports | 24 hours |
| Audit events | 1–2 years, pseudonymised after account deletion |
| Billing events | As the CA advises for tax records |
| Backups | Supabase daily backups 7 days; your weekly copies: keep 4–8 weeks, then delete (deleted users disappear from backups as they age out) |
