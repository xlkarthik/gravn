-- Part 2: exercise catalog, programs, assignments, workout logging and sync_push.
begin;
select plan(26);

-- 1. Exercise catalog permissions.
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.exercises where scope = 'global'), 60,
  'members read the 60 global exercises');
select throws_ok(
  $$ insert into public.exercises (scope, name, primary_muscle, equipment_id)
     values ('global', 'Hacked Global', 'chest', 'barbell') $$,
  '42501', null, 'members cannot add to the global catalog');
select lives_ok(
  $$ insert into public.exercises (scope, owner_user_id, name, primary_muscle, equipment_id)
     values ('personal', tests.uid('member.a1@example.test'), 'My Band Squat', 'quads', 'band') $$,
  'member creates a personal exercise');

select tests.login('member.a2@example.test');
select is((select count(*)::int from public.exercises where name = 'My Band Squat'), 0,
  'another member cannot see someone else''s personal exercise');

select tests.login('trainer.a1@example.test');
select lives_ok(
  $$ insert into public.exercises (scope, workspace_id, name, primary_muscle, equipment_id)
     values ('workspace', tests.ws('Gym A'), 'Gym A Sled Push', 'quads', 'other') $$,
  'trainer creates a workspace exercise for their gym');

select tests.login('member.b1@example.test');
select is((select count(*)::int from public.exercises where name = 'Gym A Sled Push'), 0,
  'another gym cannot see Gym A''s custom exercise');

select tests.login('admin@example.test');
select lives_ok(
  $$ insert into public.exercises (scope, name, primary_muscle, equipment_id)
     values ('global', 'Admin Cable Row', 'back', 'cable') $$,
  'platform catalog publisher can add a global exercise');

-- 2. Programs, immutability and assignments.
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.assignments where status = 'active'), 1,
  'member sees their active program assignment');
select is((select count(*)::int from public.program_days), 3,
  'member reads the 3 days of their assigned program');

select tests.login('trainer.a1@example.test');
select throws_ok(
  $$ insert into public.program_days (program_version_id, week_index, day_index, title)
     select id, 1, 4, 'Mutated Day' from public.program_versions where status = 'published' limit 1 $$,
  'P0001', 'version_immutable', 'published program versions are immutable');

select isnt(
  public.create_program_draft((select id from public.programs where name = 'Full Body Foundation')),
  null, 'creating a draft clones the published version into v2');
select is(
  (select count(*)::int from public.program_days d
   join public.program_versions pv on pv.id = d.program_version_id
   where pv.version_number = 2 and pv.status = 'draft'),
  3, 'cloned draft v2 has all 3 days');

select tests.login('trainer.a2@example.test');
select throws_ok(
  $$ select public.assign_program(
       tests.ws('Gym A'),
       tests.member('Gym A', 'member.a1@example.test'),
       (select id from public.program_versions where status = 'published' limit 1)
     ) $$,
  'P0001', 'not_allowed', 'an unassigned trainer cannot assign a plan to another trainer''s client');

-- 3. Offline sync_push, idempotency, LWW conflicts and tenant isolation.
create temp table sync_ids (
  session_id uuid,
  se_id uuid,
  set_id uuid,
  op1 uuid,
  op2 uuid,
  op3 uuid,
  op4 uuid
);
insert into sync_ids values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);
grant select on sync_ids to authenticated;

select tests.login('member.a1@example.test');
select lives_ok($$
  select public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'op_id', (select op1 from sync_ids),
      'type', 'upsert_session',
      'payload', jsonb_build_object(
        'id', (select session_id from sync_ids),
        'workspace_id', tests.ws('Gym A'),
        'title', 'Day 1 • Squat & Push',
        'planned_snapshot', '{"title":"Day 1"}',
        'status', 'completed',
        'duration_seconds', 2700
      )
    ),
    jsonb_build_object(
      'op_id', (select op2 from sync_ids),
      'type', 'upsert_exercise',
      'payload', jsonb_build_object(
        'id', (select se_id from sync_ids),
        'session_id', (select session_id from sync_ids),
        'exercise_id', (select id from public.exercises where name = 'Barbell Back Squat' limit 1),
        'position', 0,
        'tracking_type', 'weight_reps'
      )
    ),
    jsonb_build_object(
      'op_id', (select op3 from sync_ids),
      'type', 'upsert_set',
      'payload', jsonb_build_object(
        'id', (select set_id from sync_ids),
        'session_exercise_id', (select se_id from sync_ids),
        'set_index', 0,
        'set_type', 'working',
        'actual_reps', 8,
        'actual_weight_value', 100,
        'actual_weight_unit', 'kg',
        'state', 'completed',
        'is_pr', true
      )
    )
  ))
$$, 'member pushes a completed session, exercise and PR set via sync_push');

-- Replaying the exact same op_id creates no duplicate rows.
select lives_ok($$
  select public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'op_id', (select op3 from sync_ids),
      'type', 'upsert_set',
      'payload', jsonb_build_object(
        'id', (select set_id from sync_ids),
        'session_exercise_id', (select se_id from sync_ids),
        'set_index', 0,
        'actual_reps', 99,
        'actual_weight_value', 999,
        'state', 'completed'
      )
    )
  ))
$$, 'replaying an existing op_id is idempotent');

select is((select actual_reps from public.session_sets where id = (select set_id from sync_ids)), 8,
  'replayed op_id did not overwrite the original set');
select is((select count(*)::int from public.activity_events where user_id = tests.uid('member.a1@example.test')), 2,
  'activity_events recorded session_completed and pr once');

-- Stale base_revision logs a diagnostic conflict while applying LWW (D-59).
select lives_ok($$
  select public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'op_id', (select op4 from sync_ids),
      'type', 'upsert_set',
      'base_revision', 0,
      'payload', jsonb_build_object(
        'id', (select set_id from sync_ids),
        'session_exercise_id', (select se_id from sync_ids),
        'actual_reps', 10,
        'state', 'completed'
      )
    )
  ))
$$, 'stale base_revision succeeds with LWW');
select is((select count(*)::int from public.sync_conflicts where user_id = tests.uid('member.a1@example.test')), 1,
  'stale base_revision logs a row in sync_conflicts');
select is((select actual_reps from public.session_sets where id = (select set_id from sync_ids)), 10,
  'LWW updated the set value');

-- Cross-tenant / cross-user sync_push attack is rejected.
select throws_ok($$
  select public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'op_id', gen_random_uuid(),
      'type', 'upsert_session',
      'payload', jsonb_build_object(
        'id', gen_random_uuid(),
        'workspace_id', tests.ws('Gym B'),
        'title', 'Cross-tenant'
      )
    )
  ))
$$, 'P0001', 'not_allowed', 'sync_push into another gym is rejected');

-- 4. Trainer review and feedback visibility.
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.workout_sessions where id = (select session_id from sync_ids)), 1,
  'assigned trainer reads their client''s synced session');
select lives_ok($$
  insert into public.session_comments (session_id, body)
  values ((select session_id from sync_ids), 'Great depth on those squats!')
$$, 'assigned trainer comments on the session');

select tests.login('member.a1@example.test');
select is((select count(*)::int from public.session_comments where session_id = (select session_id from sync_ids)), 1,
  'member reads the trainer''s comment');

select tests.login('trainer.a2@example.test');
select is((select count(*)::int from public.workout_sessions where id = (select session_id from sync_ids)), 0,
  'unassigned trainer cannot read the session');

select tests.login('owner.b@example.test');
select is((select count(*)::int from public.workout_sessions where id = (select session_id from sync_ids)), 0,
  'another gym''s owner cannot read the session');

select * from finish();
rollback;
