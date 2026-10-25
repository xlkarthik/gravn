import { describe, expect, it } from 'vitest';

import {
  type Access,
  type WorkspaceAccess,
  isStaff,
  needsOnboarding,
  pickWorkspace,
  roleKey,
  shellFor,
  shellsFor,
} from './access';

describe('shellFor & shellsFor', () => {
  it.each([
    [{ type: 'gym', roles: ['owner'] }, 'owner'],
    [{ type: 'gym', roles: ['owner', 'trainer'] }, 'owner'],
    [{ type: 'gym', roles: ['trainer'] }, 'trainer'],
    [{ type: 'gym', roles: ['member'] }, 'member'],
    [{ type: 'coach', roles: ['owner'] }, 'trainer'],
    [{ type: 'coach', roles: ['owner', 'trainer'] }, 'trainer'],
    [{ type: 'coach', roles: ['member'] }, 'member'],
    [{ type: 'personal', roles: ['owner'] }, 'member'],
  ] as const)('%o → %s', (ws, shell) => {
    expect(shellFor({ type: ws.type, roles: [...ws.roles] })).toBe(shell);
  });

  it('lets a gym owner with the trainer role switch to the trainer shell', () => {
    const ws = { type: 'gym' as const, roles: ['owner', 'trainer'] as const };
    expect(shellsFor({ type: ws.type, roles: [...ws.roles] })).toEqual(['owner', 'trainer']);
    expect(shellFor({ type: ws.type, roles: [...ws.roles] }, 'trainer')).toBe('trainer');
    expect(shellFor({ type: ws.type, roles: [...ws.roles] }, 'member')).toBe('owner');
  });
});

describe('isStaff', () => {
  it('allows gym/coach owners and trainers, but not members or personal workspaces', () => {
    expect(isStaff({ type: 'gym', roles: ['owner'] })).toBe(true);
    expect(isStaff({ type: 'gym', roles: ['trainer'] })).toBe(true);
    expect(isStaff({ type: 'coach', roles: ['owner', 'trainer'] })).toBe(true);
    expect(isStaff({ type: 'gym', roles: ['member'] })).toBe(false);
    expect(isStaff({ type: 'personal', roles: ['owner'] })).toBe(false);
  });
});

describe('roleKey', () => {
  it('names coach-workspace roles as coach and client', () => {
    expect(roleKey({ type: 'coach', roles: ['owner'] })).toBe('roles.coach');
    expect(roleKey({ type: 'coach', roles: ['member'] })).toBe('roles.client');
    expect(roleKey({ type: 'gym', roles: ['trainer'] })).toBe('roles.trainer');
  });
});

const personal: WorkspaceAccess = {
  id: 'p',
  member_id: 'pm',
  type: 'personal',
  name: 'Personal',
  roles: ['owner'],
};
const gym: WorkspaceAccess = {
  id: 'g',
  member_id: 'gm',
  type: 'gym',
  name: 'Gym A',
  roles: ['member'],
};
const access = (workspaces: Access['workspaces'], onboarded = false): Access => ({
  user_id: 'u',
  display_name: 'U',
  onboarded,
  is_platform_admin: false,
  workspaces,
});

describe('pickWorkspace', () => {
  it('prefers the remembered workspace while it is still accessible', () => {
    expect(pickWorkspace(access([gym, personal]), 'p')?.id).toBe('p');
  });

  it('falls back to a gym when the remembered one is gone (access revoked)', () => {
    expect(pickWorkspace(access([personal, gym]), 'gone')?.id).toBe('g');
  });

  it('uses the personal workspace when there is nothing else', () => {
    expect(pickWorkspace(access([personal]))?.id).toBe('p');
  });
});

describe('needsOnboarding', () => {
  it('asks new people with only a personal workspace', () => {
    expect(needsOnboarding(access([personal]))).toBe(true);
  });

  it('skips people who chose or joined something', () => {
    expect(needsOnboarding(access([personal], true))).toBe(false);
    expect(needsOnboarding(access([personal, gym]))).toBe(false);
  });
});
