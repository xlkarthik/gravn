begin;
select plan(14);

-- A member sees themself and their gym's staff, never other members.
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 1,
  'member reads own profile');
select is((select count(*)::int from public.profiles
  where user_id in (tests.uid('owner.a@example.test'), tests.uid('trainer.a1@example.test'), tests.uid('trainer.a2@example.test'))), 3,
  'member reads the profiles of their gym''s staff');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a2@example.test')), 0,
  'member cannot read another member''s profile');

-- A trainer sees assigned clients only.
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a1@example.test')), 1,
  'trainer reads an assigned client');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.a4@example.test')), 0,
  'trainer cannot read an unassigned member');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.b1@example.test')), 0,
  'trainer cannot read another gym''s member');

-- An owner sees the whole roster, including archived members, and nothing from other gyms.
select tests.login('owner.a@example.test');
select is((select count(*)::int from public.profiles where user_id = tests.uid('former.a@example.test')), 1,
  'owner reads an archived member of their gym');
select is((select count(*)::int from public.profiles where user_id = tests.uid('member.b1@example.test')), 0,
  'owner cannot read another gym''s member');

-- People outside any gym, and admins, see only themselves.
select tests.login('solo@example.test');
select is((select count(*)::int from public.profiles), 1, 'consumer sees only their own profile');
select tests.login('admin@example.test');
select is((select count(*)::int from public.profiles), 1, 'platform admin gets no roster access');

-- Writes: own profile only, and never insert or delete.
select tests.login('member.a1@example.test');
select lives_ok($$ update public.profiles set display_name = 'Ananya D' where user_id = tests.uid('member.a1@example.test') $$,
  'member edits own profile');
select is_empty($$ update public.profiles set display_name = 'hacked' where user_id = tests.uid('member.a2@example.test') returning 1 $$,
  'member cannot edit another user''s profile');
select throws_ok($$ insert into public.profiles (user_id) values (gen_random_uuid()) $$, '42501', null,
  'profiles cannot be inserted directly');
select throws_ok($$ delete from public.profiles where user_id = tests.uid('member.a1@example.test') $$, '42501', null,
  'profiles cannot be deleted directly');

select * from finish();
rollback;
