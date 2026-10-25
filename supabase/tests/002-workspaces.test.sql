begin;
select plan(17);

select tests.login('member.a1@example.test');
select set_eq($$ select id from public.workspaces $$,
  array[tests.ws('Gym A'), tests.personal_ws('member.a1@example.test')],
  'member sees their gym and their personal workspace');

select tests.login('dual@example.test');
select set_eq($$ select id from public.workspaces $$,
  array[tests.ws('Gym A'), tests.ws('Gym B'), tests.personal_ws('dual@example.test')],
  'a person in two gyms sees both');

select tests.login('former.a@example.test');
select is((select count(*)::int from public.workspaces where id = tests.ws('Gym A')), 1,
  'an archived member still sees the gym they left (their history lives there)');

select tests.login('admin@example.test');
select is((select count(*)::int from public.workspaces where type = 'personal' and created_by <> tests.uid('admin@example.test')), 0,
  'platform admin cannot see anyone''s personal workspace');
select is((select count(*)::int from public.workspaces where id in (tests.ws('Gym A'), tests.ws('Gym B'), tests.ws('Coach C'))), 3,
  'platform admin sees gym and coach workspaces');

-- Updates: owners rename; nobody changes the type; trainers can't edit.
select tests.login('owner.a@example.test');
select isnt_empty($$ update public.workspaces set name = 'Gym A Kochi' where id = tests.ws('Gym A') returning 1 $$,
  'owner renames their gym');
select throws_ok($$ update public.workspaces set type = 'personal' where id = tests.ws('Gym A Kochi') $$, '42501', null,
  'nobody can change a workspace type');
select is_empty($$ update public.workspaces set name = 'Taken over' where id = tests.ws('Gym B') returning 1 $$,
  'owner cannot rename another gym');

select tests.login('trainer.a1@example.test');
select is_empty($$ update public.workspaces set name = 'Mine now' where id = tests.ws('Gym A Kochi') returning 1 $$,
  'trainer cannot rename the gym');
select throws_ok($$ insert into public.workspaces (type, name) values ('gym', 'Direct') $$, '42501', null,
  'workspaces cannot be inserted directly');

-- create_workspace makes the caller the owner (and trainer for coach workspaces).
select tests.login('solo@example.test');
select isnt(public.create_workspace('gym', 'Solo Gym'), null, 'anyone can create a gym');
select ok((select 'owner' = any (roles) from public.workspace_members where workspace_id = tests.ws('Solo Gym')),
  'the creator is its owner');
select isnt(public.create_workspace('coach', 'Solo Coach'), null, 'anyone can create a coach workspace');
select is((select roles::text from public.workspace_members where workspace_id = tests.ws('Solo Coach')),
  '{owner,trainer}', 'coach workspace creator gets owner and trainer roles');
select lives_ok($$ select public.set_owner_trainer(tests.ws('Solo Gym'), true) $$,
  'gym owner can enable the trainer role on themselves');
select is((select roles::text from public.workspace_members where workspace_id = tests.ws('Solo Gym')),
  '{owner,trainer}', 'gym owner now holds both owner and trainer roles');
select throws_ok($$ select public. create_workspace('personal', 'Second personal') $$, 'P0001', 'not_allowed',
  'a second personal workspace cannot be created');

select * from finish();
rollback;
