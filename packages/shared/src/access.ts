// Roles, workspaces and what each person's app shows. The database decides access;
// these helpers only choose navigation and wording from what get_my_access returns.

export type WorkspaceType = 'gym' | 'coach' | 'personal';
export type Role = 'owner' | 'trainer' | 'member';
export type Shell = 'owner' | 'trainer' | 'member';

export interface WorkspaceAccess {
  id: string;
  member_id: string;
  type: WorkspaceType;
  name: string;
  roles: Role[];
}

export interface Access {
  user_id: string;
  display_name: string;
  onboarded: boolean;
  is_platform_admin: boolean;
  workspaces: WorkspaceAccess[];
}

// Coaches act as trainers for their own clients; personal users train themselves.
// A gym owner who also holds the trainer role can switch between Owner and Trainer shells (D-56).
export function shellsFor(ws: Pick<WorkspaceAccess, 'type' | 'roles'>): Shell[] {
  if (ws.type === 'personal') return ['member'];
  if (ws.type === 'coach') return ws.roles.includes('owner') ? ['trainer'] : ['member'];
  const shells: Shell[] = [];
  if (ws.roles.includes('owner')) shells.push('owner');
  if (ws.roles.includes('trainer')) shells.push('trainer');
  if (ws.roles.includes('member') || shells.length === 0) shells.push('member');
  return shells;
}

export function shellFor(
  ws: Pick<WorkspaceAccess, 'type' | 'roles'>,
  preferred?: Shell | null,
): Shell {
  const allowed = shellsFor(ws);
  return preferred && allowed.includes(preferred) ? preferred : allowed[0]!;
}

// i18n key for the role shown next to a workspace name.
export function roleKey(ws: Pick<WorkspaceAccess, 'type' | 'roles'>): string {
  if (ws.type === 'personal') return 'roles.personal';
  if (ws.type === 'coach') return ws.roles.includes('owner') ? 'roles.coach' : 'roles.client';
  return `roles.${ws.roles[0] ?? 'member'}`;
}

// The workspace to open: the remembered one if still accessible, else the first gym or
// coach workspace, else the personal one.
export function pickWorkspace(
  access: Access,
  rememberedId?: string | null,
): WorkspaceAccess | undefined {
  return (
    access.workspaces.find((w) => w.id === rememberedId) ??
    access.workspaces.find((w) => w.type !== 'personal') ??
    access.workspaces[0]
  );
}

export function needsOnboarding(access: Access): boolean {
  return !access.onboarded && access.workspaces.every((w) => w.type === 'personal');
}

export function isOwner(ws: Pick<WorkspaceAccess, 'roles'>): boolean {
  return ws.roles.includes('owner');
}

export function isStaff(ws: Pick<WorkspaceAccess, 'type' | 'roles'>): boolean {
  return ws.type !== 'personal' && (ws.roles.includes('owner') || ws.roles.includes('trainer'));
}
