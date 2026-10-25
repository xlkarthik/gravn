-- platform_admins, app_config, audit_events and the admin overview.
begin;
select plan(12);

-- app_config: readable by everyone, writable by no client.
select tests.logout();
select is((select count(*)::int from public.app_config where key = 'min_supported_version'), 1,
  'signed-out apps can read config (minimum version check)');
select tests.login('owner.a@example.test');
select throws_ok($$ update public.app_config set value = '"0.0.1"' where key = 'min_supported_version' $$,
  '42501', null, 'clients cannot change config');

-- platform_admins: nobody can promote themselves.
select throws_ok($$ insert into public.platform_admins (user_id) values (tests.uid('owner.a@example.test')) $$,
  '42501', null, 'cannot make yourself a platform admin');
select is((select count(*)::int from public.platform_admins), 0, 'non-admins see no admin rows');
select tests.login('admin@example.test');
select is((select count(*)::int from public.platform_admins), 1, 'an admin sees their own admin row');
select throws_ok($$ update public.platform_admins set can_manage_billing = true $$, '42501', null,
  'admin rights cannot be edited from the app');

-- Admin overview: counts only.
select is((select members::int from public.admin_workspaces() where id = tests.ws('Gym A')), 6,
  'admin sees member counts');
select tests.login('owner.a@example.test');
select throws_ok($$ select * from public.admin_workspaces() $$, 'P0001', 'not_allowed',
  'only admins get the overview');

-- Audit log: written by RPCs, readable by the workspace owner and admins.
select public.create_invitation(tests.ws('Gym A'), 'audited@example.test', 'member');
select is((select count(*)::int from public.audit_events where action = 'invitation.created'), 1,
  'owner sees their gym''s audit trail');
select throws_ok($$ insert into public.audit_events (action) values ('forged') $$, '42501', null,
  'audit events cannot be written by clients');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.audit_events), 0, 'trainers cannot read the audit log');
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.audit_events), 0, 'members cannot read the audit log');

select * from finish();
rollback;
