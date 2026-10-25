-- Schema v3: Part 3 Pilot Readiness — basic measurements, physical gym memberships,
-- coach high-fives, weekly streaks, notifications, account deletion, consents, and problem reports.

create type public.measurement_unit_kind as enum ('mass', 'length', 'percent');
create type public.gym_membership_status as enum ('active', 'paused', 'expired', 'cancelled');
create type public.deletion_request_status as enum ('requested', 'verified', 'scheduled', 'completed', 'cancelled');

-- 1. App config seed for minimum supported version (§3.1) --------------------
insert into public.app_config (key, value)
values ('min_supported_version', '{"web": "1.0.0", "android": "1.0.0", "ios": "1.0.0"}'::jsonb)
on conflict (key) do nothing;

-- 2. Basic Measurements (§3.2) -----------------------------------------------

create table public.measurement_definitions (
  id text primary key,
  label text not null,
  unit_kind public.measurement_unit_kind not null,
  metric_unit text not null,
  imperial_unit text not null,
  min_value numeric(7,2) not null default 0,
  max_value numeric(7,2) not null default 999,
  decimals int not null default 1,
  position int not null default 0
);

insert into public.measurement_definitions (id, label, unit_kind, metric_unit, imperial_unit, min_value, max_value, decimals, position) values
  ('weight',    'Body Weight', 'mass',    'kg', 'lb', 20,  350, 1, 1),
  ('body_fat',  'Body Fat',    'percent', '%',  '%',  2,   70,  1, 2),
  ('waist',     'Waist',       'length',  'cm', 'in', 40,  200, 1, 3),
  ('chest',     'Chest',       'length',  'cm', 'in', 50,  200, 1, 4),
  ('shoulders', 'Shoulders',   'length',  'cm', 'in', 60,  220, 1, 5),
  ('arms',      'Arms',        'length',  'cm', 'in', 15,  80,  1, 6),
  ('thighs',    'Thighs',      'length',  'cm', 'in', 30,  120, 1, 7),
  ('hip',       'Hips',        'length',  'cm', 'in', 50,  200, 1, 8),
  ('calves',    'Calves',      'length',  'cm', 'in', 20,  80,  1, 9),
  ('neck',      'Neck',        'length',  'cm', 'in', 20,  80,  1, 10),
  ('height',    'Height',      'length',  'cm', 'in', 100, 250, 1, 11);

create table public.measurement_entries (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles(user_id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  definition_id text not null references public.measurement_definitions(id) on delete restrict,
  value numeric(8,2) not null check (value > 0),
  unit text not null check (unit in ('kg', 'lb', 'cm', 'in', '%')),
  value_canonical numeric(8,2) not null check (value_canonical > 0),
  measured_on date not null default current_date,
  recorded_by uuid references auth.users(id) on delete set null,
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index measurement_entries_subject_date
  on public.measurement_entries (subject_user_id, definition_id, measured_on desc);

create trigger measurement_entries_updated_at
  before update on public.measurement_entries
  for each row execute function private.set_updated_at();

-- 3. Physical Gym Memberships (§3.3) -----------------------------------------

create table public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null,
  plan_label text not null default 'Monthly Membership' check (char_length(trim(plan_label)) between 1 and 80),
  start_date date not null default current_date,
  end_date date not null,
  status public.gym_membership_status not null default 'active',
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, member_id),
  check (end_date >= start_date),
  foreign key (workspace_id, member_id)
    references public.workspace_members (workspace_id, id) on delete cascade
);

create index gym_memberships_expiry on public.gym_memberships (workspace_id, end_date);

create trigger gym_memberships_updated_at
  before update on public.gym_memberships
  for each row execute function private.set_updated_at();

-- 4. Engagement: Streaks, Coach High-Fives & Notifications (§3.4 & §3.8) -----

create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  weekly_target int not null default 3 check (weekly_target between 1 and 7),
  current_weeks int not null default 0 check (current_weeks >= 0),
  best_weeks int not null default 0 check (best_weeks >= 0),
  freezes_available int not null default 1 check (freezes_available between 0 and 2),
  paused_until date,
  paused_reason text not null default '' check (char_length(paused_reason) <= 200),
  paused_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.high_fives (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  from_user_id uuid not null references public.profiles(user_id) on delete cascade,
  to_user_id uuid not null references public.profiles(user_id) on delete cascade,
  comment text not null default '' check (char_length(comment) <= 200),
  created_at timestamptz not null default now(),
  unique (session_id, from_user_id)
);

create index high_fives_session on public.high_fives (session_id);
create index high_fives_recipient on public.high_fives (to_user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  type text not null check (type in ('workout_assigned', 'high_five', 'membership_expiring')),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 300),
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  token text not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

-- 5. Privacy, Consents, Account Deletion & Problem Reports (§3.5 & §3.7) -----

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'age_18_plus')),
  version text not null default '2026-10',
  granted_at timestamptz not null default now()
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (email = lower(email)),
  source text not null check (source in ('in_app', 'web')),
  status public.deletion_request_status not null default 'scheduled',
  reason text not null default '' check (char_length(reason) <= 500),
  scheduled_for timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  app_version text not null default '1.0.0',
  platform text not null default 'web',
  screen text not null default '' check (char_length(screen) <= 120),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- 6. RLS Helpers & Policies --------------------------------------------------

create function private.can_access_subject_measurements(p_subject uuid, p_ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_subject = (select auth.uid())
    or (
      p_ws is not null and (
        private.has_role(p_ws, 'owner')
        or exists (
          select 1 from public.workspace_members m
          where m.workspace_id = p_ws and m.user_id = p_subject
            and private.is_assigned_trainer(p_ws, m.id)
        )
      )
    )
$$;

alter table public.measurement_definitions enable row level security;
alter table public.measurement_entries enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.streaks enable row level security;
alter table public.high_fives enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.consents enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.problem_reports enable row level security;

create policy "authenticated reads measurement definitions"
  on public.measurement_definitions for select to authenticated using (true);

create policy "read own or coached measurement entries"
  on public.measurement_entries for select to authenticated
  using (private.can_access_subject_measurements(subject_user_id, workspace_id));

create policy "insert own or coached measurement entries"
  on public.measurement_entries for insert to authenticated
  with check (private.can_access_subject_measurements(subject_user_id, workspace_id));

create policy "delete own or coached measurement entries"
  on public.measurement_entries for delete to authenticated
  using (private.can_access_subject_measurements(subject_user_id, workspace_id));

create policy "owners and member read gym memberships"
  on public.gym_memberships for select to authenticated
  using (
    private.has_role(workspace_id, 'owner')
    or exists (
      select 1 from public.workspace_members m
      where m.id = gym_memberships.member_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners manage gym memberships"
  on public.gym_memberships for all to authenticated
  using (private.has_role(workspace_id, 'owner'))
  with check (private.has_role(workspace_id, 'owner'));

create policy "read own or coached streaks"
  on public.streaks for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_staff(workspace_id)
  );

create policy "read session high fives"
  on public.high_fives for select to authenticated
  using (
    from_user_id = (select auth.uid())
    or to_user_id = (select auth.uid())
    or private.can_access_session(session_id)
  );

create policy "read own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "update own notifications"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "manage own push tokens"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "manage own consents"
  on public.consents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "read own deletion requests"
  on public.deletion_requests for select to authenticated
  using (user_id = (select auth.uid()));

create policy "insert own problem reports"
  on public.problem_reports for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "read own problem reports"
  on public.problem_reports for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

-- 7. RPCs for Part 3 ---------------------------------------------------------

create or replace function public.record_measurement(
  p_subject_user_id uuid,
  p_workspace_id uuid,
  p_definition_id text,
  p_value numeric,
  p_unit text,
  p_measured_on date default current_date,
  p_note text default ''
) returns public.measurement_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_def public.measurement_definitions;
  v_canonical numeric(8,2);
  v_row public.measurement_entries;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not private.can_access_subject_measurements(p_subject_user_id, p_workspace_id) then
    raise exception 'not_allowed';
  end if;

  select * into v_def from public.measurement_definitions where id = p_definition_id;
  if not found then
    raise exception 'not_found';
  end if;

  if p_unit = 'lb' then
    v_canonical := round(p_value * 0.45359237, 2);
  elsif p_unit = 'in' then
    v_canonical := round(p_value * 2.54, 2);
  else
    v_canonical := round(p_value, 2);
  end if;

  insert into public.measurement_entries (
    subject_user_id, workspace_id, definition_id, value, unit, value_canonical,
    measured_on, recorded_by, note
  ) values (
    p_subject_user_id, p_workspace_id, p_definition_id, round(p_value, 2), p_unit, v_canonical,
    coalesce(p_measured_on, current_date), (select auth.uid()), coalesce(trim(p_note), '')
  )
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.upsert_gym_membership(
  p_workspace_id uuid,
  p_member_id uuid,
  p_plan_label text,
  p_start_date date,
  p_end_date date,
  p_status public.gym_membership_status default 'active',
  p_notes text default ''
) returns public.gym_memberships
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.gym_memberships;
begin
  if not private.has_role(p_workspace_id, 'owner') then
    raise exception 'not_allowed';
  end if;

  insert into public.gym_memberships (
    workspace_id, member_id, plan_label, start_date, end_date, status, notes
  ) values (
    p_workspace_id, p_member_id, coalesce(nullif(trim(p_plan_label), ''), 'Monthly Membership'),
    p_start_date, p_end_date, p_status, coalesce(trim(p_notes), '')
  )
  on conflict (workspace_id, member_id) do update set
    plan_label = excluded.plan_label,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    status = excluded.status,
    notes = excluded.notes,
    updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.send_high_five(
  p_session_id uuid,
  p_comment text default ''
) returns public.high_fives
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.workout_sessions;
  v_sender_name text;
  v_hf public.high_fives;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not private.can_access_session(p_session_id) then
    raise exception 'not_allowed';
  end if;

  select * into v_session from public.workout_sessions where id = p_session_id;
  if not found then
    raise exception 'not_found';
  end if;

  insert into public.high_fives (session_id, from_user_id, to_user_id, comment)
  values (p_session_id, (select auth.uid()), v_session.user_id, coalesce(trim(p_comment), ''))
  on conflict (session_id, from_user_id) do update set
    comment = excluded.comment
  returning * into v_hf;

  select coalesce(nullif(display_name, ''), 'Your Coach') into v_sender_name
  from public.profiles where user_id = (select auth.uid());

  insert into public.notifications (user_id, workspace_id, type, title, body, dedupe_key)
  values (
    v_session.user_id,
    v_session.workspace_id,
    'high_five',
    v_sender_name || ' high-fived your workout',
    case when trim(coalesce(p_comment, '')) <> '' then trim(p_comment) else v_session.title end,
    'high_five:' || p_session_id::text || ':' || (select auth.uid())::text
  )
  on conflict (dedupe_key) do nothing;

  return v_hf;
end
$$;

create or replace function public.pause_client_streak(
  p_workspace_id uuid,
  p_user_id uuid,
  p_paused_until date,
  p_reason text default ''
) returns public.streaks
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.streaks;
begin
  if not private.is_staff(p_workspace_id) and p_user_id <> (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  insert into public.streaks (user_id, workspace_id, paused_until, paused_reason, paused_by)
  values (p_user_id, p_workspace_id, p_paused_until, coalesce(trim(p_reason), ''), (select auth.uid()))
  on conflict (user_id, workspace_id) do update set
    paused_until = excluded.paused_until,
    paused_reason = excluded.paused_reason,
    paused_by = excluded.paused_by,
    updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.request_account_deletion(
  p_reason text default ''
) returns public.deletion_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_row public.deletion_requests;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  insert into public.deletion_requests (user_id, email, source, status, reason)
  values (v_uid, coalesce(v_email, 'unknown@example.test'), 'in_app', 'scheduled', coalesce(trim(p_reason), ''))
  returning * into v_row;

  insert into public.audit_events (actor_user_id, action, target_type, target_id)
  values (v_uid, 'account.deletion_requested', 'user', v_uid);

  return v_row;
end
$$;

create or replace function public.request_public_deletion(
  p_email text,
  p_reason text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_email is null or position('@' in trim(p_email)) = 0 then
    raise exception 'invalid_email';
  end if;

  insert into public.deletion_requests (email, source, status, reason)
  values (lower(trim(p_email)), 'web', 'requested', coalesce(trim(p_reason), ''))
  returning id into v_id;

  return v_id;
end
$$;

-- Grants ---------------------------------------------------------------------

grant select on public.measurement_definitions to authenticated;
grant select, insert, delete on public.measurement_entries to authenticated;
grant select, insert, update, delete on public.gym_memberships to authenticated;
grant select on public.streaks to authenticated;
grant select on public.high_fives to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert on public.consents to authenticated;
grant select on public.deletion_requests to authenticated;
grant select, insert on public.problem_reports to authenticated;

grant execute on function public.record_measurement(uuid, uuid, text, numeric, text, date, text) to authenticated;
grant execute on function public.upsert_gym_membership(uuid, uuid, text, date, date, public.gym_membership_status, text) to authenticated;
grant execute on function public.send_high_five(uuid, text) to authenticated;
grant execute on function public.pause_client_streak(uuid, uuid, date, text) to authenticated;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.request_public_deletion(text, text) to anon, authenticated;
