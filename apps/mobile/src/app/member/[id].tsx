import { displayName, isOwner, isStaff, summarizeSession, t } from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { usePeople } from '@/components/people';
import {
  Badge,
  Body,
  Button,
  EmptyState,
  ListItem,
  Message,
  QueryView,
  Screen,
  Section,
  Title,
} from '@/components/ui';
import { SessionDetailView } from '@/components/workout-logger';
import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText } from '@/lib/use-form';

// One person in the open workspace: trainers (owners assign them), program assignment,
// workout session review with coach comments, remove or restore.
export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ws = useSession().workspace!;
  const owner = isOwner(ws);
  const staff = isStaff(ws);
  const people = usePeople(ws);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ['ws', ws.id, 'programs'],
    queryFn: () => api.programs(ws.id),
    enabled: staff,
  });

  const assign = useMutation({
    mutationFn: (trainerId: string) => api.assignTrainer(ws.id, trainerId, id),
    onSuccess: () => void people.refetch(),
  });
  const unassign = useMutation({
    mutationFn: api.endAssignment,
    onSuccess: () => void people.refetch(),
  });
  const assignPlan = useMutation({
    mutationFn: (versionId: string) => api.assignProgram(ws.id, id, versionId),
    onSuccess: () => {
      void people.refetch();
      void queryClient.invalidateQueries({ queryKey: ['ws', ws.id] });
    },
  });
  const endPlan = useMutation({
    mutationFn: (assignmentId: string) => api.endProgramAssignment(assignmentId),
    onSuccess: () => {
      void people.refetch();
      void queryClient.invalidateQueries({ queryKey: ['ws', ws.id] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.removeMember(ws.id, id),
    onSuccess: () => router.back(),
  });
  const restore = useMutation({
    mutationFn: () => api.restoreMember(ws.id, id),
    onSuccess: () => void people.refetch(),
  });

  if (selectedSessionId && people.data) {
    const found = people.data.sessions.find((s) => s.id === selectedSessionId);
    if (found) {
      return (
        <SessionDetailView
          session={found}
          onBack={() => setSelectedSessionId(null)}
          onCommentPosted={() => void people.refetch()}
        />
      );
    }
  }

  return (
    <Screen onRefresh={() => void people.refetch()} refreshing={people.isRefetching}>
      <QueryView query={people}>
        {(p) => {
          const person = [...p.members, ...p.trainers, ...p.archived].find((m) => m.id === id);
          if (!person) return <EmptyState title={t('errors.not_found')} />;
          const name = displayName(person);
          const assigned = p.trainersOf(id);
          const available = p.trainers.filter(
            (tr) => tr.id !== id && !assigned.some((a) => a.trainer.id === tr.id),
          );
          const canAssign =
            owner &&
            ws.type === 'gym' &&
            person.status === 'active' &&
            person.roles.includes('member');

          const activePlan = p.planOf(id);
          const memberSessions = p.sessionsOfUser(person.user_id);
          const publishedPrograms = (programsQuery.data ?? []).flatMap((prog) => {
            const pub = [...(prog.versions ?? [])]
              .filter((v) => v.status === 'published')
              .sort((a, b) => b.version_number - a.version_number)[0];
            return pub ? [{ program: prog, version: pub }] : [];
          });

          return (
            <>
              <Title>{name}</Title>
              <Badge
                label={
                  person.status === 'archived' ? t('people.removed') : t(`roles.${person.roles[0]}`)
                }
              />
              {person.roles.includes('trainer') && (
                <Body muted>{t('people.clients_count', { count: p.clientsOf(id) })}</Body>
              )}

              {person.roles.includes('member') && (
                <Section title={t('programs.title')}>
                  {activePlan ? (
                    <ListItem
                      title={t('programs.assigned_plan', {
                        name: activePlan.program_version?.program?.name ?? '',
                        version: activePlan.program_version?.version_number ?? 1,
                      })}
                      subtitle={t('workout.adherence_week', {
                        count: p.sessionsThisWeek(person.user_id),
                      })}
                      right={
                        staff ? (
                          <Button
                            label={t('programs.unassign_plan')}
                            variant="secondary"
                            loading={endPlan.isPending}
                            onPress={() => endPlan.mutate(activePlan.id)}
                          />
                        ) : undefined
                      }
                    />
                  ) : (
                    <Body muted>{t('programs.no_plan')}</Body>
                  )}

                  {staff &&
                    publishedPrograms
                      .filter((item) => item.version.id !== activePlan?.program_version_id)
                      .map((item) => (
                        <ListItem
                          key={item.version.id}
                          title={item.program.name}
                          subtitle={t('programs.published', {
                            version: item.version.version_number,
                          })}
                          right={
                            <Button
                              label={t('programs.assign_cta')}
                              variant="secondary"
                              loading={assignPlan.isPending}
                              onPress={() => assignPlan.mutate(item.version.id)}
                            />
                          }
                        />
                      ))}
                </Section>
              )}

              {person.roles.includes('member') && (
                <Section title={t('workout.history_title')}>
                  {memberSessions.length === 0 ? (
                    <Body muted>{t('workout.history_empty')}</Body>
                  ) : (
                    memberSessions.map((s) => {
                      const summary = summarizeSession(s.exercises ?? []);
                      return (
                        <ListItem
                          key={s.id}
                          title={s.title}
                          subtitle={`${new Date(s.started_at).toLocaleDateString()} • ${t('workout.summary_volume', { volume: summary.totalVolumeKg })}`}
                          badge={summary.prsEarned > 0 ? `${summary.prsEarned} PR` : undefined}
                          onPress={() => setSelectedSessionId(s.id)}
                        />
                      );
                    })
                  )}
                </Section>
              )}

              {canAssign && (
                <Section title={t('people.assign')}>
                  {assigned.map((a) => (
                    <ListItem
                      key={a.assignmentId}
                      title={displayName(a.trainer)}
                      right={
                        <Button
                          label={t('people.unassign')}
                          variant="secondary"
                          onPress={() => unassign.mutate(a.assignmentId)}
                        />
                      }
                    />
                  ))}
                  {available.map((tr) => (
                    <ListItem
                      key={tr.id}
                      title={displayName(tr)}
                      right={
                        <Button
                          label={t('people.assign')}
                          variant="secondary"
                          onPress={() => assign.mutate(tr.id)}
                        />
                      }
                    />
                  ))}
                  {assigned.length + available.length === 0 && (
                    <Body muted>{t('people.no_trainers_body')}</Body>
                  )}
                </Section>
              )}

              {owner &&
                (person.status === 'active' ? (
                  <Button
                    label={t('common.remove')}
                    variant="danger"
                    loading={remove.isPending}
                    onPress={() =>
                      Alert.alert(name, t('people.remove_confirm', { name, workspace: ws.name }), [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.remove'),
                          style: 'destructive',
                          onPress: () => remove.mutate(),
                        },
                      ])
                    }
                  />
                ) : (
                  <Button
                    label={t('common.restore')}
                    variant="secondary"
                    loading={restore.isPending}
                    onPress={() => restore.mutate()}
                  />
                ))}
              <Message
                tone="error"
                text={errorText(
                  assign.error ??
                    unassign.error ??
                    assignPlan.error ??
                    endPlan.error ??
                    remove.error ??
                    restore.error,
                )}
              />
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
