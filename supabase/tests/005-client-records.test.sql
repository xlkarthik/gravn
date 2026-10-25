begin;
select plan(11);

select tests.login('owner.a@example.test');
select is((select count(*)::int from public.client_records where workspace_id = tests.ws('Gym A')), 2,
  'owner sees every pending client record');
select tests.login('trainer.a1@example.test');
select set_eq($$ select display_name from public.client_records $$, array['Rahul Prospect'],
  'trainer sees only the records they added');
select tests.login('trainer.a2@example.test');
select is((select count(*)::int from public.client_records), 0, 'other trainers see none of them');
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.client_records), 0, 'members see none');
select tests.login('owner.b@example.test');
select is((select count(*)::int from public.client_records where workspace_id = tests.ws('Gym A')), 0,
  'another gym''s owner sees none');

-- Adding people.
select tests.login('trainer.a1@example.test');
select lives_ok($$ insert into public.client_records (workspace_id, display_name) values (tests.ws('Gym A'), 'Walk-in') $$,
  'trainer adds a pending client');
select throws_ok($$ insert into public.client_records (workspace_id, display_name) values (tests.ws('Gym B'), 'Poached') $$,
  '42501', null, 'trainer cannot add a client to another gym');
select throws_ok($$ insert into public.client_records (workspace_id, display_name, claimed_by_member_id)
  values (tests.ws('Gym A'), 'Forged', tests.member('Gym A', 'member.a1@example.test')) $$,
  '42501', null, 'nobody can mark a record as claimed');
select tests.login('member.a1@example.test');
select throws_ok($$ insert into public.client_records (workspace_id, display_name) values (tests.ws('Gym A'), 'Friend') $$,
  '42501', null, 'members cannot add clients');

-- Editing and deleting.
select tests.login('trainer.a2@example.test');
select is_empty($$ update public.client_records set display_name = 'Mine' where display_name = 'Rahul Prospect' returning 1 $$,
  'a trainer cannot edit another trainer''s record');
select tests.login('owner.a@example.test');
select isnt_empty($$ delete from public.client_records where display_name = 'Priya Pending' returning 1 $$,
  'owner deletes an unclaimed record');

select * from finish();
rollback;
