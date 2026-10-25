import { fetchPeople } from '@gravn/shared';

import { ActivityFeedStudio } from '@/components/activity-feed-studio';
import { api, getUser, requireStaffWorkspace } from '@/lib/supabase';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffWorkspace(id);
  const client = await api();
  const [people, user] = await Promise.all([fetchPeople(client, id), getUser()]);
  const sessionIds = people.sessions.map((s) => s.id);
  const highFives = await client.highFivesForSessions(sessionIds).catch(() => []);

  return (
    <ActivityFeedStudio
      workspaceId={id}
      currentUserId={user?.id ?? ''}
      clients={people.members}
      sessions={people.sessions}
      highFives={highFives}
    />
  );
}
