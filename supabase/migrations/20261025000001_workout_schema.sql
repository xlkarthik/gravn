-- Schema v2: exercise catalog, programs, assignments, workout logging and offline sync (Part 2).
-- Conventions: plan/ref-data-model.md. Access rules and RPCs are in 20261025000002_workout_access_rpc.sql.

create type public.resource_scope as enum ('global', 'workspace', 'personal');
create type public.tracking_type as enum (
  'weight_reps',
  'reps',
  'added_weight',
  'assisted',
  'time',
  'distance',
  'distance_time'
);
create type public.program_version_status as enum ('draft', 'published');
create type public.set_type as enum ('warmup', 'working', 'drop', 'failure', 'amrap');
create type public.assignment_status as enum ('active', 'ended');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');
create type public.set_state as enum ('not_recorded', 'completed', 'incomplete', 'skipped');
create type public.weight_unit as enum ('kg', 'lb');

-- Exercise catalog ---------------------------------------------------------

create table public.muscle_groups (
  id text primary key,
  name_key text not null
);

insert into public.muscle_groups (id, name_key) values
  ('chest', 'muscles.chest'),
  ('back', 'muscles.back'),
  ('shoulders', 'muscles.shoulders'),
  ('quads', 'muscles.quads'),
  ('hamstrings', 'muscles.hamstrings'),
  ('glutes', 'muscles.glutes'),
  ('biceps', 'muscles.biceps'),
  ('triceps', 'muscles.triceps'),
  ('calves', 'muscles.calves'),
  ('core', 'muscles.core'),
  ('full_body', 'muscles.full_body');

create table public.equipment (
  id text primary key,
  name_key text not null
);

insert into public.equipment (id, name_key) values
  ('barbell', 'equipment.barbell'),
  ('dumbbell', 'equipment.dumbbell'),
  ('machine', 'equipment.machine'),
  ('cable', 'equipment.cable'),
  ('bodyweight', 'equipment.bodyweight'),
  ('kettlebell', 'equipment.kettlebell'),
  ('band', 'equipment.band'),
  ('other', 'equipment.other');

-- Explicit scope check ensures a missing owner never means "public".
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  scope public.resource_scope not null,
  workspace_id uuid references public.workspaces on delete cascade,
  owner_user_id uuid references auth.users on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  tracking_type public.tracking_type not null default 'weight_reps',
  primary_muscle text not null references public.muscle_groups,
  equipment_id text not null references public.equipment,
  default_rest_seconds int not null default 90 check (default_rest_seconds between 0 and 600),
  placeholder_demo text not null default 'Placeholder: not licensed for release',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and workspace_id is null and owner_user_id is null)
    or (scope = 'workspace' and workspace_id is not null and owner_user_id is null)
    or (scope = 'personal' and workspace_id is null and owner_user_id is not null)
  )
);

create index exercises_scope_workspace on public.exercises (scope, workspace_id);
create index exercises_owner on public.exercises (owner_user_id) where scope = 'personal';
create index exercises_muscle_equipment on public.exercises (primary_muscle, equipment_id);

create table public.exercise_favorites (
  user_id uuid not null references auth.users on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- Programs and assignments -------------------------------------------------

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  client_member_id uuid,
  created_by uuid default auth.uid() references auth.users on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, client_member_id)
    references public.workspace_members (workspace_id, id) on delete set null (client_member_id)
);

create index programs_workspace on public.programs (workspace_id) where archived_at is null;

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  workspace_id uuid not null,
  version_number int not null check (version_number >= 1),
  status public.program_version_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version_number),
  unique (workspace_id, id),
  foreign key (workspace_id, program_id)
    references public.programs (workspace_id, id) on delete cascade
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references public.program_versions on delete cascade,
  week_index int not null default 1 check (week_index between 1 and 52),
  day_index int not null check (day_index between 1 and 14),
  title text not null check (char_length(trim(title)) between 1 and 80),
  weekday_hint int check (weekday_hint between 1 and 7),
  created_at timestamptz not null default now(),
  unique (program_version_id, week_index, day_index)
);

create table public.program_items (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days on delete cascade,
  exercise_id uuid not null references public.exercises on delete restrict,
  position int not null check (position >= 0),
  superset_group text check (char_length(superset_group) <= 16),
  tracking_type public.tracking_type,
  sets_count int not null default 3 check (sets_count between 1 and 20),
  set_type public.set_type not null default 'working',
  target_reps_min int check (target_reps_min >= 1),
  target_reps_max int check (target_reps_max >= target_reps_min),
  target_weight_value numeric(7,2) check (target_weight_value >= 0),
  target_weight_unit public.weight_unit,
  target_duration_s int check (target_duration_s >= 1),
  target_rpe numeric(3,1) check (target_rpe between 1 and 10),
  rest_seconds int not null default 90 check (rest_seconds between 0 and 600),
  instructions text not null default '' check (char_length(instructions) <= 500),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index program_items_day on public.program_items (program_day_id, position);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  client_member_id uuid not null,
  program_version_id uuid not null,
  start_date date not null default current_date,
  status public.assignment_status not null default 'active',
  assigned_by uuid references auth.users on delete set null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, client_member_id)
    references public.workspace_members (workspace_id, id) on delete cascade,
  foreign key (workspace_id, program_version_id)
    references public.program_versions (workspace_id, id) on delete restrict
);

create unique index assignments_one_active_per_client
  on public.assignments (workspace_id, client_member_id) where status = 'active';

-- Workout logging and sync -------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  assignment_id uuid references public.assignments on delete set null,
  program_version_id uuid references public.program_versions on delete set null,
  program_day_id uuid references public.program_days on delete set null,
  title text not null default 'Workout' check (char_length(trim(title)) between 1 and 80),
  planned_snapshot jsonb not null default '{}',
  status public.session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds int check (duration_seconds >= 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_user_started on public.workout_sessions (user_id, started_at desc);
create index workout_sessions_workspace_started on public.workout_sessions (workspace_id, started_at desc);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions on delete cascade,
  exercise_id uuid not null references public.exercises on delete restrict,
  position int not null check (position >= 0),
  superset_group text check (char_length(superset_group) <= 16),
  tracking_type public.tracking_type not null default 'weight_reps',
  rest_seconds int not null default 90 check (rest_seconds between 0 and 600),
  skipped boolean not null default false,
  skip_reason text check (char_length(skip_reason) <= 200),
  notes text not null default '' check (char_length(notes) <= 500),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_exercises_session on public.session_exercises (session_id, position);
create index session_exercises_exercise on public.session_exercises (exercise_id);

-- 0 is a real recorded value; null means "not recorded".
create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises on delete cascade,
  set_index int not null check (set_index >= 0),
  set_type public.set_type not null default 'working',
  planned_reps_min int,
  planned_reps_max int,
  planned_weight_value numeric(7,2),
  planned_weight_unit public.weight_unit,
  planned_duration_s int,
  actual_reps int check (actual_reps >= 0),
  actual_weight_value numeric(7,2) check (actual_weight_value >= 0),
  actual_weight_unit public.weight_unit default 'kg',
  actual_weight_kg numeric(7,2) generated always as (
    case
      when actual_weight_value is null then null
      when actual_weight_unit = 'lb' then round(actual_weight_value * 0.45359237, 2)
      else actual_weight_value
    end
  ) stored,
  actual_duration_s int check (actual_duration_s >= 0),
  rpe numeric(3,1) check (rpe between 1 and 10),
  note text check (char_length(note) <= 200),
  state public.set_state not null default 'not_recorded',
  is_pr boolean not null default false,
  completed_at timestamptz,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_sets_exercise on public.session_sets (session_exercise_id, set_index);

create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index session_comments_session on public.session_comments (session_id, created_at);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  type text not null check (type in ('session_completed', 'pr')),
  ref_id uuid not null,
  created_at timestamptz not null default now()
);

create index activity_events_user on public.activity_events (user_id, created_at desc);

create table public.sync_operations (
  user_id uuid not null references auth.users on delete cascade,
  op_id uuid not null,
  op_type text not null,
  result jsonb not null default '{}',
  received_at timestamptz not null default now(),
  primary key (user_id, op_id)
);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  client_version jsonb not null,
  server_version jsonb not null,
  created_at timestamptz not null default now()
);

-- Immutability of published program versions -------------------------------

create function private.guard_published_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_vid uuid;
  v_status public.program_version_status;
begin
  if tg_table_name = 'program_versions' then
    if old.status = 'published' then
      raise exception 'version_immutable';
    end if;
    return coalesce(new, old);
  elsif tg_table_name = 'program_days' then
    v_vid := coalesce(new.program_version_id, old.program_version_id);
  elsif tg_table_name = 'program_items' then
    select d.program_version_id into v_vid
    from public.program_days d
    where d.id = coalesce(new.program_day_id, old.program_day_id);
  end if;

  select status into v_status from public.program_versions where id = v_vid;
  if v_status = 'published' then
    raise exception 'version_immutable';
  end if;
  return coalesce(new, old);
end
$$;

create trigger guard_published_program_version
  before update or delete on public.program_versions
  for each row execute function private.guard_published_version();

create trigger guard_published_program_days
  before insert or update or delete on public.program_days
  for each row execute function private.guard_published_version();

create trigger guard_published_program_items
  before insert or update or delete on public.program_items
  for each row execute function private.guard_published_version();

-- updated_at triggers ------------------------------------------------------

create trigger set_updated_at before update on public.exercises
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.programs
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.program_versions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workout_sessions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.session_exercises
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.session_sets
  for each row execute function private.set_updated_at();
