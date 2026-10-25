-- Access control for schema v1: helper functions, RLS policies and grants.
-- Helpers are security definer so policies can check membership without recursing
-- through other tables' RLS. `(select auth.uid())` is evaluated once per query.

create function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and status = 'active'
  )
$$;

create function private.has_role(ws uuid, r public.workspace_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and status = 'active'
      and r = any (roles)
  )
$$;

-- True when the caller is an active trainer currently assigned to an active client.
create function private.is_assigned_trainer(ws uuid, client_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trainer_assignments ta
    join public.workspace_members trainer on trainer.id = ta.trainer_member_id
    join public.workspace_members client on client.id = ta.client_member_id
    where ta.workspace_id = ws and ta.client_member_id = client_member and ta.ended_at is null
      and trainer.user_id = (select auth.uid()) and trainer.status = 'active'
      and client.status = 'active'
  )
$$;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

-- Owners see everything; trainers see the rows they created (client records, invitations).
create function private.owner_or_creating_trainer(ws uuid, created_by uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(ws, 'owner')
    or (created_by = (select auth.uid()) and private.has_role(ws, 'trainer'))
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.client_records enable row level security;
alter table public.invitations enable row level security;
alter table public.trainer_assignments enable row level security;
alter table public.platform_admins enable row level security;
alter table public.app_config enable row level security;
alter table public.audit_events enable row level security;

-- workspace_members: the roster. Other tables' visibility builds on this one.
create policy "see own, as owner, as assigned trainer, or staff of my workspace"
  on public.workspace_members for select to authenticated using (
    user_id = (select auth.uid())
    or private.has_role(workspace_id, 'owner')
    or private.is_assigned_trainer(workspace_id, id)
    or (status = 'active' and roles && '{owner,trainer}' and private.is_member(workspace_id))
  );

-- profiles: visible when any of that person's memberships is visible to me.
create policy "see own or visible members" on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.workspace_members m where m.user_id = profiles.user_id)
);
create policy "edit own" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- workspaces: members (including archived ones, who keep their history) and admins.
-- Personal workspaces are never visible to admins.
create policy "see my workspaces" on public.workspaces for select to authenticated using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id and m.user_id = (select auth.uid())
  )
  or (type <> 'personal' and private.is_platform_admin())
);
create policy "owners edit" on public.workspaces for update to authenticated
  using (private.has_role(id, 'owner')) with check (private.has_role(id, 'owner'));

-- client_records: owners manage all; trainers manage the ones they added.
-- created_by defaults to the caller and claimed_by_member_id isn't grantable.
create policy "read" on public.client_records for select to authenticated
  using (private.owner_or_creating_trainer(workspace_id, created_by));
create policy "add" on public.client_records for insert to authenticated
  with check (private.owner_or_creating_trainer(workspace_id, created_by));
create policy "edit unclaimed" on public.client_records for update to authenticated
  using (private.owner_or_creating_trainer(workspace_id, created_by) and claimed_by_member_id is null)
  with check (private.owner_or_creating_trainer(workspace_id, created_by));
create policy "delete unclaimed" on public.client_records for delete to authenticated
  using (private.owner_or_creating_trainer(workspace_id, created_by) and claimed_by_member_id is null);

-- invitations: read-only here; created, accepted and revoked through RPCs.
create policy "owners and the inviting trainer" on public.invitations for select to authenticated
  using (private.owner_or_creating_trainer(workspace_id, created_by));

-- trainer_assignments: owners, and the trainer or client in the assignment.
create policy "owners and the people assigned" on public.trainer_assignments
  for select to authenticated using (
    private.has_role(workspace_id, 'owner')
    or exists (
      select 1 from public.workspace_members m
      where m.id in (trainer_member_id, client_member_id)
        and m.user_id = (select auth.uid()) and m.status = 'active'
    )
  );

create policy "see own admin row" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "everyone reads config" on public.app_config for select to anon, authenticated
  using (true);

create policy "owners and admins read audit" on public.audit_events for select to authenticated
  using (private.has_role(workspace_id, 'owner') or private.is_platform_admin());

-- Grants: nothing is reachable unless granted here. Writes that change roles or
-- membership go through RPCs (next migration), never direct table access.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Future tables and functions also start with no API access. Postgres still grants
-- EXECUTE to PUBLIC on new functions, so each migration revokes its own functions.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema private revoke all on functions from anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function
  private.is_valid_timezone(text),
  private.is_member(uuid),
  private.has_role(uuid, public.workspace_role),
  private.is_assigned_trainer(uuid, uuid),
  private.is_platform_admin(),
  private.owner_or_creating_trainer(uuid, uuid)
to authenticated;

grant select on
  public.profiles, public.workspaces, public.workspace_members, public.client_records,
  public.invitations, public.trainer_assignments, public.platform_admins, public.audit_events
to authenticated;
grant select on public.app_config to anon, authenticated;

grant update (display_name, timezone, locale, unit_system, onboarded_at) on public.profiles to authenticated;
grant update (name, timezone) on public.workspaces to authenticated;
grant insert (workspace_id, display_name, email, phone), update (display_name, email, phone), delete
  on public.client_records to authenticated;
