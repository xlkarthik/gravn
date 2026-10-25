import type { GravnApi, RosterEntry } from './api';
import { t } from './i18n';

// Everything the owner's and trainer's screens show, in one fetch. Used by web and mobile.
export async function fetchPeople(api: GravnApi, workspaceId: string) {
  const [roster, assignments, invitations, records, programAssignments, sessions] =
    await Promise.all([
      api.roster(workspaceId),
      api.assignments(workspaceId),
      api.pendingInvitations(workspaceId),
      api.clientRecords(workspaceId),
      api.programAssignments(workspaceId),
      api.sessions(workspaceId),
    ]);
  const active = roster.filter((m) => m.status === 'active');
  const trainers = active.filter((m) => m.roles.includes('trainer'));
  const members = active.filter((m) => m.roles.includes('member'));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    members,
    trainers,
    archived: roster.filter((m) => m.status === 'archived'),
    invitations,
    records,
    programAssignments,
    sessions,
    trainersOf: (memberId: string) =>
      assignments
        .filter((a) => a.client_member_id === memberId)
        .flatMap((a) => {
          const trainer = trainers.find((tr) => tr.id === a.trainer_member_id);
          return trainer ? [{ assignmentId: a.id, trainer }] : [];
        }),
    clientsOf: (trainerId: string) =>
      assignments.filter((a) => a.trainer_member_id === trainerId).length,
    planOf: (memberId: string) => programAssignments.find((pa) => pa.client_member_id === memberId),
    membersWithoutPlan: members.filter(
      (m) => !programAssignments.some((pa) => pa.client_member_id === m.id),
    ),
    sessionsOfUser: (userId: string) =>
      sessions.filter((s) => s.user_id === userId && s.status === 'completed'),
    sessionsThisWeek: (userId?: string) =>
      sessions.filter(
        (s) =>
          s.status === 'completed' &&
          (!userId || s.user_id === userId) &&
          new Date(s.started_at).getTime() >= weekAgo,
      ).length,
  };
}

export type People = Awaited<ReturnType<typeof fetchPeople>>;

export const displayName = (m: Pick<RosterEntry, 'profile'>) =>
  m.profile?.display_name || t('people.unnamed');
