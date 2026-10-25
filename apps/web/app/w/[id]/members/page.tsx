import { fetchPeople, isOwner, type MeasurementEntry } from '@gravn/shared';

import { ClientsDirectoryStudio } from '@/components/clients-directory-studio';
import type { SplitVersionDetail } from '@/components/trainer-splits-studio';
import { api, requireStaffWorkspace } from '@/lib/supabase';

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { id } = await params;
  const { client: initialClientId } = await searchParams;
  const { ws } = await requireStaffWorkspace(id);
  const owner = isOwner(ws);
  const client = await api();

  const [people, programs, gymMemberships, measurementDefs, streaks] = await Promise.all([
    fetchPeople(client, id),
    client.programs(id),
    ws.type === 'gym' && owner ? client.gymMemberships(id).catch(() => []) : Promise.resolve([]),
    client.measurementDefinitions().catch(() => []),
    client.streaks(id).catch(() => []),
  ]);

  const versionDetails = await Promise.all(
    programs.map(async (p) => {
      const latest = [...(p.versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
      if (!latest) return null;
      return client.programVersion(latest.id);
    }),
  );

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
  await Promise.all(
    people.members.map(async (m) => {
      const entries = await client.measurementEntries(m.user_id, id).catch(() => []);
      measurementEntriesByUser[m.user_id] = entries;
    }),
  );

  return (
    <ClientsDirectoryStudio
      workspaceId={id}
      workspaceName={ws.name}
      isGym={ws.type === 'gym'}
      isOwner={owner}
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
      gymMemberships={gymMemberships}
      measurementDefinitions={measurementDefs}
      measurementEntriesByUser={measurementEntriesByUser}
      streaks={streaks}
    />
  );
}
