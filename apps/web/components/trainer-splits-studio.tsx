'use client';

import {
  displayName,
  type Exercise,
  type ProgramAssignment,
  type ProgramDay,
  type RosterEntry,
  SPLIT_TEMPLATES,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  addDayToSplitVersion,
  addExerciseToRoutineDay,
  applySplitTemplate,
  createEditableSplitDraft,
  createMultiDaySplit,
  publishAndAssignSplit,
  removeDayFromSplit,
  removeExerciseFromRoutineDay,
  unassignSplit,
} from '../app/workout-actions';

export interface SplitVersionDetail {
  id: string;
  program_id: string;
  version_number: number;
  status: 'draft' | 'published';
  program: { id: string; name: string; description: string };
  days: ProgramDay[];
}

interface Props {
  workspaceId: string;
  versions: SplitVersionDetail[];
  exercises: Exercise[];
  clients: RosterEntry[];
  assignments: ProgramAssignment[];
  sessions: WorkoutSessionRecord[];
}

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

export function TrainerSplitsStudio({
  workspaceId,
  versions,
  exercises,
  clients,
  assignments,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedVersionId, setSelectedVersionId] = useState<string>(versions[0]?.id ?? '');
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showNewSplitModal, setShowNewSplitModal] = useState(false);

  // New split modal state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDayTitles, setNewDayTitles] = useState<string[]>([
    'Day 1 — Push',
    'Day 2 — Pull',
    'Day 3 — Legs',
  ]);

  // Add day modal state
  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [addDayTitle, setAddDayTitle] = useState('');

  // Add movement modal state
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('all');
  const [setsCount, setSetsCount] = useState('3');
  const [repsMin, setRepsMin] = useState('8');
  const [repsMax, setRepsMax] = useState('12');
  const [supersetGroup, setSupersetGroup] = useState('');

  const activeVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null,
    [versions, selectedVersionId],
  );

  const sortedDays = useMemo(() => {
    if (!activeVersion) return [];
    return [...(activeVersion.days ?? [])].sort(
      (a, b) => a.week_index - b.week_index || a.day_index - b.day_index,
    );
  }, [activeVersion]);

  const activeDay = useMemo(
    () => sortedDays.find((d) => d.id === selectedDayId) ?? sortedDays[0] ?? null,
    [sortedDays, selectedDayId],
  );

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (muscleFilter !== 'all' && ex.primary_muscle !== muscleFilter) return false;
      if (!q) return true;
      return ex.name.toLowerCase().includes(q) || ex.primary_muscle.toLowerCase().includes(q);
    });
  }, [exercises, searchQuery, muscleFilter]);

  const activeAssignmentByMember = useMemo(() => {
    const map = new Map<string, ProgramAssignment>();
    for (const a of assignments) {
      if (a.status === 'active') map.set(a.client_member_id, a);
    }
    return map;
  }, [assignments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
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
          <span className="eyebrow">Program Architecture</span>
          <h1>Split Builder</h1>
          <p className="muted">
            Design multi-day training splits, adopt a curated foundation, and assign to clients.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn secondary" onClick={() => setShowPresetsModal(true)}>
            Curated Splits ({SPLIT_TEMPLATES.length})
          </button>
          <button type="button" className="btn" onClick={() => setShowNewSplitModal(true)}>
            + New Custom Split
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="lux-hero-card">
          <div>
            <span className="eyebrow">Get Started</span>
            <h2 className="serif-lg">Build Your First Training Split</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              Clone a curated Push / Pull / Legs or Upper / Lower template in one click, or design a
              custom split from scratch.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn" onClick={() => setShowPresetsModal(true)}>
              Browse Curated Splits
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setShowNewSplitModal(true)}
            >
              + New Custom Split
            </button>
          </div>
        </div>
      ) : (
        <div className="lux-split-layout">
          {/* Left Rail: Workspace Splits */}
          <div className="lux-surface-flush">
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
              <span className="lux-label">Workspace Splits ({versions.length})</span>
            </div>
            <div className="lux-list">
              {versions.map((ver) => {
                const isSelected = activeVersion?.id === ver.id;
                const assignedCount = clients.filter(
                  (c) => activeAssignmentByMember.get(c.id)?.program_version_id === ver.id,
                ).length;
                return (
                  <div
                    key={ver.id}
                    className="lux-row lux-row-interactive"
                    onClick={() => {
                      setSelectedVersionId(ver.id);
                      setSelectedDayId('');
                    }}
                    style={
                      isSelected
                        ? {
                            background: 'var(--accent-soft)',
                            borderLeft: '3px solid var(--accent)',
                          }
                        : undefined
                    }
                  >
                    <div>
                      <div className="lux-row-title">{ver.program.name}</div>
                      <div className="lux-row-sub">
                        {ver.days.length} days ·{' '}
                        {ver.status === 'published' ? 'Published' : 'Draft'}
                      </div>
                    </div>
                    {assignedCount > 0 && (
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {assignedCount} client{assignedCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Detail Pane: Active Split Studio */}
          {activeVersion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="lux-surface">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    paddingBottom: 20,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <span className="eyebrow">
                      {activeVersion.status === 'published'
                        ? `Published · v${activeVersion.version_number}`
                        : `Editable Draft · v${activeVersion.version_number}`}
                    </span>
                    <h2 className="serif-lg">{activeVersion.program.name}</h2>
                    {activeVersion.program.description && (
                      <p className="muted" style={{ marginTop: 4 }}>
                        {activeVersion.program.description}
                      </p>
                    )}
                  </div>

                  <div>
                    {activeVersion.status === 'published' && (
                      <button
                        type="button"
                        className="btn secondary sm"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            await createEditableSplitDraft(workspaceId, activeVersion.program_id);
                            router.refresh();
                          });
                        }}
                      >
                        Create Editable Draft
                      </button>
                    )}
                  </div>
                </div>

                {/* Horizontal Day Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    paddingTop: 20,
                  }}
                >
                  <div className="lux-pills">
                    {sortedDays.map((day, idx) => (
                      <button
                        key={day.id}
                        type="button"
                        className={`lux-pill ${activeDay?.id === day.id ? 'active' : ''}`}
                        onClick={() => setSelectedDayId(day.id)}
                      >
                        Day {idx + 1}: {day.title}
                      </button>
                    ))}
                    {activeVersion.status === 'draft' && (
                      <button
                        type="button"
                        className="lux-pill"
                        onClick={() => {
                          setAddDayTitle(`Day ${sortedDays.length + 1}`);
                          setShowAddDayModal(true);
                        }}
                      >
                        + Add Day
                      </button>
                    )}
                  </div>

                  {activeDay && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {activeVersion.status === 'draft' && sortedDays.length > 1 && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await removeDayFromSplit(workspaceId, activeDay.id);
                              setSelectedDayId('');
                              router.refresh();
                            });
                          }}
                        >
                          Remove Day
                        </button>
                      )}
                      {activeVersion.status === 'draft' && (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            setSearchQuery('');
                            setMuscleFilter('all');
                            setShowMovementModal(true);
                          }}
                        >
                          + Add Movement
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Active Day Movements Table */}
                {activeDay && (
                  <div style={{ marginTop: 24 }}>
                    {(activeDay.items ?? []).length === 0 ? (
                      <div className="empty" style={{ padding: '36px 24px' }}>
                        <p className="muted" style={{ marginBottom: 14 }}>
                          No movements scheduled on {activeDay.title} yet.
                        </p>
                        {activeVersion.status === 'draft' && (
                          <button
                            type="button"
                            className="btn secondary sm"
                            onClick={() => {
                              setSearchQuery('');
                              setMuscleFilter('all');
                              setShowMovementModal(true);
                            }}
                          >
                            + Add Movement
                          </button>
                        )}
                      </div>
                    ) : (
                      <table className="lux-set-table">
                        <thead>
                          <tr>
                            <th style={{ width: 44 }}>#</th>
                            <th>Movement</th>
                            <th style={{ width: 140 }}>Sets × Reps</th>
                            <th style={{ width: 100 }}>Rest</th>
                            <th style={{ width: 80, textAlign: 'right' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {[...(activeDay.items ?? [])]
                            .sort((a, b) => a.position - b.position)
                            .map((item, idx) => (
                              <tr key={item.id}>
                                <td className="mono muted">{idx + 1}</td>
                                <td>
                                  <div style={{ fontWeight: 500 }}>
                                    {item.exercise?.name ?? 'Movement'}
                                  </div>
                                  {item.superset_group && (
                                    <span className="lux-tag subtle">
                                      Superset {item.superset_group}
                                    </span>
                                  )}
                                </td>
                                <td className="mono">
                                  {item.sets_count} ×{' '}
                                  {item.target_duration_s
                                    ? `${item.target_duration_s}s`
                                    : `${item.target_reps_min ?? 8}–${item.target_reps_max ?? 12}`}
                                </td>
                                <td className="mono muted">{item.rest_seconds}s</td>
                                <td style={{ textAlign: 'right' }}>
                                  {activeVersion.status === 'draft' && (
                                    <button
                                      type="button"
                                      className="btn ghost sm"
                                      disabled={isPending}
                                      onClick={() => {
                                        startTransition(async () => {
                                          await removeExerciseFromRoutineDay(item.id, workspaceId);
                                          router.refresh();
                                        });
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Client Assignment Card */}
              <div className="lux-surface">
                <span className="eyebrow">Client Roster Assignment</span>
                <h3 className="serif-md" style={{ marginBottom: 6 }}>
                  Assign {activeVersion.program.name}
                </h3>
                <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
                  Click any client below to assign or unassign this split. Draft splits are
                  automatically published when assigned.
                </p>

                {clients.length === 0 ? (
                  <p className="muted">No clients in workspace yet.</p>
                ) : (
                  <div className="lux-pills">
                    {clients.map((client) => {
                      const current = activeAssignmentByMember.get(client.id);
                      const isAssignedHere = current?.program_version_id === activeVersion.id;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          disabled={isPending}
                          className={`lux-pill ${isAssignedHere ? 'active' : ''}`}
                          onClick={() => {
                            startTransition(async () => {
                              if (isAssignedHere && current) {
                                await unassignSplit(workspaceId, current.id);
                              } else {
                                await publishAndAssignSplit({
                                  workspaceId,
                                  versionId: activeVersion.id,
                                  isDraft: activeVersion.status === 'draft',
                                  clientMemberId: client.id,
                                });
                              }
                              router.refresh();
                            });
                          }}
                        >
                          {isAssignedHere ? '✓ ' : '+ '}
                          {displayName(client)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Curated Splits Library */}
      {showPresetsModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowPresetsModal(false)}>
          <div className="lux-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Curated Split Architecture</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowPresetsModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <p className="muted">
                Clone any foundation split into your workspace to customize movements or assign
                directly to clients.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SPLIT_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <span className="eyebrow" style={{ marginBottom: 2 }}>
                        {tpl.daysPerWeek} Days / Wk · {tpl.tag}
                      </span>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{tpl.name}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                        {tpl.days.map((d) => d.title).join('  ·  ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn sm"
                      style={{ flexShrink: 0 }}
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await applySplitTemplate({
                            workspaceId,
                            templateId: tpl.id,
                            publish: true,
                          });
                          setShowPresetsModal(false);
                          router.refresh();
                        });
                      }}
                    >
                      Use Split
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Custom Multi-Day Split */}
      {showNewSplitModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowNewSplitModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">New Custom Split</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowNewSplitModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <div className="field">
                <label className="lux-label">Split Name</label>
                <input
                  className="lux-input"
                  placeholder="e.g. 4-Day Athletic Hypertrophy"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="lux-label">Description</label>
                <input
                  className="lux-input"
                  placeholder="Optional coaching focus or notes"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="lux-label">Training Days</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newDayTitles.map((dt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="lux-input"
                        style={{ flex: 1 }}
                        value={dt}
                        onChange={(e) => {
                          const next = [...newDayTitles];
                          next[idx] = e.target.value;
                          setNewDayTitles(next);
                        }}
                      />
                      {newDayTitles.length > 1 && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setNewDayTitles(newDayTitles.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      setNewDayTitles([...newDayTitles, `Day ${newDayTitles.length + 1}`])
                    }
                  >
                    + Add Another Day
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowNewSplitModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!newName.trim() || isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await createMultiDaySplit({
                        workspaceId,
                        name: newName.trim(),
                        description: newDesc.trim(),
                        days: newDayTitles.map((title) => ({ title, items: [] })),
                        publish: false,
                      });
                      setNewName('');
                      setNewDesc('');
                      setShowNewSplitModal(false);
                      router.refresh();
                    });
                  }}
                >
                  Create Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Day to Split */}
      {showAddDayModal && activeVersion && (
        <div className="lux-modal-backdrop" onClick={() => setShowAddDayModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Add Training Day</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowAddDayModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <div className="field">
                <label className="lux-label">Day Title</label>
                <input
                  className="lux-input"
                  value={addDayTitle}
                  onChange={(e) => setAddDayTitle(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={!addDayTitle.trim() || isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await addDayToSplitVersion({
                        workspaceId,
                        versionId: activeVersion.id,
                        dayIndex: sortedDays.length + 1,
                        title: addDayTitle.trim(),
                      });
                      setShowAddDayModal(false);
                      router.refresh();
                    });
                  }}
                >
                  Add Day
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Movement to Active Day */}
      {showMovementModal && activeDay && (
        <div className="lux-modal-backdrop" onClick={() => setShowMovementModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Add Movement to {activeDay.title}</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowMovementModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div>
                  <label className="lux-label">Sets</label>
                  <input
                    className="lux-input mono"
                    style={{ width: '100%', marginTop: 4 }}
                    value={setsCount}
                    onChange={(e) => setSetsCount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lux-label">Min Reps</label>
                  <input
                    className="lux-input mono"
                    style={{ width: '100%', marginTop: 4 }}
                    value={repsMin}
                    onChange={(e) => setRepsMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lux-label">Max Reps</label>
                  <input
                    className="lux-input mono"
                    style={{ width: '100%', marginTop: 4 }}
                    value={repsMax}
                    onChange={(e) => setRepsMax(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lux-label">Superset</label>
                  <input
                    className="lux-input mono"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="A / B"
                    value={supersetGroup}
                    onChange={(e) => setSupersetGroup(e.target.value)}
                  />
                </div>
              </div>

              <input
                className="lux-input"
                placeholder="Search movements…"
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

              <div className="lux-surface-flush" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {filteredExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="lux-row lux-row-interactive"
                    onClick={() => {
                      startTransition(async () => {
                        await addExerciseToRoutineDay({
                          workspaceId,
                          dayId: activeDay.id,
                          exerciseId: ex.id,
                          position: (activeDay.items?.length ?? 0) + 1,
                          setsCount: Number(setsCount) || 3,
                          repsMin: Number(repsMin) || 8,
                          repsMax: Number(repsMax) || 12,
                          supersetGroup: supersetGroup.trim() || undefined,
                        });
                        setShowMovementModal(false);
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
    </div>
  );
}
