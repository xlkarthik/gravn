begin;
select plan(11);

select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 1,
  'before removal the trainer sees their client');

-- Only owners remove people, and only in their own gym.
select throws_ok($$ select public.remove_member(tests.ws('Gym A'), tests.member('Gym A', 'member.a1@example.test')) $$,
  'P0001', 'not_allowed', 'trainers cannot remove members');
select tests.login('owner.b@example.test');
select throws_ok($$ select public.remove_member(tests.ws('Gym A'), tests.member('Gym A', 'trainer.a1@example.test')) $$,
  'P0001', 'not_allowed', 'another gym''s owner cannot remove anyone');

select tests.login('owner.a@example.test');
select lives_ok($$ select public.remove_member(tests.ws('Gym A'), tests.member('Gym A', 'trainer.a1@example.test')) $$,
  'owner removes a trainer');

-- The removed trainer's very next queries return nothing.
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 0,
  'removed trainer can no longer read former clients');
select is((select count(*)::int from public.workspace_members
  where workspace_id = tests.ws('Gym A') and user_id <> tests.uid('trainer.a1@example.test')), 0,
  'removed trainer sees nobody in the gym');
select is((select count(*)::int from jsonb_array_elements(public.get_my_access() -> 'workspaces') w
  where (w ->> 'id')::uuid = tests.ws('Gym A')), 0,
  'the gym is gone from their access list');

-- Guards.
select tests.login('owner.a@example.test');
select throws_ok($$ select public.remove_member(tests.ws('Gym A'), tests.member('Gym A', 'owner.a@example.test')) $$,
  'P0001', 'last_owner', 'a gym always keeps an owner');
select throws_ok(format('select public.remove_member(%L, %L)', tests.personal_ws('owner.a@example.test'),
  (select id from public.workspace_members where workspace_id = tests.personal_ws('owner.a@example.test'))),
  'P0001', 'not_allowed', 'nobody is removed from a personal workspace');

-- Restoring brings gym access back, without the old assignments.
select lives_ok($$ select public.restore_member(tests.ws('Gym A'), tests.member('Gym A', 'trainer.a1@example.test')) $$,
  'owner restores the trainer');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 0,
  'restored trainer has no clients until reassigned');

select * from finish();
rollback;
