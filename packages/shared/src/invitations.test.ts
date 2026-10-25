import { describe, expect, it } from 'vitest';

import { invitationView, inviteUrl, parseInviteToken } from './invitations';

describe('invitationView', () => {
  const valid = {
    status: 'valid',
    signed_in: true,
    email_matches: true,
    already_member: false,
  } as const;

  it.each([
    [{ status: 'invalid' }, 'invalid'],
    [{ ...valid, status: 'expired' }, 'expired'],
    [{ ...valid, status: 'used' }, 'used'],
    [{ ...valid, status: 'revoked' }, 'revoked'],
    [{ ...valid, signed_in: false, email_matches: false }, 'sign_in'],
    [{ ...valid, email_matches: false }, 'wrong_account'],
    [{ ...valid, email_matches: false, already_member: true }, 'wrong_account'],
    [{ ...valid, already_member: true }, 'already_member'],
    [valid, 'ready'],
  ] as const)('%o → %s', (info, view) => {
    expect(invitationView(info)).toBe(view);
  });
});

describe('parseInviteToken', () => {
  const token = 'a'.repeat(64);

  it.each([
    [token, token],
    [`  ${token}  `, token],
    [`https://gravn.app/invite/${token}`, token],
    [`http://localhost:3000/invite/${token}?utm=x`, token],
    [`gravn-dev://invite/${token}`, token],
  ])('reads %s', (input, expected) => {
    expect(parseInviteToken(input)).toBe(expected);
  });

  it.each(['', 'short', 'https://gravn.app/invite/', 'not a token at all!'])(
    'rejects %j',
    (input) => {
      expect(parseInviteToken(input)).toBeNull();
    },
  );
});

describe('inviteUrl', () => {
  it('joins without a double slash', () => {
    expect(inviteUrl('https://gravn.app/', 'tok')).toBe('https://gravn.app/invite/tok');
  });
});
