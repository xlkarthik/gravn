import { describe, expect, it } from 'vitest';

import { clientRecordSchema, inviteSchema, parseForm, signUpSchema } from './schemas';

describe('signUpSchema', () => {
  const valid = { displayName: ' Ananya ', email: ' Ananya@Example.TEST ', password: 'lift2026' };

  it('trims names and normalises email', () => {
    expect(parseForm(signUpSchema, valid)).toEqual({
      ok: true,
      data: { displayName: 'Ananya', email: 'ananya@example.test', password: 'lift2026' },
    });
  });

  it.each([
    ['short password', { password: 'ab12' }, 'password', 'validation.password_short'],
    ['letters only', { password: 'abcdefgh' }, 'password', 'validation.password_letters_digits'],
    ['digits only', { password: '12345678' }, 'password', 'validation.password_letters_digits'],
    ['bad email', { email: 'ananya@' }, 'email', 'validation.email'],
    ['blank name', { displayName: '   ' }, 'displayName', 'validation.required'],
  ])('rejects %s', (_, change, field, key) => {
    const result = parseForm(signUpSchema, { ...valid, ...change });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[field]).toBe(key);
  });
});

describe('inviteSchema', () => {
  it('refuses the owner role', () => {
    expect(parseForm(inviteSchema, { email: 'a@example.test', role: 'owner' }).ok).toBe(false);
  });

  it('requires an email when no clientRecordId is given', () => {
    const res = parseForm(inviteSchema, { email: '', role: 'member' });
    expect(!res.ok && res.errors.email).toBe('validation.email');
  });

  it('allows an empty email when inviting a clientRecordId', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(parseForm(inviteSchema, { email: '', role: 'member', clientRecordId: id })).toEqual({
      ok: true,
      data: { email: undefined, role: 'member', clientRecordId: id },
    });
  });
});

describe('clientRecordSchema', () => {
  it('turns blank optional fields into undefined', () => {
    expect(parseForm(clientRecordSchema, { displayName: 'Priya', email: ' ', phone: '' })).toEqual({
      ok: true,
      data: { displayName: 'Priya', email: undefined, phone: undefined },
    });
  });

  it('still validates an email when given', () => {
    const result = parseForm(clientRecordSchema, {
      displayName: 'Priya',
      email: 'nope',
      phone: '',
    });
    expect(!result.ok && result.errors.email).toBe('validation.email');
  });
});
