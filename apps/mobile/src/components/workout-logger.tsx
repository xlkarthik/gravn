import {
  colors,
  commentSchema,
  defaultWeightStep,
  detectSetPr,
  type Exercise,
  fontSize,
  formatTimer,
  pickNextProgramDay,
  type ProgramAssignment,
  type ProgramDay,
  radius,
  remainingTimerSeconds,
  type SessionExerciseRecord,
  type SessionSummary,
  type SetRecord,
  type SetType,
  space,
  summarizeSession,
  type SyncOpInput,
  t,
  type WeightUnit,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';

import {
  cacheActivePlan,
  flushOutbox,
  getActiveLocalSession,
  getCachedActivePlan,
  getLocalSessions,
  getOutboxStatus,
  getPersistedTimer,
  type OutboxStatus,
  saveLocalSession,
  setPersistedTimer,
  subscribeSyncState,
} from '@/lib/offline';
import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

import { ProgramsScreen } from './programs';
import {
  Badge,
  Body,
  Button,
  Choice,
  EmptyState,
  ListItem,
  Message,
  NumberStepper,
  Screen,
  Section,
  TextField,
} from './ui';

function mergeSessions(
  remote: WorkoutSessionRecord[] | undefined,
  local: WorkoutSessionRecord[],
): WorkoutSessionRecord[] {
  const byId = new Map<string, WorkoutSessionRecord>();
  for (const s of remote ?? []) byId.set(s.id, s);
  for (const s of local) {
    const existing = byId.get(s.id);
    if (!existing || s.revision >= existing.revision) {
      byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => b.started_at.localeCompare(a.started_at));
}

function sessionUpsertOp(session: WorkoutSessionRecord): Omit<SyncOpInput, 'op_id'> {
  return {
    type: 'upsert_session',
    base_revision: Math.max(1, session.revision - 1),
    payload: {
      id: session.id,
      workspace_id: session.workspace_id,
      assignment_id: session.assignment_id,
      program_version_id: session.program_version_id,
      program_day_id: session.program_day_id,
      title: session.title,
      planned_snapshot: session.planned_snapshot,
      status: session.status,
      started_at: session.started_at,
      finished_at: session.finished_at,
      duration_seconds: session.duration_seconds,
      notes: session.notes,
    },
  };
}

function exerciseUpsertOp(ex: SessionExerciseRecord): Omit<SyncOpInput, 'op_id'> {
  return {
    type: 'upsert_exercise',
    payload: {
      id: ex.id,
      session_id: ex.session_id,
      exercise_id: ex.exercise_id,
      position: ex.position,
      superset_group: ex.superset_group,
      tracking_type: ex.tracking_type,
      rest_seconds: ex.rest_seconds,
      skipped: ex.skipped,
      skip_reason: ex.skip_reason,
      notes: ex.notes,
    },
  };
}

function setUpsertOp(
  sessionId: string,
  exerciseId: string,
  set: SetRecord,
): Omit<SyncOpInput, 'op_id'> {
  return {
    type: 'upsert_set',
    base_revision: 1,
    payload: {
      id: set.id,
      session_id: sessionId,
      session_exercise_id: exerciseId,
      set_index: set.set_index,
      set_type: set.set_type,
      planned_reps_min: set.planned_reps_min ?? null,
      planned_reps_max: set.planned_reps_max ?? null,
      planned_weight_value: set.planned_weight_value ?? null,
      planned_weight_unit: set.planned_weight_unit ?? null,
      planned_duration_s: set.planned_duration_s ?? null,
      actual_reps: set.actual_reps,
      actual_weight_value: set.actual_weight_value,
      actual_weight_unit: set.actual_weight_unit,
      actual_duration_s: set.actual_duration_s,
      rpe: set.rpe ?? null,
      note: set.note ?? '',
      state: set.state,
      is_pr: Boolean(set.is_pr),
      completed_at: set.completed_at ?? null,
    },
  };
}

function SyncStatusBar({ userId }: { userId: string }) {
  const [status, setStatus] = useState<OutboxStatus>({
    pendingCount: 0,
    errorCount: 0,
    syncing: false,
  });

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void getOutboxStatus(userId).then((s) => {
        if (mounted) setStatus(s);
      });
    };
    refresh();
    return subscribeSyncState(refresh);
  }, [userId]);

  if (status.pendingCount === 0) return null;

  return (
    <View style={styles.syncBar}>
      <Body muted>
        {status.errorCount > 0
          ? `${t('workout.sync_error')} • ${t('workout.sync_pending', { count: status.pendingCount })}`
          : t('workout.sync_pending', { count: status.pendingCount })}
      </Body>
      <Button
        label={t('workout.sync_retry')}
        variant="secondary"
        loading={status.syncing}
        onPress={() => void flushOutbox(userId)}
      />
    </View>
  );
}

export function TodayScreen() {
  const { session, workspace } = useSession();
  const userId = session!.user.id;
  const ws = workspace!;

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.profile(userId),
  });
  const unit: WeightUnit = profileQuery.data?.unit_system === 'imperial' ? 'lb' : 'kg';

  const [localSessions, setLocalSessions] = useState<WorkoutSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSessionRecord | null>(null);
  const [cachedPlan, setCachedPlan] = useState<ProgramAssignment | null>(null);
  const [celebration, setCelebration] = useState<{
    summary: SessionSummary;
    nextDayTitle?: string;
  } | null>(null);
  const [buildingOwnRoutine, setBuildingOwnRoutine] = useState(false);

  const assignmentsQuery = useQuery({
    queryKey: ['ws', ws.id, 'programAssignments'],
    queryFn: () => api.programAssignments(ws.id),
  });

  const sessionsQuery = useQuery({
    queryKey: ['ws', ws.id, 'sessions', userId],
    queryFn: () => api.sessions(ws.id, userId),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.exercises(),
  });

  const reloadLocal = useCallback(() => {
    void Promise.all([
      getLocalSessions(userId, ws.id),
      getActiveLocalSession(userId, ws.id),
      getCachedActivePlan(userId, ws.id),
    ]).then(([locals, active, cached]) => {
      setLocalSessions(locals);
      setActiveSession(active);
      setCachedPlan(cached);
    });
  }, [userId, ws.id]);

  useEffect(() => {
    reloadLocal();
    return subscribeSyncState(reloadLocal);
  }, [reloadLocal]);

  const activeAssignment = useMemo(() => {
    const fromServer = (assignmentsQuery.data ?? []).find(
      (a) => a.client_member_id === ws.member_id && a.status === 'active',
    );
    return fromServer ?? cachedPlan;
  }, [assignmentsQuery.data, cachedPlan, ws.member_id]);

  useEffect(() => {
    if (assignmentsQuery.isSuccess) {
      const mine =
        assignmentsQuery.data.find(
          (a) => a.client_member_id === ws.member_id && a.status === 'active',
        ) ?? null;
      void cacheActivePlan(userId, ws.id, mine);
    }
  }, [assignmentsQuery.isSuccess, assignmentsQuery.data, userId, ws.id, ws.member_id]);

  const allSessions = useMemo(
    () => mergeSessions(sessionsQuery.data, localSessions),
    [sessionsQuery.data, localSessions],
  );

  const completedSessions = useMemo(
    () => allSessions.filter((s) => s.status === 'completed'),
    [allSessions],
  );

  const days = useMemo(
    () =>
      [...(activeAssignment?.program_version?.days ?? [])].sort(
        (a, b) => a.week_index - b.week_index || a.day_index - b.day_index,
      ),
    [activeAssignment],
  );

  const lastCompletedDayId = useMemo(() => {
    const withDay = completedSessions.find((s) => Boolean(s.program_day_id));
    return withDay?.program_day_id ?? null;
  }, [completedSessions]);

  const nextDay = useMemo(
    () => pickNextProgramDay(days, lastCompletedDayId),
    [days, lastCompletedDayId],
  );

  if (buildingOwnRoutine) {
    return (
      <View style={styles.flex}>
        <View style={styles.routineBar}>
          <Button
            label={t('common.back')}
            variant="secondary"
            onPress={() => {
              setBuildingOwnRoutine(false);
              void assignmentsQuery.refetch();
            }}
          />
        </View>
        <ProgramsScreen />
      </View>
    );
  }

  const startSession = async (plannedDay?: ProgramDay) => {
    setCelebration(null);
    const sessionId = randomUUID();
    const nowIso = new Date().toISOString();
    const items = [...(plannedDay?.items ?? [])].sort((a, b) => a.position - b.position);

    const sessionExercises: SessionExerciseRecord[] = items.map((item, idx) => {
      const exId = randomUUID();
      const tracking = item.exercise?.tracking_type ?? 'weight_reps';
      const sets: SetRecord[] = Array.from({ length: Math.max(1, item.sets_count) }, (_, sIdx) => ({
        id: randomUUID(),
        set_index: sIdx + 1,
        set_type: item.set_type ?? 'working',
        planned_reps_min: item.target_reps_min,
        planned_reps_max: item.target_reps_max,
        planned_weight_value: item.target_weight_value,
        planned_weight_unit: item.target_weight_unit ?? unit,
        planned_duration_s: item.target_duration_s,
        actual_reps:
          item.target_reps_max ?? item.target_reps_min ?? (tracking === 'time' ? null : 8),
        actual_weight_value: item.target_weight_value ?? (tracking === 'weight_reps' ? 20 : null),
        actual_weight_unit: item.target_weight_unit ?? unit,
        actual_duration_s: item.target_duration_s ?? (tracking === 'time' ? 45 : null),
        state: 'not_recorded',
        is_pr: false,
      }));
      return {
        id: exId,
        session_id: sessionId,
        exercise_id: item.exercise_id,
        position: idx + 1,
        superset_group: item.superset_group,
        tracking_type: tracking,
        rest_seconds: item.rest_seconds ?? item.exercise?.default_rest_seconds ?? 90,
        skipped: false,
        skip_reason: null,
        notes: item.notes ?? '',
        exercise: item.exercise,
        sets,
      };
    });

    const newSession: WorkoutSessionRecord = {
      id: sessionId,
      user_id: userId,
      workspace_id: ws.id,
      assignment_id: plannedDay ? (activeAssignment?.id ?? null) : null,
      program_version_id: plannedDay ? (activeAssignment?.program_version_id ?? null) : null,
      program_day_id: plannedDay?.id ?? null,
      title: plannedDay?.title ?? t('workout.today_title'),
      planned_snapshot: plannedDay ? { day_id: plannedDay.id, title: plannedDay.title } : {},
      status: 'in_progress',
      started_at: nowIso,
      finished_at: null,
      duration_seconds: null,
      notes: '',
      revision: 1,
      exercises: sessionExercises,
    };

    const ops: Omit<SyncOpInput, 'op_id'>[] = [sessionUpsertOp(newSession)];
    for (const ex of sessionExercises) {
      ops.push(exerciseUpsertOp(ex));
      for (const s of ex.sets) {
        ops.push(setUpsertOp(sessionId, ex.id, s));
      }
    }

    await saveLocalSession(userId, newSession, ops);
    setActiveSession(newSession);
  };

  if (activeSession) {
    return (
      <ActiveWorkoutLogger
        userId={userId}
        unit={unit}
        session={activeSession}
        historySessions={completedSessions}
        catalog={exercisesQuery.data ?? []}
        onUpdateSession={(next) => setActiveSession(next)}
        onFinish={async (finished) => {
          const prevSameDay = completedSessions.find(
            (s) => s.id !== finished.id && s.program_day_id === finished.program_day_id,
          );
          const prevSummary = prevSameDay
            ? summarizeSession(prevSameDay.exercises ?? [])
            : undefined;
          const summary = summarizeSession(
            finished.exercises ?? [],
            prevSummary?.totalVolumeKg ?? null,
          );
          const upcoming = pickNextProgramDay(days, finished.program_day_id);
          await setPersistedTimer(userId, finished.id, null);
          setActiveSession(null);
          setCelebration({ summary, nextDayTitle: upcoming?.title });
          void reloadLocal();
          void sessionsQuery.refetch();
        }}
        onAbandon={async () => {
          await setPersistedTimer(userId, activeSession.id, null);
          setActiveSession(null);
          void reloadLocal();
        }}
      />
    );
  }

  return (
    <Screen
      title={t('workout.today_title')}
      onRefresh={() => {
        void assignmentsQuery.refetch();
        void sessionsQuery.refetch();
        void reloadLocal();
      }}
      refreshing={assignmentsQuery.isRefetching || sessionsQuery.isRefetching}
    >
      <SyncStatusBar userId={userId} />

      {celebration && (
        <Section title={t('workout.summary_title')}>
          <View style={styles.card}>
            <Body>
              {t('workout.summary_sets', {
                completed: celebration.summary.completedSets,
                skipped: celebration.summary.skippedSets,
              })}
            </Body>
            <Body>
              {t('workout.summary_volume', { volume: celebration.summary.totalVolumeKg })}
            </Body>
            {celebration.summary.volumeDeltaKg !== null && (
              <Body muted>
                {celebration.summary.volumeDeltaKg >= 0
                  ? t('workout.summary_delta_up', { delta: celebration.summary.volumeDeltaKg })
                  : t('workout.summary_delta_down', { delta: celebration.summary.volumeDeltaKg })}
              </Body>
            )}
            <Body>{t('workout.summary_prs', { count: celebration.summary.prsEarned })}</Body>
            {celebration.nextDayTitle && (
              <Body muted>{t('workout.summary_next', { title: celebration.nextDayTitle })}</Body>
            )}
          </View>
        </Section>
      )}

      {ws.type === 'personal' ? (
        <>
          <Section title={t('workout.quick_start')}>
            <Button label={t('workout.start_empty')} onPress={() => void startSession(undefined)} />
          </Section>
          {nextDay && (
            <Section
              title={
                activeAssignment?.program_version?.program?.name
                  ? `${activeAssignment.program_version.program.name} • ${nextDay.title}`
                  : nextDay.title
              }
            >
              {(nextDay.items ?? []).map((item) => (
                <ListItem
                  key={item.id}
                  title={item.exercise?.name ?? ''}
                  subtitle={`${item.sets_count} × ${item.target_reps_min ?? 8}–${item.target_reps_max ?? 10}`}
                  badge={item.superset_group ? `Superset ${item.superset_group}` : undefined}
                />
              ))}
              <Button
                label={t('workout.start_planned', { title: nextDay.title })}
                onPress={() => void startSession(nextDay)}
              />
            </Section>
          )}
          <Section title={t('workout.my_routines')}>
            <Button
              label={t('workout.build_own_routine')}
              variant="secondary"
              onPress={() => setBuildingOwnRoutine(true)}
            />
          </Section>
        </>
      ) : (
        <>
          {nextDay ? (
            <Section
              title={
                activeAssignment?.program_version?.program?.name
                  ? `${activeAssignment.program_version.program.name} • ${nextDay.title}`
                  : nextDay.title
              }
            >
              {(nextDay.items ?? []).map((item) => (
                <ListItem
                  key={item.id}
                  title={item.exercise?.name ?? ''}
                  subtitle={`${item.sets_count} × ${item.target_reps_min ?? 8}–${item.target_reps_max ?? 10}`}
                  badge={item.superset_group ? `Superset ${item.superset_group}` : undefined}
                />
              ))}
              <Button
                label={t('workout.start_planned', { title: nextDay.title })}
                onPress={() => void startSession(nextDay)}
              />
            </Section>
          ) : (
            <EmptyState title={t('workout.no_plan_title')} body={t('workout.no_plan_body')} />
          )}

          <Section title={t('workout.quick_start')}>
            <Button
              label={t('workout.start_empty')}
              variant="secondary"
              onPress={() => void startSession(undefined)}
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

function ActiveWorkoutLogger(props: {
  userId: string;
  unit: WeightUnit;
  session: WorkoutSessionRecord;
  historySessions: WorkoutSessionRecord[];
  catalog: Exercise[];
  onUpdateSession: (s: WorkoutSessionRecord) => void;
  onFinish: (s: WorkoutSessionRecord) => Promise<void>;
  onAbandon: () => Promise<void>;
}) {
  const { userId, unit, session, historySessions, catalog, onUpdateSession } = props;
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [remainingRest, setRemainingRest] = useState<number>(0);
  const [activeStopwatches, setActiveStopwatches] = useState<Record<string, number>>({});
  const [heldSetIds, setHeldSetIds] = useState<Record<string, boolean>>({});
  const [addingExercise, setAddingExercise] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getPersistedTimer(userId, session.id).then((ends) => {
      if (mounted && ends && ends > Date.now()) {
        setRestEndsAt(ends);
        setRemainingRest(remainingTimerSeconds(ends));
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId, session.id]);

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => {
      const rem = remainingTimerSeconds(restEndsAt);
      setRemainingRest(rem);
      if (rem <= 0) {
        Vibration.vibrate(40);
        setRestEndsAt(null);
        void setPersistedTimer(userId, session.id, null);
      }
    }, 500);
    return () => clearInterval(id);
  }, [restEndsAt, userId, session.id]);

  const historyByExercise = useMemo(() => {
    const map = new Map<string, SetRecord[]>();
    for (const past of historySessions) {
      if (past.id === session.id) continue;
      for (const ex of past.exercises ?? []) {
        const list = map.get(ex.exercise_id) ?? [];
        list.push(...ex.sets);
        map.set(ex.exercise_id, list);
      }
    }
    return map;
  }, [historySessions, session.id]);

  const formatPreviousBest = (exerciseId: string): string | null => {
    const pastSets = (historyByExercise.get(exerciseId) ?? []).filter(
      (s) => s.state === 'completed' && s.set_type !== 'warmup',
    );
    if (pastSets.length === 0) return null;
    const best = [...pastSets].sort(
      (a, b) =>
        (b.actual_weight_value ?? 0) - (a.actual_weight_value ?? 0) ||
        (b.actual_reps ?? 0) - (a.actual_reps ?? 0),
    )[0];
    if (!best) return null;
    if (best.actual_weight_value) {
      return `${best.actual_weight_value} ${best.actual_weight_unit} × ${best.actual_reps ?? 0}`;
    }
    if (best.actual_duration_s) return `${best.actual_duration_s}s`;
    return `${best.actual_reps ?? 0} reps`;
  };

  const adjustRest = async (deltaSeconds: number) => {
    const base = restEndsAt && restEndsAt > Date.now() ? restEndsAt : Date.now();
    const next = base + deltaSeconds * 1000;
    if (next <= Date.now()) {
      setRestEndsAt(null);
      setRemainingRest(0);
      await setPersistedTimer(userId, session.id, null);
    } else {
      setRestEndsAt(next);
      setRemainingRest(remainingTimerSeconds(next));
      await setPersistedTimer(userId, session.id, next);
    }
  };

  const startRestTimer = async (restSeconds: number) => {
    const restS = restSeconds || 90;
    const ends = Date.now() + restS * 1000;
    setRestEndsAt(ends);
    setRemainingRest(restS);
    await setPersistedTimer(userId, session.id, ends);
  };

  const updateSet = async (
    exId: string,
    setId: string,
    updater: (s: SetRecord, ex: SessionExerciseRecord) => SetRecord,
  ) => {
    let changedEx: SessionExerciseRecord | undefined;
    let changedSet: SetRecord | undefined;
    const nextExercises = (session.exercises ?? []).map((ex) => {
      if (ex.id !== exId) return ex;
      changedEx = ex;
      const nextSets = ex.sets.map((s) => {
        if (s.id !== setId) return s;
        changedSet = updater(s, ex);
        return changedSet;
      });
      return { ...ex, sets: nextSets };
    });

    if (!changedEx || !changedSet) return;

    const nextSession: WorkoutSessionRecord = {
      ...session,
      revision: session.revision + 1,
      exercises: nextExercises,
    };
    onUpdateSession(nextSession);
    await saveLocalSession(userId, nextSession, [
      sessionUpsertOp(nextSession),
      setUpsertOp(session.id, changedEx.id, changedSet),
    ]);
  };

  const toggleSkipExercise = async (ex: SessionExerciseRecord, skipReason?: string) => {
    const nextEx: SessionExerciseRecord = {
      ...ex,
      skipped: !ex.skipped,
      skip_reason: !ex.skipped ? (skipReason ?? null) : null,
    };
    const nextSession: WorkoutSessionRecord = {
      ...session,
      revision: session.revision + 1,
      exercises: (session.exercises ?? []).map((item) => (item.id === ex.id ? nextEx : item)),
    };
    onUpdateSession(nextSession);
    await saveLocalSession(userId, nextSession, [
      sessionUpsertOp(nextSession),
      exerciseUpsertOp(nextEx),
    ]);
  };

  const addSetToExercise = async (ex: SessionExerciseRecord) => {
    const prev = ex.sets[ex.sets.length - 1];
    const newSet: SetRecord = {
      id: randomUUID(),
      set_index: ex.sets.length + 1,
      set_type: 'working',
      actual_reps: prev?.actual_reps ?? (ex.tracking_type === 'time' ? null : 8),
      actual_weight_value:
        prev?.actual_weight_value ?? (ex.tracking_type === 'weight_reps' ? 20 : null),
      actual_weight_unit: prev?.actual_weight_unit ?? unit,
      actual_duration_s: prev?.actual_duration_s ?? (ex.tracking_type === 'time' ? 45 : null),
      state: 'not_recorded',
      is_pr: false,
    };
    const nextEx: SessionExerciseRecord = { ...ex, sets: [...ex.sets, newSet] };
    const nextSession: WorkoutSessionRecord = {
      ...session,
      revision: session.revision + 1,
      exercises: (session.exercises ?? []).map((item) => (item.id === ex.id ? nextEx : item)),
    };
    onUpdateSession(nextSession);
    await saveLocalSession(userId, nextSession, [
      sessionUpsertOp(nextSession),
      setUpsertOp(session.id, ex.id, newSet),
    ]);
  };

  const addExerciseMidWorkout = async (exercise: Exercise) => {
    const exId = randomUUID();
    const firstSet: SetRecord = {
      id: randomUUID(),
      set_index: 1,
      set_type: 'working',
      actual_reps: exercise.tracking_type === 'time' ? null : 8,
      actual_weight_value: exercise.tracking_type === 'weight_reps' ? 20 : null,
      actual_weight_unit: unit,
      actual_duration_s: exercise.tracking_type === 'time' ? 45 : null,
      state: 'not_recorded',
      is_pr: false,
    };
    const newEx: SessionExerciseRecord = {
      id: exId,
      session_id: session.id,
      exercise_id: exercise.id,
      position: (session.exercises?.length ?? 0) + 1,
      superset_group: null,
      tracking_type: exercise.tracking_type,
      rest_seconds: exercise.default_rest_seconds ?? 90,
      skipped: false,
      skip_reason: null,
      notes: '',
      exercise,
      sets: [firstSet],
    };
    const nextSession: WorkoutSessionRecord = {
      ...session,
      revision: session.revision + 1,
      exercises: [...(session.exercises ?? []), newEx],
    };
    onUpdateSession(nextSession);
    setAddingExercise(false);
    await saveLocalSession(userId, nextSession, [
      sessionUpsertOp(nextSession),
      exerciseUpsertOp(newEx),
      setUpsertOp(session.id, exId, firstSet),
    ]);
  };

  const finishWorkout = async () => {
    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000),
    );
    const completedSession: WorkoutSessionRecord = {
      ...session,
      status: 'completed',
      finished_at: finishedAt,
      duration_seconds: durationSeconds,
      revision: session.revision + 1,
    };
    await saveLocalSession(userId, completedSession, [sessionUpsertOp(completedSession)]);
    await props.onFinish(completedSession);
  };

  const abandonWorkout = async () => {
    const abandoned: WorkoutSessionRecord = {
      ...session,
      status: 'abandoned',
      finished_at: new Date().toISOString(),
      revision: session.revision + 1,
    };
    await saveLocalSession(userId, abandoned, [sessionUpsertOp(abandoned)]);
    await props.onAbandon();
  };

  return (
    <Screen title={session.title}>
      <SyncStatusBar userId={userId} />

      {remainingRest > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>
            {t('workout.rest_timer', { time: formatTimer(remainingRest) })}
          </Text>
          <View style={styles.row}>
            <Button
              label={t('workout.rest_minus_15')}
              variant="secondary"
              onPress={() => void adjustRest(-15)}
            />
            <Button
              label={t('workout.rest_plus_15')}
              variant="secondary"
              onPress={() => void adjustRest(15)}
            />
            <Button
              label={t('workout.rest_skip')}
              variant="secondary"
              onPress={() => void adjustRest(-9999)}
            />
          </View>
        </View>
      )}

      {(session.exercises ?? []).map((ex) => {
        const prevBest = formatPreviousBest(ex.exercise_id);
        return (
          <Section
            key={ex.id}
            title={
              ex.superset_group
                ? `${ex.exercise?.name ?? ''} • Superset ${ex.superset_group}`
                : (ex.exercise?.name ?? '')
            }
          >
            {prevBest && <Body muted>{t('workout.previous_best', { text: prevBest })}</Body>}
            {Boolean(ex.notes) && <Body muted>{ex.notes}</Body>}

            {ex.skipped ? (
              <View style={styles.card}>
                <Badge label={t('workout.skipped')} />
                <TextField
                  label={t('workout.skip_reason_placeholder')}
                  value={ex.skip_reason ?? ''}
                  onChangeText={(reason) => {
                    const updatedEx = { ...ex, skip_reason: reason };
                    const nextSession = {
                      ...session,
                      revision: session.revision + 1,
                      exercises: (session.exercises ?? []).map((i) =>
                        i.id === ex.id ? updatedEx : i,
                      ),
                    };
                    onUpdateSession(nextSession);
                    void saveLocalSession(userId, nextSession, [exerciseUpsertOp(updatedEx)]);
                  }}
                />
                <Button
                  label={t('workout.unskip_exercise')}
                  variant="secondary"
                  onPress={() => void toggleSkipExercise(ex)}
                />
              </View>
            ) : (
              <>
                {ex.sets.map((s) => {
                  const isDone = s.state === 'completed';
                  const swStarted = activeStopwatches[s.id];
                  return (
                    <View key={s.id} style={[styles.card, isDone && styles.cardCompleted]}>
                      <View style={styles.setHeader}>
                        <Text style={styles.setTitle}>
                          {t('workout.set_number', { num: s.set_index })}
                        </Text>
                        <View style={styles.row}>
                          {s.is_pr && <Badge label={t('workout.pr_badge')} />}
                          {heldSetIds[s.id] && !s.is_pr && (
                            <Button
                              label={t('workout.pr_held')}
                              variant="secondary"
                              onPress={() =>
                                void updateSet(ex.id, s.id, (cur) => ({ ...cur, is_pr: true }))
                              }
                            />
                          )}
                          <Badge
                            label={isDone ? t('workout.completed') : t('workout.not_recorded')}
                          />
                        </View>
                      </View>

                      <Choice<SetType>
                        label={t('programs.sets_count')}
                        value={s.set_type}
                        options={[
                          { value: 'warmup', label: t('workout.warmup') },
                          { value: 'working', label: t('workout.working') },
                          { value: 'failure', label: t('workout.failure') },
                        ]}
                        onChange={(setType) =>
                          void updateSet(ex.id, s.id, (cur) => ({ ...cur, set_type: setType }))
                        }
                      />

                      {ex.tracking_type === 'weight_reps' && (
                        <NumberStepper
                          label={t('workout.weight', { unit: s.actual_weight_unit })}
                          value={s.actual_weight_value}
                          step={defaultWeightStep(s.actual_weight_unit)}
                          allowDecimal
                          onChange={(val) =>
                            void updateSet(ex.id, s.id, (cur) => ({
                              ...cur,
                              actual_weight_value: val,
                            }))
                          }
                        />
                      )}

                      {(ex.tracking_type === 'weight_reps' || ex.tracking_type === 'reps') && (
                        <NumberStepper
                          label={t('workout.reps')}
                          value={s.actual_reps}
                          step={1}
                          onChange={(val) =>
                            void updateSet(ex.id, s.id, (cur) => ({ ...cur, actual_reps: val }))
                          }
                        />
                      )}

                      {ex.tracking_type === 'time' && (
                        <>
                          <NumberStepper
                            label={t('workout.seconds')}
                            value={s.actual_duration_s}
                            step={5}
                            onChange={(val) =>
                              void updateSet(ex.id, s.id, (cur) => ({
                                ...cur,
                                actual_duration_s: val,
                              }))
                            }
                          />
                          <Button
                            label={
                              swStarted
                                ? t('workout.countdown_stop', {
                                    seconds: s.actual_duration_s ?? 45,
                                  })
                                : t('workout.countdown_start', {
                                    seconds: s.actual_duration_s ?? 45,
                                  })
                            }
                            variant="secondary"
                            onPress={() => {
                              if (swStarted) {
                                const elapsed = Math.max(
                                  1,
                                  Math.round((Date.now() - swStarted) / 1000),
                                );
                                setActiveStopwatches((prev) => {
                                  const next = { ...prev };
                                  delete next[s.id];
                                  return next;
                                });
                                void updateSet(ex.id, s.id, (cur) => ({
                                  ...cur,
                                  actual_duration_s: elapsed,
                                  state: 'completed',
                                  completed_at: new Date().toISOString(),
                                }));
                                void startRestTimer(ex.rest_seconds);
                              } else {
                                setActiveStopwatches((prev) => ({
                                  ...prev,
                                  [s.id]: Date.now(),
                                }));
                              }
                            }}
                          />
                        </>
                      )}

                      <Button
                        label={isDone ? t('workout.completed') : t('workout.complete_set')}
                        variant={isDone ? 'secondary' : 'primary'}
                        onPress={() => {
                          Vibration.vibrate(15);
                          const nextState = isDone ? 'not_recorded' : 'completed';
                          const pastSets = [
                            ...(historyByExercise.get(ex.exercise_id) ?? []),
                            ...ex.sets.filter((other) => other.id !== s.id),
                          ];
                          const candidate: SetRecord = {
                            ...s,
                            state: nextState,
                            completed_at:
                              nextState === 'completed' ? new Date().toISOString() : null,
                          };
                          const pr = detectSetPr(candidate, pastSets, ex.tracking_type);
                          if (pr.heldForConfirmation) {
                            setHeldSetIds((prev) => ({ ...prev, [s.id]: true }));
                          }
                          void updateSet(ex.id, s.id, () => ({
                            ...candidate,
                            is_pr: pr.isPr,
                          }));
                          if (nextState === 'completed') {
                            void startRestTimer(ex.rest_seconds);
                          }
                        }}
                      />
                    </View>
                  );
                })}

                <View style={styles.row}>
                  <Button
                    label={t('workout.add_set')}
                    variant="secondary"
                    onPress={() => void addSetToExercise(ex)}
                  />
                  <Button
                    label={t('workout.skip_exercise')}
                    variant="secondary"
                    onPress={() => void toggleSkipExercise(ex)}
                  />
                </View>
              </>
            )}
          </Section>
        );
      })}

      <Section title={t('workout.add_exercise')}>
        {addingExercise ? (
          <View style={styles.card}>
            {catalog.slice(0, 20).map((ex) => (
              <ListItem
                key={ex.id}
                title={ex.name}
                subtitle={t(`muscles.${ex.primary_muscle}`)}
                onPress={() => void addExerciseMidWorkout(ex)}
              />
            ))}
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setAddingExercise(false)}
            />
          </View>
        ) : (
          <Button
            label={t('workout.add_exercise')}
            variant="secondary"
            onPress={() => setAddingExercise(true)}
          />
        )}
      </Section>

      <Section title={t('workout.finish')}>
        <Button label={t('workout.finish')} onPress={() => void finishWorkout()} />
        <Button
          label={t('workout.abandon')}
          variant="danger"
          onPress={() => void abandonWorkout()}
        />
      </Section>
    </Screen>
  );
}

export function WorkoutsHistoryScreen() {
  const { session, workspace } = useSession();
  const userId = session!.user.id;
  const ws = workspace!;
  const [localSessions, setLocalSessions] = useState<WorkoutSessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['ws', ws.id, 'sessions', userId],
    queryFn: () => api.sessions(ws.id, userId),
  });

  useEffect(() => {
    void getLocalSessions(userId, ws.id).then(setLocalSessions);
    return subscribeSyncState(() => {
      void getLocalSessions(userId, ws.id).then(setLocalSessions);
    });
  }, [userId, ws.id]);

  const completed = useMemo(
    () => mergeSessions(sessionsQuery.data, localSessions).filter((s) => s.status === 'completed'),
    [sessionsQuery.data, localSessions],
  );

  const selected = useMemo(
    () => completed.find((s) => s.id === selectedSessionId) ?? null,
    [completed, selectedSessionId],
  );

  if (selected) {
    return (
      <SessionDetailView
        session={selected}
        onBack={() => setSelectedSessionId(null)}
        onCommentPosted={() => void sessionsQuery.refetch()}
      />
    );
  }

  return (
    <Screen
      title={t('workout.history_title')}
      onRefresh={() => void sessionsQuery.refetch()}
      refreshing={sessionsQuery.isRefetching}
    >
      {completed.length === 0 ? (
        <EmptyState title={t('workout.history_empty')} body={t('workout.history_empty_body')} />
      ) : (
        <Section title={t('workout.history_title')}>
          {completed.map((s) => {
            const summary = summarizeSession(s.exercises ?? []);
            const dateStr = new Date(s.started_at).toLocaleDateString();
            return (
              <ListItem
                key={s.id}
                title={s.title}
                subtitle={`${dateStr} • ${t('workout.summary_volume', { volume: summary.totalVolumeKg })}`}
                badge={summary.prsEarned > 0 ? `${summary.prsEarned} PR` : undefined}
                onPress={() => setSelectedSessionId(s.id)}
              />
            );
          })}
        </Section>
      )}
    </Screen>
  );
}

export function SessionDetailView(props: {
  session: WorkoutSessionRecord;
  onBack: () => void;
  onCommentPosted?: () => void;
}) {
  const { session } = props;
  const summary = summarizeSession(session.exercises ?? []);
  const commentForm = useForm(commentSchema, { body: '' });
  const postComment = useMutation({
    mutationFn: (body: string) => api.addSessionComment(session.id, body),
    onSuccess: () => {
      commentForm.reset();
      props.onCommentPosted?.();
      void queryClient.invalidateQueries({ queryKey: ['ws', session.workspace_id, 'sessions'] });
    },
  });

  return (
    <Screen title={session.title}>
      <Button label={t('common.back')} variant="secondary" onPress={props.onBack} />

      <Section title={new Date(session.started_at).toLocaleDateString()}>
        <Body>
          {t('workout.summary_sets', {
            completed: summary.completedSets,
            skipped: summary.skippedSets,
          })}
        </Body>
        <Body>{t('workout.summary_volume', { volume: summary.totalVolumeKg })}</Body>
        {summary.prsEarned > 0 && (
          <Body>{t('workout.summary_prs', { count: summary.prsEarned })}</Body>
        )}
      </Section>

      {(session.exercises ?? []).map((ex) => (
        <Section key={ex.id} title={ex.exercise?.name ?? ''}>
          {ex.skipped ? (
            <Body muted>
              {t('workout.skipped')}
              {ex.skip_reason ? ` — ${ex.skip_reason}` : ''}
            </Body>
          ) : (
            ex.sets.map((s) => (
              <ListItem
                key={s.id}
                title={`${t('workout.set_number', { num: s.set_index })} (${t(`workout.${s.set_type === 'warmup' ? 'warmup' : s.set_type === 'failure' ? 'failure' : 'working'}`)})`}
                subtitle={
                  s.actual_weight_value !== null
                    ? `${s.actual_weight_value} ${s.actual_weight_unit} × ${s.actual_reps ?? 0}`
                    : s.actual_duration_s !== null
                      ? `${s.actual_duration_s}s`
                      : `${s.actual_reps ?? 0} reps`
                }
                badge={
                  s.is_pr
                    ? t('workout.pr_badge')
                    : s.state === 'completed'
                      ? t('workout.completed')
                      : t('workout.not_recorded')
                }
              />
            ))
          )}
        </Section>
      ))}

      <Section title={t('workout.comments_title')}>
        {(session.comments ?? []).map((c) => (
          <View key={c.id} style={styles.card}>
            <Body>{c.body}</Body>
            <Body muted>{new Date(c.created_at).toLocaleString()}</Body>
          </View>
        ))}
        <TextField label={t('workout.comment_placeholder')} {...commentForm.field('body')} />
        <Button
          label={t('workout.send_comment')}
          loading={postComment.isPending}
          onPress={() => {
            const data = commentForm.validate();
            if (data) postComment.mutate(data.body);
          }}
        />
        <Message tone="error" text={errorText(postComment.error)} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  routineBar: { paddingHorizontal: space.lg, paddingTop: space.md },
  syncBar: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    gap: space.sm,
  },
  restBanner: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
    gap: space.sm,
  },
  restText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  cardCompleted: {
    borderColor: colors.accent,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    alignItems: 'center',
  },
});
