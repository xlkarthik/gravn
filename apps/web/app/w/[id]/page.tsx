import { fetchPeople, isOwner, type MeasurementEntry } from '@gravn/shared';

import { StaffStudio } from '@/components/staff-studio';
import type { SplitVersionDetail } from '@/components/trainer-splits-studio';
import { api, getUser, requireStaffWorkspace } from '@/lib/supabase';

export default async function WorkspaceStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; client?: string }>;
}) {
  const { id } = await params;
  const { tab, client: initialClientId } = await searchParams;
  const { access, ws } = await requireStaffWorkspace(id);
  const owner = isOwner(ws);
  const client = await api();

  // Single parallel batch — no sequential N+1 waterfalls!
  const [
    people,
    programs,
    exercises,
    gymMemberships,
    measurementDefs,
    allMeasurementEntries,
    streaks,
    user,
  ] = await Promise.all([
    fetchPeople(client, id),
    client.programs(id),
    client.exercises(),
    ws.type === 'gym' && owner ? client.gymMemberships(id).catch(() => []) : Promise.resolve([]),
    client.measurementDefinitions().catch(() => []),
    client.workspaceMeasurementEntries(id).catch(() => []),
    client.streaks(id).catch(() => []),
    getUser(),
  ]);

  const [versionDetails, highFives] = await Promise.all([
    Promise.all(
      programs.map(async (p) => {
        const latest = [...(p.versions ?? [])].sort(
          (a, b) => b.version_number - a.version_number,
        )[0];
        if (!latest) return null;
        return client.programVersion(latest.id);
      }),
    ),
    client.highFivesForSessions(people.sessions.map((s) => s.id)).catch(() => []),
  ]);

  const versions: SplitVersionDetail[] = versionDetails.filter(
    (v): v is NonNullable<typeof v> => v !== null,
  );

  const trainerLinksByMember: Record<
    string,
    { assignmentId: string; trainer: (typeof people.trainers)[number] }[]
  > = {};
  for (const m of people.members) {
    trainerLinksByMember[m.id] = people.trainersOf(m.id);
  }

  const measurementEntriesByUser: Record<string, MeasurementEntry[]> = {};
  for (const entry of allMeasurementEntries) {
    (measurementEntriesByUser[entry.subject_user_id] ??= []).push(entry);
  }

  const validTabs = ['overview', 'members', 'programs', 'activity', 'more'] as const;
  const initialTab = validTabs.includes(tab as (typeof validTabs)[number])
    ? (tab as (typeof validTabs)[number])
    : 'overview';

  return (
    <StaffStudio
      workspace={ws}
      otherWorkspaces={access.workspaces.filter((w) => w.id !== ws.id)}
      isOwner={owner}
      isPlatformAdmin={access.is_platform_admin}
      currentUserId={user?.id ?? ''}
      initialTab={initialTab}
      initialClientId={initialClientId}
      members={people.members}
      trainers={people.trainers}
      trainerLinksByMember={trainerLinksByMember}
      invitations={people.invitations}
      records={people.records}
      archived={people.archived}
      assignments={people.programAssignments}
      sessions={people.sessions}
      versions={versions}
      exercises={exercises}
      gymMemberships={gymMemberships}
      measurementDefinitions={measurementDefs}
      measurementEntriesByUser={measurementEntriesByUser}
      streaks={streaks}
      highFives={highFives}
    />
  );
}
