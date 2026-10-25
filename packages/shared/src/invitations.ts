import type { Role, WorkspaceType } from './access';

// What get_invitation returns for a token.
export interface InvitationInfo {
  status: 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';
  workspace_name?: string;
  workspace_type?: WorkspaceType;
  role?: Role;
  expires_at?: string;
  email_hint?: string | null;
  signed_in?: boolean;
  email_matches?: boolean;
  already_member?: boolean;
}

// Every invitation case gets its own screen (plan 1.5).
export type InvitationView =
  | 'invalid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'sign_in'
  | 'wrong_account'
  | 'already_member'
  | 'ready';

export function invitationView(info: InvitationInfo): InvitationView {
  if (info.status !== 'valid') return info.status;
  if (!info.signed_in) return 'sign_in';
  if (!info.email_matches) return 'wrong_account';
  if (info.already_member) return 'already_member';
  return 'ready';
}

export function inviteUrl(webUrl: string, token: string): string {
  return `${webUrl.replace(/\/$/, '')}/invite/${token}`;
}

// Accepts a pasted invitation link or a bare token.
export function parseInviteToken(input: string): string | null {
  const text = input.trim();
  const token = text.includes('/invite/') ? text.split('/invite/')[1]!.split(/[/?#]/)[0]! : text;
  return /^[A-Za-z0-9_-]{8,128}$/.test(token) ? token : null;
}
