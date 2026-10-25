-- Schema v1: identity and workspaces (Part 1).
-- Conventions: plan/ref-data-model.md. Who can see what: PERMISSIONS.md.

-- Helpers that RLS policies call live here. The Data API only exposes `public`.
create schema private;

create type public.workspace_type as enum ('gym', 'coach', 'personal');
create type public.workspace_role as enum ('owner', 'trainer', 'member');
create type public.member_status as enum ('active', 'archived');
create type public.unit_system as enum ('metric', 'imperial');

create function private.is_valid_timezone(tz text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz)
$$;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- People ------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  timezone text not null default 'Asia/Kolkata' check (private.is_valid_timezone(timezone)),
  locale text not null default 'en' check (locale in ('en', 'ml')),
  unit_system public.unit_system not null default 'metric',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspaces and membership ------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  type public.workspace_type not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  timezone text not null default 'Asia/Kolkata' check (private.is_valid_timezone(timezone)),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_one_personal_per_user
  on public.workspaces (created_by) where type = 'personal';

-- Roles are an array so one person can be owner and trainer in the same gym (D-26).
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  roles public.workspace_role[] not null check (cardinality(roles) > 0),
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, id),
  check ((status = 'archived') = (archived_at is not null))
);

create index workspace_members_user on public.workspace_members (user_id, workspace_id);
create index workspace_members_workspace on public.workspace_members (workspace_id, status);

-- People a gym or coach added before they have an account. Never public.
create table public.client_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  email text check (email = lower(email)),
  phone text check (char_length(phone) <= 20),
  created_by uuid default auth.uid() references auth.users on delete set null,
  claimed_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, claimed_by_member_id)
    references public.workspace_members (workspace_id, id) on delete set null (claimed_by_member_id)
);

-- Only the SHA-256 of the token is stored. Single use; if email is set, it must match on accept.
-- Client-record invitations may omit email so the link can be shared directly (D-57).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text check (email = lower(email)),
  role public.workspace_role not null check (role <> 'owner'),
  client_record_id uuid,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (email is not null or client_record_id is not null),
  foreign key (workspace_id, client_record_id)
    references public.client_records (workspace_id, id) on delete cascade
);

create index invitations_workspace_email on public.invitations (workspace_id, email);

-- Composite foreign keys keep trainer and client in the same workspace.
create table public.trainer_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  trainer_member_id uuid not null,
  client_member_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, trainer_member_id)
    references public.workspace_members (workspace_id, id) on delete cascade,
  foreign key (workspace_id, client_member_id)
    references public.workspace_members (workspace_id, id) on delete cascade,
  check (trainer_member_id <> client_member_id)
);

create unique index trainer_assignments_one_active
  on public.trainer_assignments (trainer_member_id, client_member_id) where ended_at is null;
create index trainer_assignments_client
  on public.trainer_assignments (client_member_id) where ended_at is null;

-- Platform ----------------------------------------------------------------

-- Granted only by a migration or an existing admin.
create table public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  can_publish_catalog boolean not null default false,
  can_manage_billing boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('min_supported_version', '"0.1.0"'),
  ('maintenance_message', 'null');

-- No sensitive payloads in metadata.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users on delete set null,
  workspace_id uuid references public.workspaces on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_events_workspace on public.audit_events (workspace_id, created_at desc);

-- updated_at triggers -----------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.client_records
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.app_config
  for each row execute function private.set_updated_at();
