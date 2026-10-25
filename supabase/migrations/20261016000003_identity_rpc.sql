-- RPCs for every change to roles or membership, and the sign-up trigger.
-- Errors are raised with a stable key as the message (for example 'not_allowed');
-- the apps translate it through packages/shared/src/i18n.
-- Every function that changes membership locks the workspace row first, so concurrent
-- calls (and the member limits added in Part 7) are serialised per workspace.

-- Internal helpers (called only from security definer functions) ----------

create function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return uid;
end
$$;

create function private.audit(
  ws uuid, action text, target_type text, target_id uuid, metadata jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_user_id, workspace_id, action, target_type, target_id, metadata)
  values ((select auth.uid()), ws, action, target_type, target_id, metadata)
$$;

create function private.lock_workspace(ws uuid) returns void
language sql security definer set search_path = '' as $$
  select null from public.workspaces where id = ws for update
$$;

create function private.token_hash(token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(token, 'sha256')
$$;

create function private.invitation_status(inv public.invitations) returns text
language sql stable set search_path = '' as $$
  select case
    when inv.revoked_at is not null then 'revoked'
    when inv.accepted_at is not null then 'used'
    when inv.expires_at <= now() then 'expired'
    else 'valid'
  end
$$;

-- "karthik@example.com" -> "k••••••@example.com"
create function private.mask_email(email text) returns text
language sql immutable set search_path = '' as $$
  select left(split_part(email, '@', 1), 1)
    || repeat('•', greatest(char_length(split_part(email, '@', 1)) - 1, 1))
    || '@' || split_part(email, '@', 2)
$$;

-- Sign-up: profile, private personal workspace, owner membership --------

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tz text := new.raw_user_meta_data ->> 'timezone';
  ws uuid;
begin
  insert into public.profiles (user_id, display_name, timezone)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80),
    case when private.is_valid_timezone(tz) then tz else 'Asia/Kolkata' end
  );
  insert into public.workspaces (type, name, created_by) values ('personal', 'Personal', new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, roles) values (ws, new.id, '{owner}');
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Reading access -----------------------------------------------------------

-- Everything the apps need to build navigation. Called on sign-in and every reconnect.
create function public.get_my_access() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'onboarded', p.onboarded_at is not null,
    'is_platform_admin', private.is_platform_admin(),
    'workspaces', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', w.id, 'member_id', m.id, 'type', w.type, 'name', w.name, 'roles', m.roles)
        order by w.type = 'personal', w.name
      )
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
      where m.user_id = p.user_id and m.status = 'active'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.user_id = (select auth.uid())
$$;

-- Workspaces ---------------------------------------------------------------

create function public.create_workspace(p_type public.workspace_type, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  ws uuid;
begin
  if p_type = 'personal' then
    raise exception 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'invalid_name';
  end if;

  insert into public.workspaces (type, name, timezone, created_by)
  select p_type, trim(p_name), p.timezone, uid from public.profiles p where p.user_id = uid
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, roles)
  values (
    ws,
    uid,
    case
      when p_type = 'coach' then '{owner,trainer}'::public.workspace_role[]
      else '{owner}'::public.workspace_role[]
    end
  );
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where user_id = uid;

  perform private.audit(ws, 'workspace.created', 'workspace', ws, jsonb_build_object('type', p_type));
  return ws;
end
$$;

-- Lets a gym owner opt into or out of also coaching clients as a trainer (D-26, D-56).
create function public.set_owner_trainer(p_workspace uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_member_id uuid;
begin
  if not private.has_role(p_workspace, 'owner')
    or (select type from public.workspaces where id = p_workspace) <> 'gym' then
    raise exception 'not_allowed';
  end if;
  perform private.lock_workspace(p_workspace);

  update public.workspace_members
  set roles = case
    when p_enabled then array_append(array_remove(roles, 'trainer'), 'trainer')
    else array_remove(roles, 'trainer')
  end
  where workspace_id = p_workspace and user_id = uid and status = 'active'
  returning id into v_member_id;

  if not p_enabled and v_member_id is not null then
    update public.trainer_assignments set ended_at = now()
    where workspace_id = p_workspace and trainer_member_id = v_member_id and ended_at is null;
  end if;

  perform private.audit(
    p_workspace,
    'owner.trainer_role_changed',
    'workspace_member',
    v_member_id,
    jsonb_build_object('enabled', p_enabled)
  );
end
$$;

-- Invitations --------------------------------------------------------------

-- Owners invite trainers (gyms only) and members; trainers invite members.
-- Client-record invitations may omit p_email so the single-use link can be shared on WhatsApp (D-57).
-- Returns the raw token once; only its hash is stored.
create function public.create_invitation(
  p_workspace uuid, p_email text default null, p_role public.workspace_role default 'member', p_client_record uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_type public.workspace_type;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  select type into v_type from public.workspaces where id = p_workspace;
  if v_type is null or v_type = 'personal' or not (
    (private.has_role(p_workspace, 'owner') and (p_role = 'member' or (p_role = 'trainer' and v_type = 'gym')))
    or (private.has_role(p_workspace, 'trainer') and p_role = 'member')
  ) then
    raise exception 'not_allowed';
  end if;
  if v_email is null and p_client_record is null then
    raise exception 'invalid_email';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if p_client_record is not null and not exists (
    select 1 from public.client_records c
    where c.id = p_client_record and c.workspace_id = p_workspace and c.claimed_by_member_id is null
      and private.owner_or_creating_trainer(c.workspace_id, c.created_by)
  ) then
    raise exception 'not_found';
  end if;

  perform private.lock_workspace(p_workspace);
  if v_email is not null and exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'already_member';
  end if;

  -- Re-inviting replaces any outstanding link for the same email or client record.
  update public.invitations set revoked_at = now()
  where workspace_id = p_workspace and accepted_at is null and revoked_at is null
    and (
      (v_email is not null and email = v_email)
      or (p_client_record is not null and client_record_id = p_client_record)
    );

  insert into public.invitations (workspace_id, email, role, client_record_id, token_hash, expires_at, created_by)
  values (p_workspace, v_email, p_role, p_client_record, private.token_hash(v_token), now() + interval '7 days', uid)
  returning id into v_id;

  perform private.audit(p_workspace, 'invitation.created', 'invitation', v_id, jsonb_build_object('role', p_role));
  return v_token;
end
$$;

-- What the invitation screen shows. Callable before sign-in; the token is the secret.
create function public.get_invitation(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.invitations;
  ws public.workspaces;
begin
  select * into inv from public.invitations where token_hash = private.token_hash(p_token);
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into ws from public.workspaces where id = inv.workspace_id;

  return jsonb_build_object(
    'status', private.invitation_status(inv),
    'workspace_name', ws.name,
    'workspace_type', ws.type,
    'role', inv.role,
    'expires_at', inv.expires_at,
    'email_hint', case when inv.email is not null then private.mask_email(inv.email) end,
    'signed_in', uid is not null,
    'email_matches', inv.email is null or exists (
      select 1 from auth.users where id = uid and lower(email) = inv.email
    ),
    'already_member', exists (
      select 1 from public.workspace_members
      where workspace_id = inv.workspace_id and user_id = uid and status = 'active'
    )
  );
end
$$;

create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  inv public.invitations;
  v_status text;
  v_existing public.workspace_members;
  v_member_id uuid;
begin
  select * into inv from public.invitations where token_hash = private.token_hash(p_token) for update;
  if not found then
    raise exception 'invitation_invalid';
  end if;
  v_status := private.invitation_status(inv);
  if v_status <> 'valid' then
    raise exception 'invitation_%', v_status;
  end if;
  if not exists (
    select 1 from auth.users
    where id = uid and email_confirmed_at is not null
      and (inv.email is null or lower(email) = inv.email)
  ) then
    raise exception 'invitation_wrong_account';
  end if;

  perform private.lock_workspace(inv.workspace_id);
  select * into v_existing from public.workspace_members
  where workspace_id = inv.workspace_id and user_id = uid;

  if v_existing.status = 'active' then
    raise exception 'already_member';
  elsif v_existing.id is not null then
    -- Rejoining after being archived.
    update public.workspace_members
    set status = 'active', archived_at = null, roles = array[inv.role], joined_at = now()
    where id = v_existing.id
    returning id into v_member_id;
  else
    insert into public.workspace_members (workspace_id, user_id, roles)
    values (inv.workspace_id, uid, array[inv.role])
    returning id into v_member_id;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.client_records set claimed_by_member_id = v_member_id where id = inv.client_record_id;
  update public.profiles p
  set onboarded_at = coalesce(p.onboarded_at, now()),
      display_name = case
        when p.display_name = '' and inv.client_record_id is not null then
          coalesce((select c.display_name from public.client_records c where c.id = inv.client_record_id), '')
        else p.display_name
      end
  where p.user_id = uid;

  -- A trainer who invites a client becomes that client's trainer.
  if inv.role = 'member' then
    insert into public.trainer_assignments (workspace_id, trainer_member_id, client_member_id, created_by)
    select inv.workspace_id, m.id, v_member_id, inv.created_by
    from public.workspace_members m
    where m.workspace_id = inv.workspace_id and m.user_id = inv.created_by
      and m.status = 'active' and 'trainer' = any (m.roles)
    on conflict do nothing;
  end if;

  perform private.audit(inv.workspace_id, 'invitation.accepted', 'workspace_member', v_member_id,
    jsonb_build_object('role', inv.role));
  return inv.workspace_id;
end
$$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  ws uuid;
begin
  update public.invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null
    and private.owner_or_creating_trainer(workspace_id, created_by)
  returning workspace_id into ws;
  if ws is null then
    raise exception 'not_found';
  end if;
  perform private.audit(ws, 'invitation.revoked', 'invitation', p_invitation);
end
$$;

-- Trainer assignments ------------------------------------------------------

create function public.assign_trainer(p_workspace uuid, p_trainer_member uuid, p_client_member uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_id uuid;
begin
  if not private.has_role(p_workspace, 'owner') then
    raise exception 'not_allowed';
  end if;
  perform private.lock_workspace(p_workspace);
  if not exists (
    select 1 from public.workspace_members
    where id = p_trainer_member and workspace_id = p_workspace and status = 'active' and 'trainer' = any (roles)
  ) or not exists (
    select 1 from public.workspace_members
    where id = p_client_member and workspace_id = p_workspace and status = 'active' and 'member' = any (roles)
  ) then
    raise exception 'not_found';
  end if;

  select id into v_id from public.trainer_assignments
  where trainer_member_id = p_trainer_member and client_member_id = p_client_member and ended_at is null;
  if v_id is null then
    insert into public.trainer_assignments (workspace_id, trainer_member_id, client_member_id, created_by)
    values (p_workspace, p_trainer_member, p_client_member, uid)
    returning id into v_id;
    perform private.audit(p_workspace, 'trainer.assigned', 'trainer_assignment', v_id);
  end if;
  return v_id;
end
$$;

create function public.end_trainer_assignment(p_assignment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  ws uuid;
begin
  update public.trainer_assignments set ended_at = now()
  where id = p_assignment and ended_at is null and private.has_role(workspace_id, 'owner')
  returning workspace_id into ws;
  if ws is null then
    raise exception 'not_found';
  end if;
  perform private.audit(ws, 'trainer.unassigned', 'trainer_assignment', p_assignment);
end
$$;

-- Removing and restoring people -------------------------------------------

-- Archives the membership and ends its trainer assignments. Access ends on the
-- person's next request because every policy checks membership live.
create function public.remove_member(p_workspace uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_member public.workspace_members;
begin
  if not private.has_role(p_workspace, 'owner')
    or (select type from public.workspaces where id = p_workspace) = 'personal' then
    raise exception 'not_allowed';
  end if;
  perform private.lock_workspace(p_workspace);
  select * into v_member from public.workspace_members
  where id = p_member and workspace_id = p_workspace and status = 'active';
  if v_member.id is null then
    raise exception 'not_found';
  end if;
  if 'owner' = any (v_member.roles) and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace and status = 'active' and 'owner' = any (roles) and id <> p_member
  ) then
    raise exception 'last_owner';
  end if;

  update public.workspace_members set status = 'archived', archived_at = now() where id = p_member;
  update public.trainer_assignments set ended_at = now()
  where ended_at is null and p_member in (trainer_member_id, client_member_id);

  perform private.audit(p_workspace, 'member.removed', 'workspace_member', p_member);
end
$$;

-- Restoring brings the gym's access back; trainer assignments stay ended.
create function public.restore_member(p_workspace uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
begin
  if not private.has_role(p_workspace, 'owner') then
    raise exception 'not_allowed';
  end if;
  perform private.lock_workspace(p_workspace);
  update public.workspace_members set status = 'active', archived_at = null
  where id = p_member and workspace_id = p_workspace and status = 'archived';
  if not found then
    raise exception 'not_found';
  end if;
  perform private.audit(p_workspace, 'member.restored', 'workspace_member', p_member);
end
$$;

-- Platform admin -----------------------------------------------------------

-- Counts only: admins never see rosters, workouts or personal workspaces.
create function public.admin_workspaces()
returns table (id uuid, type public.workspace_type, name text, created_at timestamptz,
               members bigint, trainers bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  return query
    select w.id, w.type, w.name, w.created_at,
      count(*) filter (where m.status = 'active' and 'member' = any (m.roles)),
      count(*) filter (where m.status = 'active' and 'trainer' = any (m.roles))
    from public.workspaces w
    left join public.workspace_members m on m.workspace_id = w.id
    where w.type <> 'personal'
    group by w.id
    order by w.created_at desc;
end
$$;

-- Grants -------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on function
  private.require_user(), private.audit(uuid, text, text, uuid, jsonb), private.lock_workspace(uuid),
  private.token_hash(text), private.invitation_status(public.invitations), private.mask_email(text),
  private.handle_new_user()
from public, anon, authenticated;

grant execute on function
  public.get_my_access(),
  public.create_workspace(public.workspace_type, text),
  public.set_owner_trainer(uuid, boolean),
  public.create_invitation(uuid, text, public.workspace_role, uuid),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.assign_trainer(uuid, uuid, uuid),
  public.end_trainer_assignment(uuid),
  public.remove_member(uuid, uuid),
  public.restore_member(uuid, uuid),
  public.admin_workspaces()
to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
