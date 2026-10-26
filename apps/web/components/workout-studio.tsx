'use client';

import {
  computeWeeklyStreak,
  type Exercise,
  type MeasurementDefinition,
  type MeasurementEntry,
  type NotificationRecord,
  pickNextProgramDay,
  type ProgramAssignment,
  type ProgramDay,
  roleKey,
  SPLIT_TEMPLATES,
  type SplitTemplate,
  type SplitTemplateDay,
  type StreakRecord,
  summarizeSession,
  type SyncOpInput,
  t,
  type WeightUnit,
  type WorkoutSessionRecord,
  type WorkspaceAccess,
} from '@gravn/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { signOut } from '../app/(auth)/actions';
import { updateProfile } from '../app/actions';
import {
  addExerciseToRoutineDay,
  applySplitTemplate,
  createQuickRoutine,
  markNotificationReadAction,
  pushWorkoutOps,
  removeExerciseFromRoutineDay,
  requestInAppAccountDeletionAction,
  submitProblemReportAction,
} from '../app/workout-actions';
import { Form } from './form';
import { MeasurementsPanel } from './measurements-panel';

export interface RoutineProgramView {
  programId: string;
  versionId: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  days: ProgramDay[];
}

interface DraftSet {
  id: string;
  setIndex: number;
  weight: string;
  reps: string;
  durationS: string;
  completed: boolean;
  prevHint?: string;
}

interface DraftExercise {
  id: string;
  exercise: Exercise;
  position: number;
  restSeconds: number;
  sets: DraftSet[];
}

interface ActiveWorkout {
  sessionId: string;
  title: string;
  programAssignmentId: string | null;
  programDayId: string | null;
  startedAt: string;
  exercises: DraftExercise[];
  notes: string;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  isPersonal: boolean;
  userId: string;
  userEmail: string;
  displayName: string;
  unitSystem: 'metric' | 'imperial';
  unit: WeightUnit;
  exercises: Exercise[];
  initialSessions: WorkoutSessionRecord[];
  activeAssignment: ProgramAssignment | null;
  routines: RoutineProgramView[];
  allWorkspaces: WorkspaceAccess[];
  isPlatformAdmin: boolean;
  measurementDefinitions: MeasurementDefinition[];
  measurementEntries: MeasurementEntry[];
  notifications: NotificationRecord[];
  streakRecord: StreakRecord | null;
}

type MemberTab = 'workout' | 'routines' | 'progress' | 'history' | 'profile';

const MUSCLE_FILTERS = [
  'all',
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'core',
] as const;

function calcRestEndMs(seconds: number): number {
  return new Date().getTime() + seconds * 1000;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WorkoutStudio({
  workspaceId,
  workspaceName,
  isPersonal,
  userId,
  userEmail,
  displayName,
  unitSystem,
  unit,
  exercises,
  initialSessions,
  activeAssignment,
  routines,
  allWorkspaces,
  isPlatformAdmin,
  measurementDefinitions,
  measurementEntries,
  notifications,
  streakRecord,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<MemberTab>('workout');
  const [routinesView, setRoutinesView] = useState<'curated' | 'mine'>(
    routines.length > 0 ? 'mine' : 'curated',
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SPLIT_TEMPLATES[0]?.id ?? '');
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(
    routines[0]?.programId ?? null,
  );

  // Active distraction-free workout state
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [restUntilMs, setRestUntilMs] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);

  // Modals
  const [pickerModal, setPickerModal] = useState<
    { mode: 'active' } | { mode: 'routine-day'; dayId: string; nextPos: number } | null
  >(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('all');
  const [showNewRoutineModal, setShowNewRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletionScheduled, setDeletionScheduled] = useState(false);

  // Elapsed workout timer + rest timer
  useEffect(() => {
    if (!active) return;
    const startMs = new Date(active.startedAt).getTime();
    const tick = () => {
      const now = new Date().getTime();
      setElapsedSec(Math.max(0, Math.floor((now - startMs) / 1000)));
      if (restUntilMs) {
        const rem = Math.max(0, Math.ceil((restUntilMs - now) / 1000));
        setRestRemaining(rem);
        if (rem <= 0) setRestUntilMs(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, restUntilMs]);

  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const exerciseByName = useMemo(
    () => new Map(exercises.map((e) => [e.name.toLowerCase(), e])),
    [exercises],
  );

  // Map previous best set for each exercise
  const prevBestByExercise = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of initialSessions) {
      for (const se of s.exercises ?? []) {
        if (map.has(se.exercise_id)) continue;
        const firstDone = (se.sets ?? []).find((st) => st.state === 'completed');
        if (firstDone) {
          if (firstDone.actual_weight_value !== null && firstDone.actual_reps !== null) {
            map.set(
              se.exercise_id,
              `${firstDone.actual_weight_value} ${unit} × ${firstDone.actual_reps}`,
            );
          } else if (firstDone.actual_reps !== null) {
            map.set(se.exercise_id, `${firstDone.actual_reps} reps`);
          }
        }
      }
    }
    return map;
  }, [initialSessions, unit]);

  const nextProgramDay = useMemo(
    () =>
      pickNextProgramDay(
        activeAssignment?.program_version?.days ?? [],
        initialSessions[0]?.program_day_id ?? null,
      ),
    [activeAssignment, initialSessions],
  );

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (muscleFilter !== 'all' && ex.primary_muscle !== muscleFilter) return false;
      if (!q) return true;
      return ex.name.toLowerCase().includes(q) || ex.primary_muscle.toLowerCase().includes(q);
    });
  }, [exercises, searchQuery, muscleFilter]);

  function startFromProgramDay(day: ProgramDay, assignmentId: string | null) {
    const sortedItems = [...(day.items ?? [])].sort((a, b) => a.position - b.position);
    const draftExercises: DraftExercise[] = sortedItems.flatMap((item, idx) => {
      const ex = item.exercise ?? exerciseById.get(item.exercise_id);
      if (!ex) return [];
      const count = Math.max(1, item.sets_count || 3);
      const prevHint = prevBestByExercise.get(ex.id);
      const sets: DraftSet[] = Array.from({ length: count }, (_, sIdx) => ({
        id: crypto.randomUUID(),
        setIndex: sIdx + 1,
        weight: item.target_weight_value !== null ? String(item.target_weight_value) : '',
        reps: item.target_reps_min !== null ? String(item.target_reps_min) : '10',
        durationS: item.target_duration_s !== null ? String(item.target_duration_s) : '',
        completed: false,
        prevHint,
      }));
      return [
        {
          id: crypto.randomUUID(),
          exercise: ex,
          position: idx + 1,
          restSeconds: item.rest_seconds || ex.default_rest_seconds || 90,
          sets,
        },
      ];
    });

    setActive({
      sessionId: crypto.randomUUID(),
      title: day.title,
      programAssignmentId: assignmentId,
      programDayId: day.id,
      startedAt: new Date().toISOString(),
      exercises: draftExercises,
      notes: '',
    });
  }

  function startFromPresetDay(tpl: SplitTemplate, daySpec: SplitTemplateDay) {
    const draftExercises: DraftExercise[] = daySpec.items.flatMap((item, idx) => {
      const ex = exerciseByName.get(item.exerciseName.toLowerCase());
      if (!ex) return [];
      const prevHint = prevBestByExercise.get(ex.id);
      const sets: DraftSet[] = Array.from({ length: item.setsCount }, (_, sIdx) => ({
        id: crypto.randomUUID(),
        setIndex: sIdx + 1,
        weight: '',
        reps: item.repsMin ? String(item.repsMin) : '10',
        durationS: item.durationSeconds ? String(item.durationSeconds) : '',
        completed: false,
        prevHint,
      }));
      return [
        {
          id: crypto.randomUUID(),
          exercise: ex,
          position: idx + 1,
          restSeconds: ex.default_rest_seconds || 90,
          sets,
        },
      ];
    });

    setActive({
      sessionId: crypto.randomUUID(),
      title: `${tpl.name} — ${daySpec.title}`,
      programAssignmentId: null,
      programDayId: null,
      startedAt: new Date().toISOString(),
      exercises: draftExercises,
      notes: '',
    });
  }

  function startEmptyWorkout() {
    setActive({
      sessionId: crypto.randomUUID(),
      title: 'Evening Session',
      programAssignmentId: null,
      programDayId: null,
      startedAt: new Date().toISOString(),
      exercises: [],
      notes: '',
    });
  }

  function addExerciseToActive(ex: Exercise) {
    if (!active) return;
    const prevHint = prevBestByExercise.get(ex.id);
    const nextEx: DraftExercise = {
      id: crypto.randomUUID(),
      exercise: ex,
      position: active.exercises.length + 1,
      restSeconds: ex.default_rest_seconds || 90,
      sets: [
        {
          id: crypto.randomUUID(),
          setIndex: 1,
          weight: '',
          reps: '10',
          durationS: '',
          completed: false,
          prevHint,
        },
        {
          id: crypto.randomUUID(),
          setIndex: 2,
          weight: '',
          reps: '10',
          durationS: '',
          completed: false,
          prevHint,
        },
        {
          id: crypto.randomUUID(),
          setIndex: 3,
          weight: '',
          reps: '10',
          durationS: '',
          completed: false,
          prevHint,
        },
      ],
    };
    setActive({ ...active, exercises: [...active.exercises, nextEx] });
    setPickerModal(null);
  }

  function updateSet(
    exId: string,
    setId: string,
    patch: Partial<Pick<DraftSet, 'weight' | 'reps' | 'durationS' | 'completed'>>,
  ) {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((st) => {
            if (st.id !== setId) return st;
            const next = { ...st, ...patch };
            if (patch.completed === true && !st.completed) {
              setRestUntilMs(calcRestEndMs(ex.restSeconds));
            }
            return next;
          }),
        };
      }),
    });
  }

  function addSetRow(exId: string) {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: crypto.randomUUID(),
              setIndex: ex.sets.length + 1,
              weight: last?.weight ?? '',
              reps: last?.reps ?? '10',
              durationS: last?.durationS ?? '',
              completed: false,
              prevHint: last?.prevHint,
            },
          ],
        };
      }),
    });
  }

  function removeExerciseBlock(exId: string) {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises
        .filter((e) => e.id !== exId)
        .map((e, idx) => ({ ...e, position: idx + 1 })),
    });
  }

  function finishWorkout() {
    if (!active) return;
    const finishedAt = new Date().toISOString();
    const ops: SyncOpInput[] = [
      {
        op_id: crypto.randomUUID(),
        type: 'upsert_session',
        base_revision: 1,
        payload: {
          id: active.sessionId,
          workspace_id: workspaceId,
          assignment_id: active.programAssignmentId,
          program_version_id: activeAssignment?.program_version_id ?? null,
          program_day_id: active.programDayId,
          title: active.title.trim() || 'Workout Session',
          planned_snapshot: {},
          status: 'completed',
          started_at: active.startedAt,
          finished_at: finishedAt,
          duration_seconds: Math.max(60, elapsedSec),
          notes: active.notes,
        },
      },
    ];

    for (const ex of active.exercises) {
      ops.push({
        op_id: crypto.randomUUID(),
        type: 'upsert_exercise',
        payload: {
          id: ex.id,
          session_id: active.sessionId,
          exercise_id: ex.exercise.id,
          position: ex.position,
          superset_group: null,
          tracking_type: ex.exercise.tracking_type,
          rest_seconds: ex.restSeconds,
          skipped: false,
          skip_reason: null,
          notes: '',
        },
      });
      for (const st of ex.sets) {
        const w = st.weight.trim() !== '' ? Number(st.weight) : null;
        const r = st.reps.trim() !== '' ? Number(st.reps) : null;
        const d = st.durationS.trim() !== '' ? Number(st.durationS) : null;
        ops.push({
          op_id: crypto.randomUUID(),
          type: 'upsert_set',
          base_revision: 1,
          payload: {
            id: st.id,
            session_id: active.sessionId,
            session_exercise_id: ex.id,
            set_index: st.setIndex,
            set_type: 'working',
            planned_reps_min: null,
            planned_reps_max: null,
            planned_weight_value: null,
            planned_weight_unit: null,
            planned_duration_s: null,
            actual_reps: r !== null && Number.isFinite(r) ? r : null,
            actual_weight_value: w !== null && Number.isFinite(w) ? w : null,
            actual_weight_unit: unit,
            actual_duration_s: d !== null && Number.isFinite(d) ? d : null,
            rpe: null,
            note: '',
            state: st.completed ? 'completed' : 'not_recorded',
            is_pr: false,
            completed_at: st.completed ? finishedAt : null,
          },
        });
      }
    }

    startTransition(async () => {
      await pushWorkoutOps(ops);
      setActive(null);
      setRestUntilMs(null);
      setTab('history');
      router.refresh();
    });
  }

  // Stats for History & Profile
  const historyTotals = useMemo(() => {
    let totalVolume = 0;
    let totalPrs = 0;
    for (const s of initialSessions) {
      const sum = summarizeSession(s.exercises ?? []);
      totalVolume += sum.totalVolumeKg;
      totalPrs += sum.prsEarned;
    }
    return {
      sessionsCount: initialSessions.length,
      totalVolume: Math.round(totalVolume),
      totalPrs,
    };
  }, [initialSessions]);

  const selectedPreset =
    SPLIT_TEMPLATES.find((tpl) => tpl.id === selectedPresetId) ?? SPLIT_TEMPLATES[0];

  const otherWorkspaces = useMemo(
    () => allWorkspaces.filter((w) => w.id !== workspaceId),
    [allWorkspaces, workspaceId],
  );

  const weeklyTarget = useMemo(() => {
    if (activeAssignment?.program_version?.days?.length) {
      return activeAssignment.program_version.days.length;
    }
    if (routines[0]?.days.length) {
      return routines[0].days.length;
    }
    return streakRecord?.weekly_target ?? 3;
  }, [activeAssignment, routines, streakRecord]);

  const streakSummary = useMemo(
    () =>
      computeWeeklyStreak(
        initialSessions.filter((s) => s.status === 'completed').map((s) => s.started_at),
        weeklyTarget,
        {
          pausedUntil: streakRecord?.paused_until ?? null,
          freezesAvailable: streakRecord?.freezes_available ?? 1,
        },
      ),
    [initialSessions, weeklyTarget, streakRecord],
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read_at),
    [notifications],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FULL-SCREEN DISTRACTION-FREE WORKOUT MODE
  // ─────────────────────────────────────────────────────────────────────────────
  if (active) {
    return (
      <div className="lux-focus-workout">
        <header className="lux-focus-header">
          <div className="lux-focus-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setActive(null)}
                disabled={isPending}
              >
                Discard
              </button>
              <div>
                <input
                  aria-label="Session title"
                  value={active.title}
                  onChange={(e) => setActive({ ...active, title: e.target.value })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: '1.45rem',
                    padding: 0,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {restRemaining > 0 && (
                <button
                  type="button"
                  className="lux-tag"
                  onClick={() => setRestUntilMs(null)}
                  style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                >
                  Rest {formatClock(restRemaining)} · Skip
                </button>
              )}
              <span className="mono muted" style={{ fontSize: 14 }}>
                {formatClock(elapsedSec)}
              </span>
              <button type="button" className="btn" disabled={isPending} onClick={finishWorkout}>
                {isPending ? 'Saving…' : 'Finish Session'}
              </button>
            </div>
          </div>
        </header>

        <div className="lux-focus-body">
          {active.exercises.length === 0 ? (
            <div className="empty" style={{ padding: '64px 32px' }}>
              <h3 className="serif-lg" style={{ marginBottom: 8 }}>
                Your floor is ready
              </h3>
              <p className="muted" style={{ marginBottom: 24 }}>
                Add your first movement to begin logging sets.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSearchQuery('');
                  setMuscleFilter('all');
                  setPickerModal({ mode: 'active' });
                }}
              >
                + Add Movement
              </button>
            </div>
          ) : (
            <>
              {active.exercises.map((exBlock) => (
                <div key={exBlock.id} className="lux-exercise-block">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <h3 className="serif-md">{exBlock.exercise.name}</h3>
                      <span
                        className="muted"
                        style={{
                          fontSize: 12,
                          textTransform: 'capitalize',
                        }}
                      >
                        {exBlock.exercise.primary_muscle} · Rest {exBlock.restSeconds}s
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => removeExerciseBlock(exBlock.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <table className="lux-set-table">
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>Set</th>
                        <th>Prev</th>
                        <th style={{ width: 72, textAlign: 'center' }}>{unit.toUpperCase()}</th>
                        <th style={{ width: 72, textAlign: 'center' }}>
                          {exBlock.exercise.tracking_type === 'time' ? 'Sec' : 'Reps'}
                        </th>
                        <th style={{ width: 42, textAlign: 'right' }}>✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exBlock.sets.map((st) => (
                        <tr key={st.id} className={st.completed ? 'completed' : undefined}>
                          <td className="mono muted">{st.setIndex}</td>
                          <td className="mono muted" style={{ fontSize: 12.5 }}>
                            {st.prevHint ?? '—'}
                          </td>
                          <td>
                            {exBlock.exercise.tracking_type === 'weight_reps' ? (
                              <input
                                className="lux-num-input"
                                inputMode="decimal"
                                placeholder="0"
                                value={st.weight}
                                onChange={(e) =>
                                  updateSet(exBlock.id, st.id, { weight: e.target.value })
                                }
                              />
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {exBlock.exercise.tracking_type === 'time' ? (
                              <input
                                className="lux-num-input"
                                inputMode="numeric"
                                placeholder="60"
                                value={st.durationS}
                                onChange={(e) =>
                                  updateSet(exBlock.id, st.id, { durationS: e.target.value })
                                }
                              />
                            ) : (
                              <input
                                className="lux-num-input"
                                inputMode="numeric"
                                placeholder="10"
                                value={st.reps}
                                onChange={(e) =>
                                  updateSet(exBlock.id, st.id, { reps: e.target.value })
                                }
                              />
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              aria-label={`Complete set ${st.setIndex}`}
                              className={`lux-check-btn ${st.completed ? 'done' : ''}`}
                              onClick={() =>
                                updateSet(exBlock.id, st.id, { completed: !st.completed })
                              }
                            >
                              ✓
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => addSetRow(exBlock.id)}
                    >
                      + Add Set
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                <button
                  type="button"
                  className="btn secondary lg"
                  onClick={() => {
                    setSearchQuery('');
                    setMuscleFilter('all');
                    setPickerModal({ mode: 'active' });
                  }}
                >
                  + Add Movement
                </button>
              </div>
            </>
          )}
        </div>

        {pickerModal?.mode === 'active' && (
          <div className="lux-modal-backdrop" onClick={() => setPickerModal(null)}>
            <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
              <div className="lux-modal-header">
                <h3 className="serif-md">Select Movement</h3>
                <button type="button" className="btn ghost sm" onClick={() => setPickerModal(null)}>
                  Close
                </button>
              </div>
              <div className="lux-modal-body">
                <input
                  className="lux-input"
                  placeholder="Search movements (e.g. Bench Press, Squat, Lat Pulldown)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="lux-pills">
                  {MUSCLE_FILTERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`lux-pill ${muscleFilter === m ? 'active' : ''}`}
                      onClick={() => setMuscleFilter(m)}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="lux-surface-flush" style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {filteredExercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="lux-row lux-row-interactive"
                      onClick={() => addExerciseToActive(ex)}
                    >
                      <div>
                        <div className="lux-row-title">{ex.name}</div>
                        <div className="lux-row-sub" style={{ textTransform: 'capitalize' }}>
                          {ex.primary_muscle} · {ex.equipment_id || 'Bodyweight'}
                        </div>
                      </div>
                      <span className="muted" style={{ fontSize: 13 }}>
                        + Add
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FOCUSED 5-TAB LUXURY SHELL (`Workout` | `Splits` | `Progress` | `History` | `Profile`)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="lux-member-shell">
      <header className="lux-topbar">
        <div className="lux-topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="wordmark">GRAVN</span>
            {otherWorkspaces.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {otherWorkspaces.map((w) => {
                  const isStaffWs = w.roles.includes('owner') || w.roles.includes('trainer');
                  const href = isStaffWs ? `/w/${w.id}` : `/home?ws=${w.id}`;
                  return (
                    <Link
                      key={w.id}
                      href={href}
                      className="lux-pill"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                    >
                      {w.type === 'personal' ? 'Personal Studio' : w.name} →
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <nav className="lux-tabbar lux-tabbar-desktop" aria-label="Primary Navigation">
            <button
              type="button"
              className={`lux-tab ${tab === 'workout' ? 'active' : ''}`}
              onClick={() => setTab('workout')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6.5 6.5 11 11" />
                <path d="m21 21-1-1" />
                <path d="m3 3 1 1" />
                <path d="m18 22 4-4" />
                <path d="m2 6 4-4" />
                <path d="m3 10 7-7" />
                <path d="m14 21 7-7" />
              </svg>
              <span>Workout</span>
            </button>
            <button
              type="button"
              className={`lux-tab ${tab === 'routines' ? 'active' : ''}`}
              onClick={() => setTab('routines')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span>Splits</span>
            </button>
            <button
              type="button"
              className={`lux-tab ${tab === 'progress' ? 'active' : ''}`}
              onClick={() => setTab('progress')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <span>Progress</span>
            </button>
            <button
              type="button"
              className={`lux-tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => setTab('history')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
              <span>History</span>
            </button>
            <button
              type="button"
              className={`lux-tab ${tab === 'profile' ? 'active' : ''}`}
              onClick={() => setTab('profile')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
              <span>Profile</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="lux-main">
        {/* ─── TAB 1: WORKOUT ─── */}
        {tab === 'workout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span className="eyebrow">{isPersonal ? 'Personal Studio' : workspaceName}</span>
                <h1>Begin Training</h1>
                <p className="muted">
                  Step onto the floor with a structured split or open a blank session.
                </p>
              </div>
              <button type="button" className="btn secondary" onClick={startEmptyWorkout}>
                + Empty Session
              </button>
            </div>

            {/* Weekly Streak & Progress Strip (§3.8) */}
            <div
              className="lux-surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                padding: '18px 24px',
              }}
            >
              <div>
                <span className="eyebrow" style={{ marginBottom: 2 }}>
                  Weekly Consistency
                </span>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{streakSummary.statusText}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {Array.from({ length: streakSummary.weeklyTarget }, (_, idx) => {
                  const done = idx < streakSummary.thisWeekCompleted;
                  return (
                    <span
                      key={idx}
                      style={{
                        width: 28,
                        height: 8,
                        borderRadius: 999,
                        background: done ? 'var(--accent)' : 'var(--border-strong)',
                        display: 'inline-block',
                      }}
                    />
                  );
                })}
                {streakSummary.bestWeeks > 0 && (
                  <span className="mono muted" style={{ fontSize: 12, marginLeft: 6 }}>
                    Best: {streakSummary.bestWeeks}w
                  </span>
                )}
              </div>
            </div>

            {/* Unread Coach High-Fives / Notifications */}
            {unreadNotifications.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unreadNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="lux-surface"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '14px 20px',
                      borderColor: 'var(--accent-border)',
                    }}
                  >
                    <div>
                      <span className="eyebrow" style={{ marginBottom: 2 }}>
                        Coach Feedback
                      </span>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>👏 {n.title}</div>
                      {n.body && (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {n.body}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await markNotificationReadAction(n.id);
                          router.refresh();
                        });
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Assigned Coach Program Hero Card (if assigned) */}
            {activeAssignment && nextProgramDay && (
              <div className="lux-hero-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <span className="eyebrow">
                      Assigned Split · {activeAssignment.program_version?.program?.name}
                    </span>
                    <h2 className="serif-lg">{nextProgramDay.title}</h2>
                  </div>
                  <button
                    type="button"
                    className="btn lg"
                    style={{ flexShrink: 0 }}
                    onClick={() => startFromProgramDay(nextProgramDay, activeAssignment.id)}
                  >
                    Begin Session
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 20px',
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {(nextProgramDay.items ?? []).map((item) => (
                    <span key={item.id} className="muted" style={{ fontSize: 13.5 }}>
                      {item.exercise?.name} · <span className="mono">{item.sets_count} sets</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Routines Quick Launch OR Featured Split */}
            {routines.length > 0 ? (
              <div>
                <div className="section-header">
                  <h2 className="serif-md">Your Active Splits</h2>
                  <button type="button" className="btn ghost sm" onClick={() => setTab('routines')}>
                    Manage Splits →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {routines.map((routine) => (
                    <div key={routine.programId} className="lux-surface">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <h3 className="serif-md">{routine.name}</h3>
                          {routine.description && (
                            <p className="muted" style={{ fontSize: 13 }}>
                              {routine.description}
                            </p>
                          )}
                        </div>
                        <span className="mono muted" style={{ fontSize: 12 }}>
                          {routine.days.length} days
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: 10,
                        }}
                      >
                        {routine.days.map((day, idx) => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => startFromProgramDay(day, null)}
                            style={{
                              textAlign: 'left',
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              padding: '14px 16px',
                              cursor: 'pointer',
                              color: 'var(--text)',
                            }}
                          >
                            <div className="eyebrow" style={{ marginBottom: 2, fontSize: 10 }}>
                              Day {idx + 1}
                            </div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{day.title}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {(day.items ?? []).length} movements · Start →
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="lux-hero-card">
                <div>
                  <span className="eyebrow">Curated Architecture</span>
                  <h2 className="serif-lg">Choose a Foundation Split</h2>
                  <p className="muted" style={{ marginTop: 4 }}>
                    Start immediately with Push / Pull / Legs, Upper / Lower, or Full Body — or save
                    one to your personal library.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setRoutinesView('curated');
                      setTab('routines');
                    }}
                  >
                    Explore Curated Splits
                  </button>
                  <button type="button" className="btn secondary" onClick={startEmptyWorkout}>
                    Begin Blank Session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: SPLITS & ROUTINES ─── */}
        {tab === 'routines' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span className="eyebrow">Training Architecture</span>
                <h1>Splits & Routines</h1>
              </div>

              <div className="lux-pills">
                <button
                  type="button"
                  className={`lux-pill ${routinesView === 'curated' ? 'active' : ''}`}
                  onClick={() => setRoutinesView('curated')}
                >
                  Curated Splits ({SPLIT_TEMPLATES.length})
                </button>
                {isPersonal && (
                  <button
                    type="button"
                    className={`lux-pill ${routinesView === 'mine' ? 'active' : ''}`}
                    onClick={() => setRoutinesView('mine')}
                  >
                    My Routines ({routines.length})
                  </button>
                )}
              </div>
            </div>

            {routinesView === 'curated' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="lux-pills">
                  {SPLIT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className={`lux-pill ${selectedPreset?.id === tpl.id ? 'active' : ''}`}
                      onClick={() => setSelectedPresetId(tpl.id)}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>

                {selectedPreset && (
                  <div className="lux-surface">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        paddingBottom: 16,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <span className="eyebrow">
                          {selectedPreset.daysPerWeek} Days / Week · {selectedPreset.tag}
                        </span>
                        <h2 className="serif-lg">{selectedPreset.name}</h2>
                        <p className="muted" style={{ marginTop: 4, fontSize: 13.5 }}>
                          {selectedPreset.description}
                        </p>
                      </div>

                      {isPersonal && (
                        <button
                          type="button"
                          className="btn sm"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await applySplitTemplate({
                                workspaceId,
                                templateId: selectedPreset.id,
                                publish: true,
                              });
                              setRoutinesView('mine');
                              router.refresh();
                            });
                          }}
                        >
                          {isPending ? 'Saving…' : 'Adopt Split'}
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        marginTop: 16,
                      }}
                    >
                      {selectedPreset.days.map((day, dIdx) => (
                        <div
                          key={day.title}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: 16,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 12,
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span className="eyebrow" style={{ marginBottom: 2 }}>
                                Day {dIdx + 1}
                              </span>
                              <h3 className="serif-md" style={{ lineHeight: 1.3 }}>
                                {day.title}
                              </h3>
                            </div>
                            <button
                              type="button"
                              className="btn secondary sm"
                              style={{ flexShrink: 0 }}
                              onClick={() => startFromPresetDay(selectedPreset, day)}
                            >
                              Start Day {dIdx + 1}
                            </button>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            {day.items.map((it, idx) => (
                              <div
                                key={it.exerciseName}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 12,
                                  fontSize: 13.5,
                                  padding: '7px 0',
                                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                                }}
                              >
                                <span style={{ fontWeight: 500 }}>{it.exerciseName}</span>
                                <span
                                  className="mono muted"
                                  style={{ flexShrink: 0, fontSize: 12.5 }}
                                >
                                  {it.setsCount} ×{' '}
                                  {it.durationSeconds
                                    ? `${it.durationSeconds}s`
                                    : `${it.repsMin}–${it.repsMax}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {routinesView === 'mine' && isPersonal && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <p className="muted">
                    Customize your saved splits or create a custom routine from scratch.
                  </p>
                  <button
                    type="button"
                    className="btn secondary sm"
                    onClick={() => setShowNewRoutineModal(true)}
                  >
                    + New Custom Routine
                  </button>
                </div>

                {routines.length === 0 ? (
                  <div className="empty">
                    <h3 className="serif-md" style={{ marginBottom: 6 }}>
                      No custom splits saved yet
                    </h3>
                    <p className="muted" style={{ marginBottom: 20 }}>
                      Adopt one of the Curated Splits or create your own routine.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRoutinesView('curated')}
                    >
                      Browse Curated Splits
                    </button>
                  </div>
                ) : (
                  routines.map((routine) => {
                    const isOpen = expandedRoutineId === routine.programId;
                    return (
                      <div key={routine.programId} className="lux-surface-flush">
                        <div
                          className="lux-row lux-row-interactive"
                          onClick={() => setExpandedRoutineId(isOpen ? null : routine.programId)}
                        >
                          <div>
                            <h3 className="serif-md">{routine.name}</h3>
                            <div className="lux-row-sub">
                              {routine.days.length} day(s) ·{' '}
                              {routine.days.map((d) => d.title).join(' / ')}
                            </div>
                          </div>
                          <span className="muted" style={{ fontSize: 13 }}>
                            {isOpen ? 'Hide' : 'Configure →'}
                          </span>
                        </div>

                        {isOpen && (
                          <div
                            style={{
                              padding: '20px 24px 24px',
                              borderTop: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 20,
                            }}
                          >
                            {routine.days.map((day, dIdx) => {
                              const sortedItems = [...(day.items ?? [])].sort(
                                (a, b) => a.position - b.position,
                              );
                              return (
                                <div
                                  key={day.id}
                                  style={{
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    padding: 18,
                                  }}
                                >
                                   <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        flexWrap: 'wrap',
                                        marginBottom: 12,
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: 160 }}>
                                        <span className="eyebrow" style={{ marginBottom: 2 }}>
                                          Day {dIdx + 1}
                                        </span>
                                        <strong style={{ fontSize: 15 }}>{day.title}</strong>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button
                                          type="button"
                                          className="btn ghost sm"
                                          onClick={() => {
                                            setSearchQuery('');
                                            setMuscleFilter('all');
                                            setPickerModal({
                                              mode: 'routine-day',
                                              dayId: day.id,
                                              nextPos: sortedItems.length + 1,
                                            });
                                          }}
                                        >
                                          + Movement
                                        </button>
                                        <button
                                          type="button"
                                          className="btn sm"
                                          onClick={() => startFromProgramDay(day, null)}
                                        >
                                          Start
                                        </button>
                                      </div>
                                    </div>

                                    {sortedItems.length === 0 ? (
                                      <p className="muted" style={{ fontSize: 13 }}>
                                        No movements added yet.
                                      </p>
                                    ) : (
                                      <div
                                        style={{ display: 'flex', flexDirection: 'column' }}
                                      >
                                        {sortedItems.map((it, idx) => (
                                          <div
                                            key={it.id}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              gap: 10,
                                              padding: '7px 0',
                                              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                                              fontSize: 13.5,
                                            }}
                                          >
                                            <span>
                                              {it.exercise?.name} ·{' '}
                                              <span className="mono muted">
                                                {it.sets_count} × {it.target_reps_min ?? 8}–
                                                {it.target_reps_max ?? 12}
                                              </span>
                                            </span>
                                          <button
                                            type="button"
                                            className="btn ghost sm"
                                            disabled={isPending}
                                            onClick={() => {
                                              startTransition(async () => {
                                                await removeExerciseFromRoutineDay(
                                                  it.id,
                                                  workspaceId,
                                                );
                                                router.refresh();
                                              });
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: PROGRESS & BODY MEASUREMENTS (§3.2) ─── */}
        {tab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <span className="eyebrow">Body Composition & Metrics</span>
              <h1>Progress & Measurements</h1>
              <p className="muted">
                Track body weight, body fat percentage, and circumference measurements over time.
              </p>
            </div>

            <MeasurementsPanel
              subjectUserId={userId}
              workspaceId={workspaceId}
              unitSystem={unitSystem}
              definitions={measurementDefinitions}
              entries={measurementEntries}
            />
          </div>
        )}

        {/* ─── TAB 4: HISTORY ─── */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <span className="eyebrow">Training Ledger</span>
              <h1>Session History</h1>
            </div>

            <div className="lux-stats-row" style={{ marginBottom: 8 }}>
              <div className="lux-stat">
                <span className="lux-stat-label">Completed Sessions</span>
                <span className="lux-stat-value mono">{historyTotals.sessionsCount}</span>
              </div>
              <div className="lux-stat">
                <span className="lux-stat-label">Total Volume</span>
                <span className="lux-stat-value mono">
                  {historyTotals.totalVolume.toLocaleString()}{' '}
                  <small style={{ fontSize: 14 }}>kg</small>
                </span>
              </div>
              <div className="lux-stat">
                <span className="lux-stat-label">Personal Records</span>
                <span className="lux-stat-value mono">{historyTotals.totalPrs}</span>
              </div>
            </div>

            {initialSessions.length === 0 ? (
              <div className="empty">
                <h3 className="serif-md" style={{ marginBottom: 6 }}>
                  No sessions recorded yet
                </h3>
                <p className="muted">Completed workouts and personal records will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {initialSessions.map((session) => {
                  const summary = summarizeSession(session.exercises ?? []);
                  const dateLabel = new Date(session.started_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <div key={session.id} className="lux-surface">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <span className="eyebrow" style={{ marginBottom: 2 }}>
                            {dateLabel}
                          </span>
                          <h3 className="serif-md">{session.title}</h3>
                        </div>
                        <div className="mono muted" style={{ fontSize: 12.5 }}>
                          {Math.round(summary.totalVolumeKg).toLocaleString()} kg ·{' '}
                          {summary.completedSets} sets
                          {summary.prsEarned > 0 ? ` · ${summary.prsEarned} PR` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {(session.exercises ?? []).map((se, idx) => {
                          const doneSets = (se.sets ?? []).filter((st) => st.state === 'completed');
                          if (doneSets.length === 0) return null;
                          const best = doneSets[0];
                          return (
                            <div
                              key={se.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                fontSize: 13.5,
                                padding: '6px 0',
                                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                              }}
                            >
                              <span>
                                <span className="mono muted" style={{ marginRight: 8 }}>
                                  {doneSets.length}×
                                </span>
                                {se.exercise?.name}
                              </span>
                              <span className="mono muted">
                                {best?.actual_weight_value !== null &&
                                best?.actual_weight_value !== undefined
                                  ? `${best.actual_weight_value} ${best.actual_weight_unit ?? unit} × ${best.actual_reps ?? 0}`
                                  : `${best?.actual_reps ?? 0} reps`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: PROFILE ─── */}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <span className="eyebrow">Member Profile</span>
              <h1>{displayName || userEmail}</h1>
              <p className="muted">{userEmail}</p>
            </div>

            <div className="lux-surface">
              <h3 className="serif-md" style={{ marginBottom: 16 }}>
                Preferences
              </h3>
              <Form
                action={updateProfile}
                submit={t('account.save_profile')}
                fields={[
                  {
                    name: 'displayName',
                    label: t('auth.display_name'),
                    defaultValue: displayName,
                  },
                ]}
              />
            </div>

            {allWorkspaces.length > 1 && (
              <div className="lux-surface-flush">
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                  <h3 className="serif-md">Workspaces</h3>
                </div>
                {allWorkspaces.map((w) => {
                  const isStaffWs = w.roles.includes('owner') || w.roles.includes('trainer');
                  const href = isStaffWs ? `/w/${w.id}` : `/home?ws=${w.id}`;
                  return (
                    <Link key={w.id} href={href} className="lux-row lux-row-interactive">
                      <div>
                        <div className="lux-row-title">
                          {w.type === 'personal' ? 'Personal Studio' : w.name}
                        </div>
                        <div className="lux-row-sub">{t(roleKey(w))}</div>
                      </div>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Switch →
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            <div
              className="lux-surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <div className="lux-row-title">Coach or Gym Studio</div>
                <div className="lux-row-sub">
                  Launching a coaching practice or managing a facility?
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {isPlatformAdmin && (
                  <Link href="/admin" className="btn secondary sm">
                    Admin
                  </Link>
                )}
                <Link href="/onboarding" className="btn secondary sm">
                  Open Studio
                </Link>
              </div>
            </div>

            {/* Support, Legal & Privacy (§3.5 & §3.7) */}
            <div className="lux-surface">
              <span className="eyebrow">Support & Privacy</span>
              <h3 className="serif-md" style={{ marginBottom: 14 }}>
                Legal, Feedback & Data Controls
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => {
                    setReportSubmitted(false);
                    setShowReportModal(true);
                  }}
                >
                  Report a Problem
                </button>
                <Link href="/privacy" className="btn ghost sm">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="btn ghost sm">
                  Terms of Use
                </Link>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete Account
                </button>
              </div>
              {deletionScheduled && (
                <p className="msg notice" style={{ marginTop: 12 }}>
                  Your account deletion request has been scheduled.
                </p>
              )}
            </div>

            <div>
              <Form action={signOut} submit={t('common.sign_out')} variant="secondary" />
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add Movement to Saved Routine Day */}
      {pickerModal?.mode === 'routine-day' && (
        <div className="lux-modal-backdrop" onClick={() => setPickerModal(null)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Add Movement to Day</h3>
              <button type="button" className="btn ghost sm" onClick={() => setPickerModal(null)}>
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <input
                className="lux-input"
                placeholder="Search movements…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="lux-surface-flush" style={{ maxHeight: 340, overflowY: 'auto' }}>
                {filteredExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="lux-row lux-row-interactive"
                    onClick={() => {
                      startTransition(async () => {
                        await addExerciseToRoutineDay({
                          workspaceId,
                          dayId: pickerModal.dayId,
                          exerciseId: ex.id,
                          position: pickerModal.nextPos,
                          setsCount: 3,
                          repsMin: 8,
                          repsMax: 12,
                        });
                        setPickerModal(null);
                        router.refresh();
                      });
                    }}
                  >
                    <div>
                      <div className="lux-row-title">{ex.name}</div>
                      <div className="lux-row-sub" style={{ textTransform: 'capitalize' }}>
                        {ex.primary_muscle}
                      </div>
                    </div>
                    <span className="muted" style={{ fontSize: 13 }}>
                      + Add
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Custom Routine */}
      {showNewRoutineModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowNewRoutineModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Create Custom Routine</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowNewRoutineModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <div className="field">
                <label className="lux-label">Routine Name</label>
                <input
                  className="lux-input"
                  placeholder="e.g. Upper Body Power"
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowNewRoutineModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!newRoutineName.trim() || isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await createQuickRoutine({
                        workspaceId,
                        name: newRoutineName.trim(),
                        exercises: [],
                      });
                      setNewRoutineName('');
                      setShowNewRoutineModal(false);
                      router.refresh();
                    });
                  }}
                >
                  Create Routine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Report a Problem (§3.7) */}
      {showReportModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowReportModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Report a Problem</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowReportModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              {reportSubmitted ? (
                <p className="msg notice">
                  Thank you — your report has been logged with our engineering team.
                </p>
              ) : (
                <>
                  <p className="muted">
                    Describe what happened. Your app version (1.0.0) and current screen ({tab}) are
                    attached automatically.
                  </p>
                  <div className="field">
                    <label className="lux-label">Description</label>
                    <input
                      className="lux-input"
                      placeholder="What went wrong?"
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={!reportText.trim() || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await submitProblemReportAction({
                            userId,
                            workspaceId,
                            screen: `member:${tab}`,
                            description: reportText.trim(),
                          });
                          setReportText('');
                          setReportSubmitted(true);
                        });
                      }}
                    >
                      Submit Report
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: In-App Account Deletion (§3.5) */}
      {showDeleteModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Delete Account</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <p className="muted">
                Deleting your account schedules permanent removal of your profile, personal
                workouts, body measurements, progress photos, and push tokens after a 7-day grace
                window.
              </p>
              <div className="field">
                <label className="lux-label">Reason (Optional)</label>
                <input
                  className="lux-input"
                  placeholder="Let us know why you are leaving"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await requestInAppAccountDeletionAction(deleteReason.trim());
                      setDeletionScheduled(true);
                      setShowDeleteModal(false);
                      router.refresh();
                    });
                  }}
                >
                  Confirm Permanent Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="lux-tabbar lux-tabbar-mobile" aria-label="Bottom Navigation">
        <button
          type="button"
          className={`lux-tab ${tab === 'workout' ? 'active' : ''}`}
          onClick={() => setTab('workout')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6.5 6.5 11 11" />
            <path d="m21 21-1-1" />
            <path d="m3 3 1 1" />
            <path d="m18 22 4-4" />
            <path d="m2 6 4-4" />
            <path d="m3 10 7-7" />
            <path d="m14 21 7-7" />
          </svg>
          <span>Workout</span>
        </button>
        <button
          type="button"
          className={`lux-tab ${tab === 'routines' ? 'active' : ''}`}
          onClick={() => setTab('routines')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          <span>Splits</span>
        </button>
        <button
          type="button"
          className={`lux-tab ${tab === 'progress' ? 'active' : ''}`}
          onClick={() => setTab('progress')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          <span>Progress</span>
        </button>
        <button
          type="button"
          className={`lux-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
          </svg>
          <span>History</span>
        </button>
        <button
          type="button"
          className={`lux-tab ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </svg>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
