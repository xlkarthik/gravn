import { isStaff, pickWorkspace, type WeightUnit } from '@gravn/shared';
import { redirect } from 'next/navigation';

import { type RoutineProgramView, WorkoutStudio } from '@/components/workout-studio';
import { api, getUser, requireAccess } from '@/lib/supabase';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws: requestedWsId } = await searchParams;
  const access = await requireAccess();
  const user = await getUser();

  if (!requestedWsId) {
    const staffWs = access.workspaces.find((w) => isStaff(w));
    if (staffWs) redirect(`/w/${staffWs.id}`);
    if (access.is_platform_admin) redirect('/admin');
  }

  const ws = pickWorkspace(access, requestedWsId);
  if (!ws) redirect('/onboarding');

  const isPersonal = ws.type === 'personal';

  const client = await api();
  const [
    profile,
    assignments,
    sessions,
    exercises,
    personalPrograms,
    measurementDefs,
    measurementEntries,
    notifications,
    streaks,
  ] = await Promise.all([
    client.profile(user!.id),
    isPersonal ? Promise.resolve([]) : client.programAssignments(ws.id),
    client.sessions(ws.id, user!.id),
    client.exercises(),
    isPersonal ? client.programs(ws.id) : Promise.resolve([]),
    client.measurementDefinitions().catch(() => []),
    client.measurementEntries(user!.id).catch(() => []),
    client.notifications(user!.id).catch(() => []),
    client.streaks(ws.id, user!.id).catch(() => []),
  ]);

  const unit: WeightUnit = profile.unit_system === 'imperial' ? 'lb' : 'kg';

  const routineVersions = isPersonal
    ? await Promise.all(
        personalPrograms.map(async (p) => {
          const latest = [...(p.versions ?? [])].sort(
            (a, b) => b.version_number - a.version_number,
          )[0];
          return latest ? client.programVersion(latest.id) : null;
        }),
      )
    : [];

  const routines: RoutineProgramView[] = routineVersions.flatMap((ver) => {
    if (!ver) return [];
    const sortedDays = [...(ver.days ?? [])].sort(
      (a, b) => a.week_index - b.week_index || a.day_index - b.day_index,
    );
    if (sortedDays.length === 0) return [];
    return [
      {
        programId: ver.program_id,
        versionId: ver.id,
        name: ver.program.name,
        description: ver.program.description,
        status: ver.status,
        days: sortedDays,
      },
    ];
  });

  const activeAssignment =
    assignments.find((a) => a.client_member_id === ws.member_id && a.status === 'active') ?? null;

  return (
    <WorkoutStudio
      key={ws.id}
      workspaceId={ws.id}
      workspaceName={ws.name}
      isPersonal={isPersonal}
      userId={user!.id}
      userEmail={user!.email ?? ''}
      displayName={profile.display_name}
      unitSystem={profile.unit_system}
      unit={unit}
      exercises={exercises}
      initialSessions={sessions}
      activeAssignment={activeAssignment}
      routines={routines}
      allWorkspaces={access.workspaces}
      isPlatformAdmin={access.is_platform_admin}
      measurementDefinitions={measurementDefs}
      measurementEntries={measurementEntries}
      notifications={notifications}
      streakRecord={streaks[0] ?? null}
    />
  );
}
