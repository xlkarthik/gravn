begin;
select plan(34);

create temp table t (name text primary key, token text);
grant all on t to anon, authenticated;

-- Who may invite whom.
select tests.login('owner.a@example.test');
insert into t values ('member', public.create_invitation(tests.ws('Gym A'), 'Newbie@Example.test', 'member'));
select is(char_length((select token from t where name = 'member')), 64, 'owner invites a member; a 256-bit token comes back once');
insert into t values ('trainer', public.create_invitation(tests.ws('Gym A'), 'coach.new@example.test', 'trainer'));
select pass('owner invites a trainer');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'x@example.test', 'owner') $$,
  'P0001', 'not_allowed', 'nobody can be invited as owner');
select throws_ok($$ select public.create_invitation(tests.ws('Gym B'), 'x@example.test', 'member') $$,
  'P0001', 'not_allowed', 'owner cannot invite into another gym');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'member.a2@example.test', 'member') $$,
  'P0001', 'already_member', 'inviting a current member is refused');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'not-an-email', 'member') $$,
  'P0001', 'invalid_email', 'invalid email is refused');

select tests.login('trainer.a1@example.test');
insert into t values ('by_trainer', public.create_invitation(tests.ws('Gym A'), 'client.new@example.test', 'member'));
select pass('trainer invites a member');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'x@example.test', 'trainer') $$,
  'P0001', 'not_allowed', 'trainer cannot invite a trainer');

select tests.login('member.a1@example.test');
select throws_ok($$ select public.create_invitation(tests.ws('Gym A'), 'x@example.test', 'member') $$,
  'P0001', 'not_allowed', 'member cannot invite');
select throws_ok($$ insert into public.invitations (workspace_id, email, role, token_hash, expires_at)
  values (tests.ws('Gym A'), 'x@example.test', 'member', '\x00', now() + interval '1 day') $$,
  '42501', null, 'invitations cannot be inserted directly');

select tests.login('coach@example.test');
select throws_ok($$ select public.create_invitation(tests.ws('Coach C'), 'x@example.test', 'trainer') $$,
  'P0001', 'not_allowed', 'coach workspaces have no trainers to invite');

-- Who sees invitations.
select tests.login('member.a1@example.test');
select is((select count(*)::int from public.invitations), 0, 'members see no invitations');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.invitations), 1, 'trainer sees only invitations they sent');
select tests.login('owner.b@example.test');
select is((select count(*)::int from public.invitations where workspace_id = tests.ws('Gym A')), 0,
  'another gym''s owner sees none of them');

-- Reading an invitation before signing in.
select tests.logout();
select is(public.get_invitation((select token from t where name = 'member')) ->> 'status', 'valid',
  'anyone holding the link can see the invitation');
select is(public.get_invitation((select token from t where name = 'member')) ->> 'email_hint', 'n•••••@example.test',
  'the address is masked');
select is(public.get_invitation('not-a-real-token') ->> 'status', 'invalid', 'unknown tokens are invalid');

-- Accepting.
select tests.create_user('newbie@example.test');
select tests.login('newbie@example.test');
select is((public.get_invitation((select token from t where name = 'member')) ->> 'email_matches')::boolean, true,
  'the right account matches');
select is(public.accept_invitation((select token from t where name = 'member')), tests.ws('Gym A'), 'invitee accepts');
select is((select roles::text from public.workspace_members where workspace_id = tests.ws('Gym A')
  and user_id = tests.uid('newbie@example.test')), '{member}', 'they joined with the invited role');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'member')),
  'P0001', 'invitation_used', 'an invitation works once');

-- Wrong account, unverified email, expired, revoked, already a member.
select tests.login('member.b1@example.test');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'trainer')),
  'P0001', 'invitation_wrong_account', 'an invitation for another email is refused');

select tests.create_user('coach.new@example.test', false);
select tests.login('coach.new@example.test');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'trainer')),
  'P0001', 'invitation_wrong_account', 'an unverified email cannot accept');

reset role;
update public.invitations set expires_at = now() - interval '1 minute'
where token_hash = extensions.digest((select token from t where name = 'trainer'), 'sha256');
update auth.users set email_confirmed_at = now() where email = 'coach.new@example.test';
select tests.login('coach.new@example.test');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'trainer')),
  'P0001', 'invitation_expired', 'an expired invitation is refused');

select tests.login('owner.a@example.test');
insert into t values ('revoked', public.create_invitation(tests.ws('Gym A'), 'coach.new@example.test', 'trainer'));
select lives_ok(format('select public.revoke_invitation(id) from public.invitations where token_hash = extensions.digest(%L, %L)',
  (select token from t where name = 'revoked'), 'sha256'), 'owner revokes an invitation');
select tests.login('coach.new@example.test');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'revoked')),
  'P0001', 'invitation_revoked', 'a revoked invitation is refused');

select tests.login('owner.a@example.test');
insert into t values ('dup', public.create_invitation(tests.ws('Gym A'), 'solo@example.test', 'member'));
reset role;
insert into public.workspace_members (workspace_id, user_id, roles)
values (tests.ws('Gym A'), tests.uid('solo@example.test'), '{member}');
select tests.login('solo@example.test');
select throws_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'dup')),
  'P0001', 'already_member', 'joining a workspace you already belong to is refused');

-- A trainer's invitee becomes their client.
select tests.create_user('client.new@example.test');
select tests.login('client.new@example.test');
select lives_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'by_trainer')),
  'trainer''s invitee accepts');
select tests.login('trainer.a1@example.test');
select is((select count(*)::int from public.workspace_members where user_id = tests.uid('client.new@example.test')), 1,
  'the inviting trainer is assigned to the new client');

-- Re-inviting replaces the previous link.
select tests.login('owner.a@example.test');
insert into t values ('first', public.create_invitation(tests.ws('Gym A'), 'twice@example.test', 'member'));
insert into t values ('second', public.create_invitation(tests.ws('Gym A'), 'twice@example.test', 'member'));
select is(public.get_invitation((select token from t where name = 'first')) ->> 'status', 'revoked',
  'the older link stops working');

-- Open single-use link for a client record without an email (WhatsApp flow, D-57).
select tests.login('trainer.a1@example.test');
insert into t values ('open_record', public.create_invitation(
  tests.ws('Gym A'), null, 'member', (select id from public.client_records where display_name = 'Rahul Prospect')
));
select is(public.get_invitation((select token from t where name = 'open_record')) ->> 'email_hint', null,
  'an open client-record invitation has no masked email');
select tests.create_user('whatsapp.user@example.test');
reset role;
update public.profiles set display_name = '' where user_id = tests.uid('whatsapp.user@example.test');
select tests.login('whatsapp.user@example.test');
select is((public.get_invitation((select token from t where name = 'open_record')) ->> 'email_matches')::boolean, true,
  'any signed-in user matches an open client-record invitation');
select lives_ok(format('select public.accept_invitation(%L)', (select token from t where name = 'open_record')),
  'any verified account can claim an open client-record invitation once');
select is((select display_name from public.profiles where user_id = tests.uid('whatsapp.user@example.test')),
  'Rahul Prospect', 'claiming a client record populates an empty profile display name');

select * from finish();
rollback;
