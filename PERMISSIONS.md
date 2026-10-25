# Permissions

The full matrix is [plan/ref-permissions.md](plan/ref-permissions.md). This file maps each Part 1 & Part 2 rule
to where it's enforced and which test proves it. Everything is enforced in the database; the apps only
hide what you can't use.

| Rule                                                                                                                                               | Enforced by                                                           | Test                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| Members see themselves and their gym's staff, never other members                                                                                  | `workspace_members` and `profiles` policies                           | `001`, `003`        |
| Trainers see only assigned, active clients                                                                                                         | `private.is_assigned_trainer`                                         | `001`, `003`, `006` |
| Owners see the whole roster, archived included, and nothing in other gyms                                                                          | `private.has_role(…, 'owner')`                                        | `001`, `003`        |
| Personal workspaces are invisible to everyone else, including admins                                                                               | `workspaces` policy, admin RPC excludes `personal`                    | `002`, `003`        |
| Nobody inserts or edits memberships or roles directly                                                                                              | No grants on `workspace_members`; RPCs only                           | `003`               |
| Owners invite trainers (gyms only) and members; trainers invite members; nobody invites owners                                                     | `create_invitation`                                                   | `004`               |
| Invitations: hashed, single use, 7-day expiry, revocable; bound to a verified email (or open single-use link when tied to a `client_record`, D-57) | `invitations` table and RPCs                                          | `004`               |
| Gym owners can opt into/out of the `trainer` role on themselves; coach creators get `{owner,trainer}`                                              | `create_workspace`, `set_owner_trainer`                               | `002`               |
| Trainers manage only the pending clients they added; owners manage all                                                                             | `private.owner_or_creating_trainer`                                   | `005`               |
| Only owners assign trainers, and only within the gym                                                                                               | `assign_trainer`, composite foreign keys                              | `006`               |
| Removing someone ends their access on their next request and ends their assignments                                                                | `remove_member`; every policy checks `status = 'active'`              | `007`               |
| A workspace always keeps an owner                                                                                                                  | `remove_member` (`last_owner`)                                        | `007`               |
| A role in one gym gives nothing in another                                                                                                         | All helpers take the workspace ID                                     | `008`               |
| Nobody can make themselves a platform admin or change config                                                                                       | No write grants                                                       | `009`               |
| Admins see workspace counts only                                                                                                                   | `admin_workspaces`                                                    | `009`               |
| Signed-out users can read only `app_config` and call only `get_invitation`                                                                         | Grants                                                                | `011`               |
| Global exercises are read-only unless `can_publish_catalog()`; workspace exercises require staff; personal exercises are private to their owner    | `exercises` policies, `private.can_publish_catalog`                   | `012`               |
| Published `program_versions`, `program_days`, and `program_items` are immutable; edits clone into a new draft (`create_program_draft`)             | `private.guard_published_version` trigger, `program_*` policies       | `012`               |
| Members read only program versions assigned to them; trainers manage programs and assign them only to their assigned clients                       | `private.can_read_program_version`, `assign_program`                  | `012`               |
| Workout sessions and sets are writable only by their owner; assigned trainers and workspace owners can read sessions and post `session_comments`   | `private.owns_session`, `private.can_access_session`, `sync_push` RPC | `012`               |
| Offline `sync_push` is idempotent per `(user_id, op_id)`, rejects cross-tenant operations, and logs revision mismatches to `sync_conflicts` (D-59) | `sync_push` RPC, `sync_operations`, `sync_conflicts`                  | `012`               |

Tests live in `supabase/tests/` and run with `pnpm db:test`.

## Leaving a gym (D-08, proposed)

An archived member keeps sight of the workspace itself, so their history stays reachable once it
exists (Part 2). The gym keeps the archived roster entry. Trainer assignments end, and restoring
someone doesn't bring them back.

**Offline limit:** a removed person's phone shows its cached workspace list until the app next
reaches the server. Then the list is refreshed and data for lost workspaces is dropped.
