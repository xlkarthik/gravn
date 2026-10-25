-- Test helpers, committed (not rolled back) so every later test file can use them.
-- They exist only in local and CI databases; migrations never create them.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.uid(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = p_email
$$;

-- Named gyms and coach workspaces from the seed ('Gym A', 'Gym B', 'Coach C').
create or replace function tests.ws(p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where name = p_name and type <> 'personal'
$$;

create or replace function tests.personal_ws(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where created_by = tests.uid(p_email) and type = 'personal'
$$;

create or replace function tests.member(p_ws text, p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.workspace_members where workspace_id = tests.ws(p_ws) and user_id = tests.uid(p_email)
$$;

-- Act as a signed-in user for the rest of the transaction (or until the next call).
create or replace function tests.login(p_email text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_email), 'role', 'authenticated', 'email', p_email)::text, true);
end
$$;

create or replace function tests.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end
$$;

-- A fresh account, as if the person had just signed up (and confirmed, unless told not to).
create or replace function tests.create_user(p_email text, p_confirmed boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    case when p_confirmed then now() end, jsonb_build_object('display_name', split_part(p_email, '@', 1)));
  return uid;
end
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers installed');
select * from finish();
