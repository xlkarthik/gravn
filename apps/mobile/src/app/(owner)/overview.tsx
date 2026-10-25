import { t } from '@gravn/shared';

import { usePeople } from '@/components/people';
import { ListItem, QueryView, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Overview() {
  const ws = useSession().workspace!;
  const people = usePeople(ws);
  return (
    <Screen
      title={ws.name}
      onRefresh={() => void people.refetch()}
      refreshing={people.isRefetching}
    >
      <QueryView query={people}>
        {(p) => (
          <>
            <ListItem title={t('overview.members')} badge={String(p.members.length)} />
            <ListItem title={t('overview.trainers')} badge={String(p.trainers.length)} />
            <ListItem title={t('overview.pending')} badge={String(p.invitations.length)} />
            <ListItem
              title={t('overview.without_plan')}
              badge={String(p.membersWithoutPlan.length)}
            />
            <ListItem title={t('overview.workouts_week')} badge={String(p.sessionsThisWeek())} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
