-- Access control (RLS policies, helpers, grants) and RPCs for Schema v2 (Part 2).

-- Helpers ------------------------------------------------------------------

create function private.can_publish_catalog() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid()) and can_publish_catalog
  )
$$;

create function private.is_staff(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and status = 'active'
      and roles && '{owner,trainer}'
  )
$$;

create function private.can_read_program_version(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.program_versions pv
    where pv.id = vid and (
      private.is_staff(pv.workspace_id)
      or exists (
        select 1 from public.assignments a
        join public.workspace_members m on m.id = a.client_member_id
        where a.program_version_id = pv.id and m.user_id = (select auth.uid()) and m.status = 'active'
      )
    )
  )
$$;

create function private.can_manage_program_version(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.program_versions pv
    where pv.id = vid and pv.status = 'draft' and private.is_staff(pv.workspace_id)
  )
$$;

create function private.can_access_session(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_sessions s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = sid and (
      s.user_id = (select auth.uid())
      or (w.type <> 'personal' and private.has_role(s.workspace_id, 'owner'))
      or exists (
        select 1 from public.workspace_members m
        where m.workspace_id = s.workspace_id and m.user_id = s.user_id
          and private.is_assigned_trainer(s.workspace_id, m.id)
      )
    )
  )
$$;

create function private.owns_session(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = sid and s.user_id = (select auth.uid()) and private.is_member(s.workspace_id)
  )
$$;

-- Enable RLS on every table ------------------------------------------------

alter table public.muscle_groups enable row level security;
alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_favorites enable row level security;
alter table public.programs enable row level security;
alter table public.program_versions enable row level security;
alter table public.program_days enable row level security;
alter table public.program_items enable row level security;
alter table public.assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.session_sets enable row level security;
alter table public.session_comments enable row level security;
alter table public.activity_events enable row level security;
alter table public.sync_operations enable row level security;
alter table public.sync_conflicts enable row level security;

-- Policies: catalog --------------------------------------------------------

create policy "authenticated reads muscle groups" on public.muscle_groups
  for select to authenticated using (true);

create policy "authenticated reads equipment" on public.equipment
  for select to authenticated using (true);

create policy "read global, workspace or own personal exercises" on public.exercises
  for select to authenticated using (
    scope = 'global'
    or (scope = 'workspace' and private.is_member(workspace_id))
    or (scope = 'personal' and owner_user_id = (select auth.uid()))
  );

create policy "create exercises in allowed scope" on public.exercises
  for insert to authenticated with check (
    (scope = 'global' and private.can_publish_catalog())
    or (scope = 'workspace' and private.is_staff(workspace_id))
    or (scope = 'personal' and owner_user_id = (select auth.uid()))
  );

create policy "update exercises in allowed scope" on public.exercises
  for update to authenticated
  using (
    (scope = 'global' and private.can_publish_catalog())
    or (scope = 'workspace' and private.is_staff(workspace_id))
    or (scope = 'personal' and owner_user_id = (select auth.uid()))
  )
  with check (
    (scope = 'global' and private.can_publish_catalog())
    or (scope = 'workspace' and private.is_staff(workspace_id))
    or (scope = 'personal' and owner_user_id = (select auth.uid()))
  );

create policy "delete exercises in allowed scope" on public.exercises
  for delete to authenticated using (
    (scope = 'global' and private.can_publish_catalog())
    or (scope = 'workspace' and private.is_staff(workspace_id))
    or (scope = 'personal' and owner_user_id = (select auth.uid()))
  );

create policy "manage own favorites" on public.exercise_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Policies: programs and assignments ---------------------------------------

create policy "read workspace or assigned programs" on public.programs
  for select to authenticated using (
    private.is_staff(workspace_id)
    or exists (
      select 1 from public.assignments a
      join public.program_versions pv on pv.id = a.program_version_id
      join public.workspace_members m on m.id = a.client_member_id
      where pv.program_id = programs.id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
  );

create policy "staff manage programs" on public.programs
  for all to authenticated
  using (private.is_staff(workspace_id))
  with check (private.is_staff(workspace_id));

create policy "read program versions" on public.program_versions
  for select to authenticated using (private.can_read_program_version(id));

create policy "read program days" on public.program_days
  for select to authenticated using (private.can_read_program_version(program_version_id));

create policy "staff manage draft days" on public.program_days
  for all to authenticated
  using (private.can_manage_program_version(program_version_id))
  with check (private.can_manage_program_version(program_version_id));

create policy "read program items" on public.program_items
  for select to authenticated using (
    exists (
      select 1 from public.program_days d
      where d.id = program_day_id and private.can_read_program_version(d.program_version_id)
    )
  );

create policy "staff manage draft items" on public.program_items
  for all to authenticated
  using (
    exists (
      select 1 from public.program_days d
      where d.id = program_day_id and private.can_manage_program_version(d.program_version_id)
    )
  )
  with check (
    exists (
      select 1 from public.program_days d
      where d.id = program_day_id and private.can_manage_program_version(d.program_version_id)
    )
  );

create policy "read assignments" on public.assignments
  for select to authenticated using (
    private.has_role(workspace_id, 'owner')
    or private.is_assigned_trainer(workspace_id, client_member_id)
    or exists (
      select 1 from public.workspace_members m
      where m.id = client_member_id and m.user_id = (select auth.uid()) and m.status = 'active'
    )
  );

-- Policies: sessions and sync ----------------------------------------------

create policy "read accessible sessions" on public.workout_sessions
  for select to authenticated using (private.can_access_session(id));

create policy "insert own sessions" on public.workout_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(workspace_id));

create policy "update own sessions" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_member(workspace_id))
  with check (user_id = (select auth.uid()) and private.is_member(workspace_id));

create policy "read session exercises" on public.session_exercises
  for select to authenticated using (private.can_access_session(session_id));

create policy "manage own session exercises" on public.session_exercises
  for all to authenticated
  using (private.owns_session(session_id))
  with check (private.owns_session(session_id));

create policy "read session sets" on public.session_sets
  for select to authenticated using (
    exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and private.can_access_session(se.session_id)
    )
  );

create policy "manage own session sets" on public.session_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and private.owns_session(se.session_id)
    )
  )
  with check (
    exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and private.owns_session(se.session_id)
    )
  );

create policy "read session comments" on public.session_comments
  for select to authenticated using (private.can_access_session(session_id));

create policy "add session comments" on public.session_comments
  for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and private.can_access_session(session_id)
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and private.is_member(s.workspace_id)
    )
  );

create policy "read own activity events" on public.activity_events
  for select to authenticated using (user_id = (select auth.uid()));

create policy "read own sync operations" on public.sync_operations
  for select to authenticated using (user_id = (select auth.uid()));

create policy "read own sync conflicts" on public.sync_conflicts
  for select to authenticated using (user_id = (select auth.uid()));

-- RPCs: programs and assignments -------------------------------------------

create function public.create_program(
  p_workspace uuid,
  p_name text,
  p_description text default '',
  p_client_member uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_prog_id uuid;
  v_ver_id uuid;
  v_day_id uuid;
begin
  if not private.is_staff(p_workspace) then
    raise exception 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'invalid_name';
  end if;
  if p_client_member is not null and not (
    private.has_role(p_workspace, 'owner')
    or private.is_assigned_trainer(p_workspace, p_client_member)
  ) then
    raise exception 'not_allowed';
  end if;

  insert into public.programs (workspace_id, name, description, client_member_id, created_by)
  values (p_workspace, trim(p_name), coalesce(p_description, ''), p_client_member, uid)
  returning id into v_prog_id;

  insert into public.program_versions (program_id, workspace_id, version_number, status)
  values (v_prog_id, p_workspace, 1, 'draft')
  returning id into v_ver_id;

  insert into public.program_days (program_version_id, week_index, day_index, title)
  values (v_ver_id, 1, 1, 'Day 1')
  returning id into v_day_id;

  return jsonb_build_object('program_id', v_prog_id, 'version_id', v_ver_id, 'day_id', v_day_id);
end
$$;

create function public.publish_program(p_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_ver public.program_versions;
begin
  select * into v_ver from public.program_versions where id = p_version for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not private.is_staff(v_ver.workspace_id) then
    raise exception 'not_allowed';
  end if;
  if v_ver.status = 'published' then
    return v_ver.id;
  end if;

  update public.program_versions
  set status = 'published', published_at = now(), published_by = uid
  where id = p_version;

  perform private.audit(v_ver.workspace_id, 'program.published', 'program_version', p_version);
  return p_version;
end
$$;

-- Creates (or returns) an editable draft version for a program by cloning its latest version.
create function public.create_program_draft(p_program uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_prog public.programs;
  v_existing_draft uuid;
  v_source public.program_versions;
  v_new_ver uuid;
  v_day record;
  v_new_day uuid;
begin
  select * into v_prog from public.programs where id = p_program for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not private.is_staff(v_prog.workspace_id) then
    raise exception 'not_allowed';
  end if;

  select id into v_existing_draft from public.program_versions
  where program_id = p_program and status = 'draft'
  order by version_number desc limit 1;
  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select * into v_source from public.program_versions
  where program_id = p_program
  order by version_number desc limit 1;

  insert into public.program_versions (program_id, workspace_id, version_number, status)
  values (p_program, v_prog.workspace_id, coalesce(v_source.version_number, 0) + 1, 'draft')
  returning id into v_new_ver;

  if v_source.id is not null then
    for v_day in
      select * from public.program_days where program_version_id = v_source.id order by week_index, day_index
    loop
      insert into public.program_days (program_version_id, week_index, day_index, title, weekday_hint)
      values (v_new_ver, v_day.week_index, v_day.day_index, v_day.title, v_day.weekday_hint)
      returning id into v_new_day;

      insert into public.program_items (
        program_day_id, exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      )
      select
        v_new_day, exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      from public.program_items
      where program_day_id = v_day.id
      order by position;
    end loop;
  end if;

  return v_new_ver;
end
$$;

create function public.duplicate_program(
  p_program uuid,
  p_name text,
  p_client_member uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_prog public.programs;
  v_source_ver uuid;
  v_new_prog uuid;
  v_new_ver uuid;
  v_day record;
  v_new_day uuid;
begin
  select * into v_prog from public.programs where id = p_program;
  if not found then
    raise exception 'not_found';
  end if;
  if not private.is_staff(v_prog.workspace_id) then
    raise exception 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'invalid_name';
  end if;

  insert into public.programs (workspace_id, name, description, client_member_id, created_by)
  values (v_prog.workspace_id, trim(p_name), v_prog.description, p_client_member, uid)
  returning id into v_new_prog;

  insert into public.program_versions (program_id, workspace_id, version_number, status)
  values (v_new_prog, v_prog.workspace_id, 1, 'draft')
  returning id into v_new_ver;

  select id into v_source_ver from public.program_versions
  where program_id = p_program order by version_number desc limit 1;

  if v_source_ver is not null then
    for v_day in
      select * from public.program_days where program_version_id = v_source_ver order by week_index, day_index
    loop
      insert into public.program_days (program_version_id, week_index, day_index, title, weekday_hint)
      values (v_new_ver, v_day.week_index, v_day.day_index, v_day.title, v_day.weekday_hint)
      returning id into v_new_day;

      insert into public.program_items (
        program_day_id, exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      )
      select
        v_new_day, exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      from public.program_items
      where program_day_id = v_day.id
      order by position;
    end loop;
  end if;

  return jsonb_build_object('program_id', v_new_prog, 'version_id', v_new_ver);
end
$$;

create function public.assign_program(
  p_workspace uuid,
  p_client_member uuid,
  p_version uuid,
  p_start_date date default current_date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_ver public.program_versions;
  v_member public.workspace_members;
  v_assign_id uuid;
begin
  select * into v_ver from public.program_versions where id = p_version and workspace_id = p_workspace;
  if not found or v_ver.status <> 'published' then
    raise exception 'not_found';
  end if;

  select * into v_member from public.workspace_members
  where id = p_client_member and workspace_id = p_workspace and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;

  if not (
    private.has_role(p_workspace, 'owner')
    or private.is_assigned_trainer(p_workspace, p_client_member)
    or (v_member.user_id = uid and (select type from public.workspaces where id = p_workspace) = 'personal')
  ) then
    raise exception 'not_allowed';
  end if;

  perform private.lock_workspace(p_workspace);

  update public.assignments
  set status = 'ended', ended_at = now()
  where workspace_id = p_workspace and client_member_id = p_client_member and status = 'active';

  insert into public.assignments (workspace_id, client_member_id, program_version_id, start_date, assigned_by)
  values (p_workspace, p_client_member, p_version, coalesce(p_start_date, current_date), uid)
  returning id into v_assign_id;

  perform private.audit(p_workspace, 'program.assigned', 'assignment', v_assign_id);
  return v_assign_id;
end
$$;

create function public.end_program_assignment(p_assignment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_assign public.assignments;
begin
  select * into v_assign from public.assignments where id = p_assignment and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;
  if not (
    private.has_role(v_assign.workspace_id, 'owner')
    or private.is_assigned_trainer(v_assign.workspace_id, v_assign.client_member_id)
  ) then
    raise exception 'not_allowed';
  end if;

  update public.assignments set status = 'ended', ended_at = now() where id = p_assignment;
  perform private.audit(v_assign.workspace_id, 'program.unassigned', 'assignment', p_assignment);
end
$$;

-- Offline / online workout sync --------------------------------------------

-- Applies a batch of workout operations idempotently (D-59: Last-Write-Wins + diagnostic conflict log).
create function public.sync_push(p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_op jsonb;
  v_op_id uuid;
  v_type text;
  v_payload jsonb;
  v_base_rev int;
  v_cached jsonb;
  v_res jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ws uuid;
  v_session public.workout_sessions;
  v_se public.session_exercises;
  v_set public.session_sets;
begin
  if jsonb_typeof(p_ops) <> 'array' then
    raise exception 'invalid_ops';
  end if;

  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_op_id := (v_op ->> 'op_id')::uuid;
    v_type := v_op ->> 'type';
    v_payload := coalesce(v_op -> 'payload', '{}'::jsonb);
    v_base_rev := (v_op ->> 'base_revision')::int;

    -- 1. Idempotency check.
    select result into v_cached from public.sync_operations
    where user_id = uid and op_id = v_op_id;
    if found then
      v_results := v_results || jsonb_build_array(v_cached);
      continue;
    end if;

    -- 2. Apply operation by type.
    if v_type = 'upsert_session' then
      v_ws := (v_payload ->> 'workspace_id')::uuid;
      if not private.is_member(v_ws) then
        raise exception 'not_allowed';
      end if;
      if v_payload ? 'assignment_id' and (v_payload ->> 'assignment_id') is not null then
        if not exists (
          select 1 from public.assignments a
          join public.workspace_members m on m.id = a.client_member_id
          where a.id = (v_payload ->> 'assignment_id')::uuid
            and a.workspace_id = v_ws and m.user_id = uid
        ) then
          raise exception 'not_allowed';
        end if;
      end if;

      select * into v_session from public.workout_sessions
      where id = (v_payload ->> 'id')::uuid for update;

      if found then
        if v_session.user_id <> uid or v_session.workspace_id <> v_ws then
          raise exception 'not_allowed';
        end if;
        if v_base_rev is not null and v_base_rev < v_session.revision then
          insert into public.sync_conflicts (user_id, entity_type, entity_id, client_version, server_version)
          values (uid, 'workout_session', v_session.id, v_payload, to_jsonb(v_session));
        end if;
        update public.workout_sessions set
          title = coalesce(v_payload ->> 'title', title),
          status = coalesce((v_payload ->> 'status')::public.session_status, status),
          started_at = coalesce((v_payload ->> 'started_at')::timestamptz, started_at),
          finished_at = case when v_payload ? 'finished_at' then (v_payload ->> 'finished_at')::timestamptz else finished_at end,
          duration_seconds = case when v_payload ? 'duration_seconds' then (v_payload ->> 'duration_seconds')::int else duration_seconds end,
          notes = coalesce(v_payload ->> 'notes', notes),
          planned_snapshot = coalesce(v_payload -> 'planned_snapshot', planned_snapshot),
          revision = v_session.revision + 1
        where id = v_session.id
        returning * into v_session;
      else
        insert into public.workout_sessions (
          id, user_id, workspace_id, assignment_id, program_version_id, program_day_id,
          title, planned_snapshot, status, started_at, finished_at, duration_seconds, notes, revision
        ) values (
          coalesce((v_payload ->> 'id')::uuid, gen_random_uuid()),
          uid,
          v_ws,
          (v_payload ->> 'assignment_id')::uuid,
          (v_payload ->> 'program_version_id')::uuid,
          (v_payload ->> 'program_day_id')::uuid,
          coalesce(nullif(trim(v_payload ->> 'title'), ''), 'Workout'),
          coalesce(v_payload -> 'planned_snapshot', '{}'::jsonb),
          coalesce((v_payload ->> 'status')::public.session_status, 'in_progress'),
          coalesce((v_payload ->> 'started_at')::timestamptz, now()),
          (v_payload ->> 'finished_at')::timestamptz,
          (v_payload ->> 'duration_seconds')::int,
          coalesce(v_payload ->> 'notes', ''),
          1
        )
        returning * into v_session;
      end if;

      if v_session.status = 'completed' and not exists (
        select 1 from public.activity_events
        where user_id = uid and type = 'session_completed' and ref_id = v_session.id
      ) then
        insert into public.activity_events (user_id, workspace_id, type, ref_id)
        values (uid, v_session.workspace_id, 'session_completed', v_session.id);
      end if;

      v_res := jsonb_build_object('op_id', v_op_id, 'status', 'synced', 'entity_id', v_session.id, 'revision', v_session.revision);

    elsif v_type = 'upsert_exercise' then
      select * into v_session from public.workout_sessions
      where id = (v_payload ->> 'session_id')::uuid;
      if not found or v_session.user_id <> uid or not private.is_member(v_session.workspace_id) then
        raise exception 'not_allowed';
      end if;

      select * into v_se from public.session_exercises
      where id = (v_payload ->> 'id')::uuid for update;

      if found then
        if v_se.session_id <> v_session.id then
          raise exception 'not_allowed';
        end if;
        update public.session_exercises set
          exercise_id = coalesce((v_payload ->> 'exercise_id')::uuid, exercise_id),
          position = coalesce((v_payload ->> 'position')::int, position),
          superset_group = case when v_payload ? 'superset_group' then v_payload ->> 'superset_group' else superset_group end,
          tracking_type = coalesce((v_payload ->> 'tracking_type')::public.tracking_type, tracking_type),
          rest_seconds = coalesce((v_payload ->> 'rest_seconds')::int, rest_seconds),
          skipped = coalesce((v_payload ->> 'skipped')::boolean, skipped),
          skip_reason = case when v_payload ? 'skip_reason' then v_payload ->> 'skip_reason' else skip_reason end,
          notes = coalesce(v_payload ->> 'notes', notes),
          revision = v_se.revision + 1
        where id = v_se.id
        returning * into v_se;
      else
        insert into public.session_exercises (
          id, session_id, exercise_id, position, superset_group, tracking_type,
          rest_seconds, skipped, skip_reason, notes, revision
        ) values (
          coalesce((v_payload ->> 'id')::uuid, gen_random_uuid()),
          v_session.id,
          (v_payload ->> 'exercise_id')::uuid,
          coalesce((v_payload ->> 'position')::int, 0),
          v_payload ->> 'superset_group',
          coalesce((v_payload ->> 'tracking_type')::public.tracking_type, 'weight_reps'),
          coalesce((v_payload ->> 'rest_seconds')::int, 90),
          coalesce((v_payload ->> 'skipped')::boolean, false),
          v_payload ->> 'skip_reason',
          coalesce(v_payload ->> 'notes', ''),
          1
        )
        returning * into v_se;
      end if;

      v_res := jsonb_build_object('op_id', v_op_id, 'status', 'synced', 'entity_id', v_se.id, 'revision', v_se.revision);

    elsif v_type = 'upsert_set' then
      select se.* into v_se from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = (v_payload ->> 'session_exercise_id')::uuid
        and s.user_id = uid and private.is_member(s.workspace_id);
      if not found then
        raise exception 'not_allowed';
      end if;

      select * into v_set from public.session_sets
      where id = (v_payload ->> 'id')::uuid for update;

      if found then
        if v_set.session_exercise_id <> v_se.id then
          raise exception 'not_allowed';
        end if;
        if v_base_rev is not null and v_base_rev < v_set.revision then
          insert into public.sync_conflicts (user_id, entity_type, entity_id, client_version, server_version)
          values (uid, 'session_set', v_set.id, v_payload, to_jsonb(v_set));
        end if;
        update public.session_sets set
          set_index = coalesce((v_payload ->> 'set_index')::int, set_index),
          set_type = coalesce((v_payload ->> 'set_type')::public.set_type, set_type),
          planned_reps_min = case when v_payload ? 'planned_reps_min' then (v_payload ->> 'planned_reps_min')::int else planned_reps_min end,
          planned_reps_max = case when v_payload ? 'planned_reps_max' then (v_payload ->> 'planned_reps_max')::int else planned_reps_max end,
          planned_weight_value = case when v_payload ? 'planned_weight_value' then (v_payload ->> 'planned_weight_value')::numeric else planned_weight_value end,
          planned_weight_unit = case when v_payload ? 'planned_weight_unit' then (v_payload ->> 'planned_weight_unit')::public.weight_unit else planned_weight_unit end,
          planned_duration_s = case when v_payload ? 'planned_duration_s' then (v_payload ->> 'planned_duration_s')::int else planned_duration_s end,
          actual_reps = case when v_payload ? 'actual_reps' then (v_payload ->> 'actual_reps')::int else actual_reps end,
          actual_weight_value = case when v_payload ? 'actual_weight_value' then (v_payload ->> 'actual_weight_value')::numeric else actual_weight_value end,
          actual_weight_unit = coalesce((v_payload ->> 'actual_weight_unit')::public.weight_unit, actual_weight_unit),
          actual_duration_s = case when v_payload ? 'actual_duration_s' then (v_payload ->> 'actual_duration_s')::int else actual_duration_s end,
          rpe = case when v_payload ? 'rpe' then (v_payload ->> 'rpe')::numeric else rpe end,
          note = case when v_payload ? 'note' then v_payload ->> 'note' else note end,
          state = coalesce((v_payload ->> 'state')::public.set_state, state),
          is_pr = coalesce((v_payload ->> 'is_pr')::boolean, is_pr),
          completed_at = case when v_payload ? 'completed_at' then (v_payload ->> 'completed_at')::timestamptz else completed_at end,
          revision = v_set.revision + 1
        where id = v_set.id
        returning * into v_set;
      else
        insert into public.session_sets (
          id, session_exercise_id, set_index, set_type,
          planned_reps_min, planned_reps_max, planned_weight_value, planned_weight_unit, planned_duration_s,
          actual_reps, actual_weight_value, actual_weight_unit, actual_duration_s,
          rpe, note, state, is_pr, completed_at, revision
        ) values (
          coalesce((v_payload ->> 'id')::uuid, gen_random_uuid()),
          v_se.id,
          coalesce((v_payload ->> 'set_index')::int, 0),
          coalesce((v_payload ->> 'set_type')::public.set_type, 'working'),
          (v_payload ->> 'planned_reps_min')::int,
          (v_payload ->> 'planned_reps_max')::int,
          (v_payload ->> 'planned_weight_value')::numeric,
          (v_payload ->> 'planned_weight_unit')::public.weight_unit,
          (v_payload ->> 'planned_duration_s')::int,
          (v_payload ->> 'actual_reps')::int,
          (v_payload ->> 'actual_weight_value')::numeric,
          coalesce((v_payload ->> 'actual_weight_unit')::public.weight_unit, 'kg'),
          (v_payload ->> 'actual_duration_s')::int,
          (v_payload ->> 'rpe')::numeric,
          v_payload ->> 'note',
          coalesce((v_payload ->> 'state')::public.set_state, 'not_recorded'),
          coalesce((v_payload ->> 'is_pr')::boolean, false),
          (v_payload ->> 'completed_at')::timestamptz,
          1
        )
        returning * into v_set;
      end if;

      if v_set.is_pr and v_set.state = 'completed' and v_set.set_type <> 'warmup' then
        select * into v_session from public.workout_sessions where id = v_se.session_id;
        if not exists (
          select 1 from public.activity_events
          where user_id = uid and type = 'pr' and ref_id = v_set.id
        ) then
          insert into public.activity_events (user_id, workspace_id, type, ref_id)
          values (uid, v_session.workspace_id, 'pr', v_set.id);
        end if;
      end if;

      v_res := jsonb_build_object('op_id', v_op_id, 'status', 'synced', 'entity_id', v_set.id, 'revision', v_set.revision);

    elsif v_type = 'delete_set' then
      delete from public.session_sets ss
      using public.session_exercises se, public.workout_sessions s
      where ss.id = (v_payload ->> 'id')::uuid
        and se.id = ss.session_exercise_id and s.id = se.session_id
        and s.user_id = uid and private.is_member(s.workspace_id);
      v_res := jsonb_build_object('op_id', v_op_id, 'status', 'synced', 'entity_id', v_payload ->> 'id');

    else
      raise exception 'unknown_op_type';
    end if;

    insert into public.sync_operations (user_id, op_id, op_type, result)
    values (uid, v_op_id, v_type, v_res);
    v_results := v_results || jsonb_build_array(v_res);
  end loop;

  return v_results;
end
$$;

-- Grants -------------------------------------------------------------------

revoke all on function
  private.guard_published_version(),
  private.can_publish_catalog(),
  private.is_staff(uuid),
  private.can_read_program_version(uuid),
  private.can_manage_program_version(uuid),
  private.can_access_session(uuid),
  private.owns_session(uuid)
from public, anon, authenticated;

revoke all on function
  public.create_program(uuid, text, text, uuid),
  public.publish_program(uuid),
  public.create_program_draft(uuid),
  public.duplicate_program(uuid, text, uuid),
  public.assign_program(uuid, uuid, uuid, date),
  public.end_program_assignment(uuid),
  public.sync_push(jsonb)
from public, anon, authenticated;

grant execute on function
  private.can_publish_catalog(),
  private.is_staff(uuid),
  private.can_read_program_version(uuid),
  private.can_manage_program_version(uuid),
  private.can_access_session(uuid),
  private.owns_session(uuid)
to authenticated;

grant execute on function
  public.create_program(uuid, text, text, uuid),
  public.publish_program(uuid),
  public.create_program_draft(uuid),
  public.duplicate_program(uuid, text, uuid),
  public.assign_program(uuid, uuid, uuid, date),
  public.end_program_assignment(uuid),
  public.sync_push(jsonb)
to authenticated;

grant select on
  public.muscle_groups,
  public.equipment,
  public.exercises,
  public.exercise_favorites,
  public.programs,
  public.program_versions,
  public.program_days,
  public.program_items,
  public.assignments,
  public.workout_sessions,
  public.session_exercises,
  public.session_sets,
  public.session_comments,
  public.activity_events,
  public.sync_operations,
  public.sync_conflicts
to authenticated;

grant insert (scope, workspace_id, owner_user_id, name, instructions, tracking_type, primary_muscle, equipment_id, default_rest_seconds),
      update (name, instructions, tracking_type, primary_muscle, equipment_id, default_rest_seconds),
      delete
  on public.exercises to authenticated;

grant insert (user_id, exercise_id), delete
  on public.exercise_favorites to authenticated;

grant update (name, description, archived_at), delete
  on public.programs to authenticated;

grant insert (program_version_id, week_index, day_index, title, weekday_hint),
      update (week_index, day_index, title, weekday_hint),
      delete
  on public.program_days to authenticated;

grant insert (
        program_day_id, exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      ),
      update (
        exercise_id, position, superset_group, tracking_type, sets_count,
        set_type, target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
        target_duration_s, target_rpe, rest_seconds, instructions, notes
      ),
      delete
  on public.program_items to authenticated;

grant insert (session_id, body)
  on public.session_comments to authenticated;
