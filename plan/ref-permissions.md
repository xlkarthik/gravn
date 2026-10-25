# Reference: permissions

Who can see and change what. This seeds the repo's `PERMISSIONS.md` in Part 1, and every row here needs a database test. "Own" means rows about the signed-in user. Everything is enforced by RLS, RPCs and server functions, never by hiding buttons.

## Roles

| Role | Where it exists | How it's granted |
|---|---|---|
| Owner | Gym or coach workspace | Creating the workspace, or an ownership transfer the new owner accepts |
| Trainer | Gym workspace | Owner's invitation, accepted by the person |
| Member | Gym workspace | Owner's or trainer's invitation, or claiming a pending client record |
| Coach | Coach workspace (independent trainer) | Creating the workspace. Stored as the owner role; acts as owner and trainer. |
| Client | Coach workspace | Coach's invitation. Stored as the member role. |
| Personal user | Their own personal workspace | Automatic for every account |
| Platform admin | Gravn itself (web only) | Migration or an existing admin; audited |

A person can hold different roles in different workspaces. Being a trainer in Gym A gives nothing in Gym B. One person may be owner and trainer in the same gym (D-26), which is common in small gyms.

Nobody can change their own role or entitlements. Role changes go through RPCs that check the caller is an owner. A workspace always keeps at least one owner.

## Gym workspace matrix

**R** = read, **W** = create/update/delete. Conditions follow the letter.

| Data | Owner | Trainer | Member | Platform admin |
|---|---|---|---|---|
| Workspace profile, branding | R W | R | R (name, logo) | R |
| Invite or remove trainers | W | — | — | — |
| Invite members, create pending client records | W | W | — | — |
| Archive or restore members | W | — | — | — |
| Roster: names and status | R all | R assigned clients | R self | Counts only |
| Member contact details | R all | R assigned clients | R W self | — |
| Trainer assignments | R W | R own | R own trainer | — |
| Physical gym membership | R W | R assigned clients | R own | — |
| Attendance | R W | R W (record check-ins) | R own | — |
| Programs and templates | R W all | R all; W those they created (owner can edit all) | R assigned version only | — |
| Assignments | R W | R W for assigned clients | R own | — |
| Workout sessions and sets (gym context) | R (D-12) | R assigned clients | R W own | — |
| Session comments | R | R W on assigned clients' sessions | R W on own sessions | R when reported |
| Measurement definitions (workspace) | R W, archive | R W (create) | R | — |
| Measurements (gym context) | R (D-12) | R W assigned clients | R W own | — |
| Notes: trainers only | R W | R W for assigned clients | **never** | — |
| Notes: shared with member | R W | R W for assigned clients | R | — |
| Progress photos | Only photos shared with them personally | Only photos shared with them personally | R W own | — |
| Personal-workspace history | — | Only with an explicit history share | R W own | — |
| Custom exercises (workspace) | R W | R W | R | R W when reported |
| Gravn subscription, plan, limits | R; buys on the web | — | — | R W (audited) |
| Audit log for the workspace | R | — | — | R |

## Other workspaces

- **Coach workspace:** the coach has every owner and trainer right over their own clients. Clients have member rights.
- **Personal workspace:** only the user. Nobody else, including platform admins, can read it without an explicit share.
- **Global exercise catalog:** everyone signed in can read it; only platform admins with `can_publish_catalog` can change it.
- **Premium entitlement:** the user reads their own; platform admins can read for support; nobody can write it except the webhook and reconciliation server code.

## Platform admin limits

- No access to members' workouts, measurements, photos or notes by default.
- Sees aggregate metrics, workspace list, subscription status, moderation queue (reported items only) and deletion request status.
- Every admin action is written to `audit_events`.
- No impersonation.

## Photos and sharing rules

1. Photos are private to their owner by default.
2. A member shares a photo (or all photos) with a specific person for coaching. The screen names that person and explains what they'll see.
3. A gym owner gets no access by owning the gym. Only a share to the owner as a person counts.
4. Revoking takes effect on the next request; signed URLs already issued expire within minutes.
5. Shares end automatically when the trainer leaves the gym or the member leaves the gym.
6. A share is consent for coaching only, never for marketing.

## Leaving a gym

Proposed defaults (D-08); confirm with the lawyer and record in `PERMISSIONS.md`.

**A trainer is removed**
- Access ends on their next request.
- Programs they wrote stay with the gym.
- Their notes stay, still attributed to them.
- Photo and history shares to them end.

**A member leaves or is archived**
- The assigned trainer's access ends.
- Shares end.
- The gym keeps the roster entry (archived), physical membership records and attendance as its business records.
- The gym loses access to the member's workout and measurement details, but keeps counts.
- The member keeps read access to their own gym-context history and can export it.
- Restoring the member brings gym access back.

**A member deletes their account**
- Everything about them is deleted.
- Records the gym must keep for legal reasons (if any, per the lawyer) are kept in pseudonymised form.

**Offline limit**
- A removed person's phone may still show what it had cached until it next connects. Then the cache is purged.
- Trainers don't cache client data offline, which limits this to the member's own data.

## Counting members

Proposed rule (D-13), shown on the owner dashboard:

| Status | Counts toward the plan's member limit? |
|---|---|
| Active member | Yes |
| Invitation sent, not yet expired or accepted | Yes (stops overselling the limit) |
| Pending client record not yet invited | No |
| Archived member | No |
| Owners and trainers | No (staff, not members) |
| Expired or revoked invitation | No |

For coach workspaces the same rule applies to the client limit. Limits are enforced inside the invite and activate RPCs with a row lock on the workspace, so simultaneous invitations can't exceed the limit.

## Engagement visibility

- Streaks, badges, total lifted and PRs belong to the member. Their assigned trainer can see them; the owner sees them for gym-context sessions per D-12.
- High-fives: only a member's assigned trainer (or the owner) can send one, for that member's gym-context sessions.
- Challenge boards: opt-in members of that gym only, showing display name and count. No weights, measurements or photos, and never members under 18.
- Share cards are created on the member's phone and shared by the member; nothing is posted publicly by the server.
- Clients never write award, streak or stats rows; the server computes them.

## Must-have database tests

These come from the build prompt's acceptance list. Each runs in CI.

- [ ] Role spoofing: inserting a membership or role directly is denied
- [ ] Self-promotion: changing your own role is denied
- [ ] Cross-tenant IDs: every table rejects reads and writes using another workspace's IDs
- [ ] Removed trainer is denied immediately
- [ ] Expired, used and wrong-email invitations are refused
- [ ] Concurrent member-limit invitations stop exactly at the limit
- [ ] Private notes never reach the member
- [ ] Photo access matrix (owner, unshared trainer, shared trainer, revoked, guessed path)
- [ ] Personal workspace unreadable by any other role
- [ ] Clients can't write subscriptions or entitlements
- [ ] Clients can't write streaks, achievements, lifetime stats or another person's high-fives; boards show only opted-in members of the same gym
- [ ] Two synthetic gyms, several trainers and members, an independent coach and a consumer are all in the seed and used by these tests
