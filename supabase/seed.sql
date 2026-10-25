-- Synthetic local data only. Every address is @example.test; every password is password123.
-- Shape (plan/01-foundation.md 1.2): Gym A and Gym B with an owner, 2 trainers and 5 members
-- each; Coach C with 3 clients; a solo consumer; a person who is a member in Gym A and a
-- trainer in Gym B; a former (archived) Gym A member; a platform admin.

create function pg_temp.add_user(p_email text, p_name text) returns uuid
language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true), now(), now(), now());
  update public.profiles set onboarded_at = now() where user_id = uid;
  return uid;
end
$$;

create function pg_temp.add_workspace(p_type public.workspace_type, p_name text, p_owner uuid) returns uuid
language plpgsql as $$
declare
  ws uuid;
begin
  insert into public.workspaces (type, name, created_by) values (p_type, p_name, p_owner) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, roles)
  values (
    ws,
    p_owner,
    case when p_type = 'coach' then '{owner,trainer}'::public.workspace_role[] else '{owner}'::public.workspace_role[] end
  );
  return ws;
end
$$;

create function pg_temp.add_member(p_ws uuid, p_user uuid, p_role public.workspace_role) returns uuid
language sql as $$
  insert into public.workspace_members (workspace_id, user_id, roles)
  values (p_ws, p_user, array[p_role]) returning id
$$;

create function pg_temp.assign(p_ws uuid, p_trainer uuid, variadic p_clients uuid[]) returns void
language sql as $$
  insert into public.trainer_assignments (workspace_id, trainer_member_id, client_member_id)
  select p_ws, p_trainer, c from unnest(p_clients) c
$$;

do $$
declare
  gym_a uuid := pg_temp.add_workspace('gym', 'Gym A', pg_temp.add_user('owner.a@example.test', 'Arjun Nair'));
  gym_b uuid := pg_temp.add_workspace('gym', 'Gym B', pg_temp.add_user('owner.b@example.test', 'Sanjay Varma'));
  coach_c uuid := pg_temp.add_workspace('coach', 'Coach C', pg_temp.add_user('coach@example.test', 'Kiran Joseph'));
  dual uuid := pg_temp.add_user('dual@example.test', 'Dev Mathew');
  t_a1 uuid := pg_temp.add_member(gym_a, pg_temp.add_user('trainer.a1@example.test', 'Meera Pillai'), 'trainer');
  t_a2 uuid := pg_temp.add_member(gym_a, pg_temp.add_user('trainer.a2@example.test', 'Vivek Menon'), 'trainer');
  t_b1 uuid := pg_temp.add_member(gym_b, pg_temp.add_user('trainer.b1@example.test', 'Divya Krishnan'), 'trainer');
  t_b2 uuid := pg_temp.add_member(gym_b, pg_temp.add_user('trainer.b2@example.test', 'Nikhil Raj'), 'trainer');
  t_dual uuid := pg_temp.add_member(gym_b, dual, 'trainer');
  m_dual uuid := pg_temp.add_member(gym_a, dual, 'member');
  m_a uuid[] := array[
    pg_temp.add_member(gym_a, pg_temp.add_user('member.a1@example.test', 'Ananya Das'), 'member'),
    pg_temp.add_member(gym_a, pg_temp.add_user('member.a2@example.test', 'Rohan Thomas'), 'member'),
    pg_temp.add_member(gym_a, pg_temp.add_user('member.a3@example.test', 'Fathima Rahman'), 'member'),
    pg_temp.add_member(gym_a, pg_temp.add_user('member.a4@example.test', 'Joseph Kurian'), 'member'),
    pg_temp.add_member(gym_a, pg_temp.add_user('member.a5@example.test', 'Lakshmi Iyer'), 'member')];
  m_b uuid[] := array[
    pg_temp.add_member(gym_b, pg_temp.add_user('member.b1@example.test', 'Aisha Khan'), 'member'),
    pg_temp.add_member(gym_b, pg_temp.add_user('member.b2@example.test', 'Manu Mohan'), 'member'),
    pg_temp.add_member(gym_b, pg_temp.add_user('member.b3@example.test', 'Sneha George'), 'member'),
    pg_temp.add_member(gym_b, pg_temp.add_user('member.b4@example.test', 'Arun Kumar'), 'member'),
    pg_temp.add_member(gym_b, pg_temp.add_user('member.b5@example.test', 'Neha Suresh'), 'member')];
  former uuid := pg_temp.add_member(gym_a, pg_temp.add_user('former.a@example.test', 'Anu Former'), 'member');
  c_m uuid[] := array[
    pg_temp.add_member(coach_c, pg_temp.add_user('client.c1@example.test', 'Rahul Varghese'), 'member'),
    pg_temp.add_member(coach_c, pg_temp.add_user('client.c2@example.test', 'Asha Menon'), 'member'),
    pg_temp.add_member(coach_c, pg_temp.add_user('client.c3@example.test', 'Deepak Nair'), 'member')];
  t_coach uuid := (select id from public.workspace_members where workspace_id = coach_c and 'trainer' = any (roles));
  owner_a uuid := (select id from auth.users where email = 'owner.a@example.test');
  trainer_a1 uuid := (select id from auth.users where email = 'trainer.a1@example.test');
begin
  perform pg_temp.add_user('solo@example.test', 'Gautham Prakash');
  insert into public.platform_admins (user_id, can_publish_catalog, can_manage_billing)
  values (pg_temp.add_user('admin@example.test', 'Gravn Admin'), true, true);

  perform pg_temp.assign(gym_a, t_a1, m_a[1], m_a[2], m_a[3]);
  perform pg_temp.assign(gym_a, t_a2, m_a[4], m_a[5], m_dual);
  perform pg_temp.assign(gym_b, t_b1, m_b[1], m_b[2], m_b[3]);
  perform pg_temp.assign(gym_b, t_b2, m_b[4]);
  perform pg_temp.assign(gym_b, t_dual, m_b[5]);
  perform pg_temp.assign(coach_c, t_coach, c_m[1], c_m[2], c_m[3]);

  -- The former member trained with trainer.a1 before leaving.
  insert into public.trainer_assignments (workspace_id, trainer_member_id, client_member_id, ended_at)
  values (gym_a, t_a1, former, now());
  update public.workspace_members set status = 'archived', archived_at = now() where id = former;

  -- Pending people, and an outstanding invitation (link token: seed-invite-gym-a).
  insert into public.client_records (workspace_id, display_name, email, created_by) values
    (gym_a, 'Priya Pending', 'priya@example.test', owner_a),
    (gym_a, 'Rahul Prospect', null, trainer_a1);
  insert into public.invitations (workspace_id, email, role, token_hash, expires_at, created_by)
  values (gym_a, 'new.member@example.test', 'member', extensions.digest('seed-invite-gym-a', 'sha256'),
    now() + interval '7 days', owner_a);

  -- Part 2 seed: a published 3-day program in Gym A assigned to member.a1.
  declare
    v_prog uuid := gen_random_uuid();
    v_ver uuid := gen_random_uuid();
    v_d1 uuid := gen_random_uuid();
    v_d2 uuid := gen_random_uuid();
    v_d3 uuid := gen_random_uuid();
    v_assign uuid := gen_random_uuid();
    v_squat uuid := (select id from public.exercises where scope = 'global' and name = 'Barbell Back Squat');
    v_bench uuid := (select id from public.exercises where scope = 'global' and name = 'Barbell Bench Press');
    v_row uuid := (select id from public.exercises where scope = 'global' and name = 'Seated Cable Row');
    v_plank uuid := (select id from public.exercises where scope = 'global' and name = 'Plank');
    v_rdl uuid := (select id from public.exercises where scope = 'global' and name = 'Romanian Deadlift');
    v_ohp uuid := (select id from public.exercises where scope = 'global' and name = 'Overhead Barbell Press');
    v_lat uuid := (select id from public.exercises where scope = 'global' and name = 'Lat Pulldown');
  begin
    insert into public.programs (id, workspace_id, name, description, created_by)
    values (v_prog, gym_a, 'Full Body Foundation', '3-day strength foundation.', trainer_a1);

    insert into public.program_versions (id, program_id, workspace_id, version_number, status)
    values (v_ver, v_prog, gym_a, 1, 'draft');

    insert into public.program_days (id, program_version_id, week_index, day_index, title, weekday_hint) values
      (v_d1, v_ver, 1, 1, 'Day 1 • Squat & Push', 1),
      (v_d2, v_ver, 1, 2, 'Day 2 • Hinge & Overhead', 3),
      (v_d3, v_ver, 1, 3, 'Day 3 • Upper & Core', 5);

    insert into public.program_items (
      program_day_id, exercise_id, position, superset_group, tracking_type, sets_count,
      target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_duration_s, rest_seconds, notes
    ) values
      (v_d1, v_squat, 0, null, 'weight_reps', 3, 6, 8, 60, 'kg', null, 120, 'Focus on depth'),
      (v_d1, v_bench, 1, 'A', 'weight_reps', 3, 8, 10, 45, 'kg', null, 90, 'Superset with row'),
      (v_d1, v_row, 2, 'A', 'weight_reps', 3, 10, 12, 40, 'kg', null, 90, 'Squeeze lats'),
      (v_d1, v_plank, 3, null, 'time', 2, null, null, null, null, 45, 60, 'Brace abs'),
      (v_d2, v_rdl, 0, null, 'weight_reps', 3, 8, 10, 55, 'kg', null, 120, 'Hinge back'),
      (v_d2, v_ohp, 1, null, 'weight_reps', 3, 8, 10, 30, 'kg', null, 90, 'Strict press'),
      (v_d3, v_lat, 0, null, 'weight_reps', 3, 10, 12, 40, 'kg', null, 90, 'Full stretch');

    update public.program_versions set status = 'published', published_at = now(), published_by = trainer_a1
    where id = v_ver;

    insert into public.assignments (id, workspace_id, client_member_id, program_version_id, assigned_by)
    values (v_assign, gym_a, m_a[1], v_ver, trainer_a1);
  end;

  -- Part 3 seed: physical gym memberships in Gym A (including 5-day and 18-day expiries) + measurements.
  declare
    v_solo_uid uuid := (select id from auth.users where email = 'solo@example.test');
    v_ma1_uid uuid := (select id from auth.users where email = 'member.a1@example.test');
    v_solo_ws uuid := (select id from public.workspaces where created_by = v_solo_uid and type = 'personal');
  begin
    insert into public.gym_memberships (workspace_id, member_id, plan_label, start_date, end_date, status, notes) values
      (gym_a, m_a[1], 'Annual Gold', current_date - 360, current_date + 5, 'active', 'Renewal due this week'),
      (gym_a, m_a[2], 'Quarterly Strength', current_date - 72, current_date + 18, 'active', 'Follow up mid-month'),
      (gym_a, m_a[3], 'Monthly Access', current_date - 10, current_date + 20, 'active', ''),
      (gym_a, m_a[4], 'Annual Gold', current_date - 90, current_date + 275, 'active', ''),
      (gym_a, m_a[5], 'Monthly Access', current_date - 40, current_date - 10, 'expired', 'Lapsed last week');

    insert into public.measurement_entries (
      subject_user_id, workspace_id, definition_id, value, unit, value_canonical, measured_on, recorded_by
    ) values
      (v_solo_uid, v_solo_ws, 'weight', 78.4, 'kg', 78.4, current_date - 28, v_solo_uid),
      (v_solo_uid, v_solo_ws, 'weight', 77.9, 'kg', 77.9, current_date - 21, v_solo_uid),
      (v_solo_uid, v_solo_ws, 'weight', 77.2, 'kg', 77.2, current_date - 7,  v_solo_uid),
      (v_solo_uid, v_solo_ws, 'weight', 76.8, 'kg', 76.8, current_date,      v_solo_uid),
      (v_solo_uid, v_solo_ws, 'waist',  84.0, 'cm', 84.0, current_date - 28, v_solo_uid),
      (v_solo_uid, v_solo_ws, 'waist',  82.5, 'cm', 82.5, current_date,      v_solo_uid),
      (v_ma1_uid,  gym_a,     'weight', 64.5, 'kg', 64.5, current_date - 21, trainer_a1),
      (v_ma1_uid,  gym_a,     'weight', 63.8, 'kg', 63.8, current_date - 7,  trainer_a1),
      (v_ma1_uid,  gym_a,     'weight', 63.4, 'kg', 63.4, current_date,      trainer_a1);
  end;
end
$$;
