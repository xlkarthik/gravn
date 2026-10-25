-- The sign-up trigger: every new account gets a profile and a private personal workspace.
begin;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'fresh@example.test', '{"display_name": "  Fresh Person  ", "timezone": "Asia/Dubai"}');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'badtz@example.test', '{"timezone": "Mars/Olympus"}');

select is((select display_name from public.profiles where user_id = tests.uid('fresh@example.test')), 'Fresh Person',
  'profile is created with the trimmed display name');
select is((select timezone from public.profiles where user_id = tests.uid('fresh@example.test')), 'Asia/Dubai',
  'the device timezone is kept');
select is((select timezone from public.profiles where user_id = tests.uid('badtz@example.test')), 'Asia/Kolkata',
  'an invalid timezone falls back to the default');
select isnt(tests.personal_ws('fresh@example.test'), null, 'a personal workspace is created');
select is((select roles::text from public.workspace_members where workspace_id = tests.personal_ws('fresh@example.test')),
  '{owner}', 'the user owns it, alone');

select * from finish();
rollback;
