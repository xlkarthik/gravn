begin;
select plan(12);

-- Roster visibility by role.
select tests.login('trainer.a1@example.test');
select set_eq(
  $$ select user_id from public.workspace_members where workspace_id = tests.ws('Gym A') and 'member' = any (roles) $$,
  array[tests.uid('member.a1@example.test'), tests.uid('member.a2@example.test'), tests.uid('member.a3@example.test')],
  'trainer sees exactly their assigned clients');
select is((select count(*)::int from public.workspace_members where user_id = tests.uid('former.a@example.test')), 0,
  'trainer loses sight of a client who left');

select tests.login('member.a1@example.test');
select is((select count(*)::int from public.workspace_members
  where workspace_id = tests.ws('Gym A') and 'member' = any (roles) and user_id <> tests.uid('member.a1@example.test')), 0,
  'member sees no other members');
select is((select count(*)::int from public.workspace_members
  where workspace_id = tests.ws('Gym A') and roles && '{owner,trainer}'), 3,
  'member sees their gym''s staff');

select tests.login('owner.a@example.test');
select is((select count(*)::int from public.workspace_members where workspace_id = tests.ws('Gym A')), 10,
  'owner sees the whole roster, archived included');

-- Cross-tenant: Gym A people asking for Gym B rows by ID get nothing.
select is((select count(*)::int from public.workspace_members where workspace_id = tests.ws('Gym B')), 0,
  'Gym A owner reads no Gym B rows');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.workspace_members where workspace_id = tests.ws('Gym B')), 0,
  'Gym A trainer reads no Gym B rows');

-- Role spoofing and self-promotion.
select tests.login('member.a1@example.test');
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, roles)
     values (tests.ws('Gym B'), tests.uid('member.a1@example.test'), '{owner}') $$,
  '42501', null, 'cannot insert your own membership with the owner role');
select throws_ok(
  $$ update public.workspace_members set roles = '{owner}' where user_id = tests.uid('member.a1@example.test') $$,
  '42501', null, 'cannot change your own role');
select throws_ok(
  $$ update public.workspace_members set status = 'active' where user_id = tests.uid('member.a1@example.test') $$,
  '42501', null, 'cannot change membership status directly');
select throws_ok(
  $$ delete from public.workspace_members where user_id = tests.uid('member.a2@example.test') $$,
  '42501', null, 'cannot delete memberships directly');

-- Personal workspaces stay private.
select tests.login('owner.a@example.test');
select is((select count(*)::int from public.workspace_members where workspace_id = tests.personal_ws('member.a1@example.test')), 0,
  'a gym owner cannot see a member''s personal workspace');

select * from finish();
rollback;
