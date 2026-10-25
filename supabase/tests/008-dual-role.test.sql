-- One person: a member in Gym A and a trainer in Gym B. Each role stays in its own gym.
begin;
select plan(6);

select tests.login('dual@example.test');

select set_eq(
  $$ select w ->> 'name' || ':' || (w -> 'roles' ->> 0) from jsonb_array_elements(public.get_my_access() -> 'workspaces') w $$,
  array['Gym A:member', 'Gym B:trainer', 'Personal:owner'],
  'access lists each workspace with its own role');

-- In Gym A they are only a member.
select is((select count(*)::int from public.workspace_members
  where workspace_id = tests.ws('Gym A') and 'member' = any (roles) and user_id <> tests.uid('dual@example.test')), 0,
  'as a Gym A member they see no other Gym A members');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 0,
  'their Gym B trainer role gives nothing in Gym A');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'x@example.test', 'member') $$,
  'P0001', 'not_allowed', 'they cannot invite into Gym A');

-- In Gym B they see their own client and nobody else's.
select set_eq(
  $$ select user_id from public.workspace_members where workspace_id = tests.ws('Gym B') and 'member' = any (roles) $$,
  array[tests.uid('member.b5@example.test')],
  'as a Gym B trainer they see only their assigned client');
select lives_ok($$ select public.create_invitation(tests.ws('Gym B'), 'friend@example.test', 'member') $$,
  'they can invite members into Gym B');

select * from finish();
rollback;
