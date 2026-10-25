begin;
select plan(11);

-- Visibility.
select tests.login('owner.a@example.test');
select is((select count(*)::int from public.trainer_assignments where workspace_id = tests.ws('Gym A') and ended_at is null), 6,
  'owner sees every active assignment in their gym');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.trainer_assignments where ended_at is null), 3,
  'trainer sees their own assignments');
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.trainer_assignments), 1, 'member sees who their trainer is');
select tests.login('member.b1@example.test');
select is((select count(*)::int from public.trainer_assignments where workspace_id = tests.ws('Gym A')), 0,
  'another gym''s member sees none');

-- Assigning.
select tests.login('owner.a@example.test');
select lives_ok($$ select public.assign_trainer(tests.ws('Gym A'),
  tests.member('Gym A', 'trainer.a1@example.test'), tests.member('Gym A', 'member.a4@example.test')) $$,
  'owner assigns a trainer');
select throws_ok($$ select public.assign_trainer(tests.ws('Gym A'),
  tests.member('Gym B', 'trainer.b1@example.test'), tests.member('Gym A', 'member.a4@example.test')) $$,
  'P0001', 'not_found', 'a trainer from another gym cannot be assigned');
select throws_ok($$ select public.assign_trainer(tests.ws('Gym A'),
  tests.member('Gym A', 'member.a1@example.test'), tests.member('Gym A', 'member.a4@example.test')) $$,
  'P0001', 'not_found', 'a member cannot be assigned as a trainer');

select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.workspace_members where user_id = tests.uid('member.a4@example.test')), 1,
  'the trainer now sees the new client');
select throws_ok($$ select public.assign_trainer(tests.ws('Gym A'),
  tests.member('Gym A', 'trainer.a1@example.test'), tests.member('Gym A', 'member.a5@example.test')) $$,
  'P0001', 'not_allowed', 'trainers cannot assign themselves clients');
select throws_ok($$ insert into public.trainer_assignments (workspace_id, trainer_member_id, client_member_id)
  values (tests.ws('Gym A'), tests.member('Gym A', 'trainer.a1@example.test'), tests.member('Gym A', 'member.a5@example.test')) $$,
  '42501', null, 'assignments cannot be inserted directly');

-- Ending an assignment ends access.
select tests.login('owner.a@example.test');
select public.end_trainer_assignment(id) from public.trainer_assignments
where client_member_id = tests.member('Gym A', 'member.a4@example.test')
  and trainer_member_id = tests.member('Gym A', 'trainer.a1@example.test') and ended_at is null;
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.workspace_members where user_id = tests.uid('member.a4@example.test')), 0,
  'after unassigning, the trainer no longer sees that client');

select * from finish();
rollback;
