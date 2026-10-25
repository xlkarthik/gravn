import { fetchPeople } from '@gravn/shared';

import { type SplitVersionDetail, TrainerSplitsStudio } from '@/components/trainer-splits-studio';
import { api, requireStaffWorkspace } from '@/lib/supabase';

export default async function ProgramsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffWorkspace(id);
  const client = await api();
  const [programs, exercises, people] = await Promise.all([
    client.programs(id),
    client.exercises(),
    fetchPeople(client, id),
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

  return (
    <TrainerSplitsStudio
      workspaceId={id}
      versions={versions}
      exercises={exercises}
      clients={people.members}
      assignments={people.programAssignments}
      sessions={people.sessions}
    />
  );
}
