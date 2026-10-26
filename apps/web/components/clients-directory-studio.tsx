'use client';

import {
  type ClientRecord,
  daysUntilMembershipExpiry,
  displayName,
  formatDate,
  type GymMembershipRecord,
  type GymMembershipStatus,
  type MeasurementDefinition,
  type MeasurementEntry,
  type PendingInvitation,
  pickNextProgramDay,
  type ProgramAssignment,
  type RosterEntry,
  type StreakRecord,
  summarizeSession,
  t,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  addPerson,
  deletePerson,
  invite,
  removeMember,
  restoreMember,
  revokeInvitation,
} from '../app/actions';
import {
  pauseClientStreakAction,
  publishAndAssignSplit,
  toggleTrainerAssignment,
  unassignSplit,
  upsertGymMembershipAction,
} from '../app/workout-actions';
import { Form } from './form';
import { MeasurementsPanel } from './measurements-panel';
import type { SplitVersionDetail } from './trainer-splits-studio';

interface TrainerLink {
  assignmentId: string;
  trainer: RosterEntry;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  isGym: boolean;
  isOwner: boolean;
  initialClientId?: string;
  members: RosterEntry[];
  trainers: RosterEntry[];
  trainerLinksByMember: Record<string, TrainerLink[]>;
  invitations: PendingInvitation[];
  records: ClientRecord[];
  archived: RosterEntry[];
  assignments: ProgramAssignment[];
  sessions: WorkoutSessionRecord[];
  versions: SplitVersionDetail[];
  gymMemberships: GymMembershipRecord[];
  measurementDefinitions: MeasurementDefinition[];
  measurementEntriesByUser: Record<string, MeasurementEntry[]>;
  streaks: StreakRecord[];
}

function countLast7Days(sessions: WorkoutSessionRecord[]): number {
  const cutoff = new Date().getTime() - 7 * 86_400_000;
  return sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff).length;
}

export function ClientsDirectoryStudio({
  workspaceId,
  workspaceName,
  isGym,
  isOwner,
  initialClientId,
  members,
  trainers,
  trainerLinksByMember,
  invitations,
  records,
  archived,
  assignments,
  sessions,
  versions,
  gymMemberships,
  measurementDefinitions,
  measurementEntriesByUser,
  streaks,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<'roster' | 'invites'>('roster');
  const [dossierTab, setDossierTab] = useState<'overview' | 'measurements'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(
    initialClientId && members.some((m) => m.id === initialClientId)
      ? initialClientId
      : (members[0]?.id ?? ''),
  );
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  // Membership editor state
  const [planLabel, setPlanLabel] = useState('Monthly Membership');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [membershipStatus, setMembershipStatus] = useState<GymMembershipStatus>('active');

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => displayName(m).toLowerCase().includes(q));
  }, [members, searchQuery]);

  const selectedClient = useMemo(
    () =>
      filteredMembers.find((m) => m.id === selectedId) ??
      members.find((m) => m.id === selectedId) ??
      filteredMembers[0] ??
      null,
    [filteredMembers, members, selectedId],
  );

  const membershipByMemberId = useMemo(
    () => new Map(gymMemberships.map((gm) => [gm.member_id, gm])),
    [gymMemberships],
  );

  const streakByUserId = useMemo(() => new Map(streaks.map((st) => [st.user_id, st])), [streaks]);

  const activeAssignmentByMember = useMemo(() => {
    const map = new Map<string, ProgramAssignment>();
    for (const a of assignments) {
      if (a.status === 'active') map.set(a.client_member_id, a);
    }
    return map;
  }, [assignments]);

  const clientSessions = useMemo(() => {
    if (!selectedClient) return [];
    return sessions.filter((s) => s.user_id === selectedClient.user_id && s.status === 'completed');
  }, [selectedClient, sessions]);

  const clientStats = useMemo(() => {
    let volume = 0;
    let prs = 0;
    for (const s of clientSessions) {
      const sum = summarizeSession(s.exercises ?? []);
      volume += sum.totalVolumeKg;
      prs += sum.prsEarned;
    }
    return {
      totalSessions: clientSessions.length,
      weekSessions: countLast7Days(clientSessions),
      volume: Math.round(volume),
      prs,
    };
  }, [clientSessions]);

  const selectedAssignment = selectedClient
    ? (activeAssignmentByMember.get(selectedClient.id) ?? null)
    : null;

  const selectedVersion = useMemo(() => {
    if (!selectedAssignment) return null;
    return versions.find((v) => v.id === selectedAssignment.program_version_id) ?? null;
  }, [selectedAssignment, versions]);

  const nextDay = useMemo(
    () =>
      pickNextProgramDay(selectedVersion?.days ?? [], clientSessions[0]?.program_day_id ?? null),
    [selectedVersion, clientSessions],
  );

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
          <span className="eyebrow">{workspaceName}</span>
          <h1>{isGym && isOwner ? 'Members & Clients' : 'Client Roster'}</h1>
          <p className="muted">
            Select a client to inspect their split progress, personal records, and session history.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="lux-pills">
            <button
              type="button"
              className={`lux-pill ${view === 'roster' ? 'active' : ''}`}
              onClick={() => setView('roster')}
            >
              Active Roster ({members.length})
            </button>
            <button
              type="button"
              className={`lux-pill ${view === 'invites' ? 'active' : ''}`}
              onClick={() => setView('invites')}
            >
              Invitations & Leads ({invitations.length + records.length})
            </button>
          </div>

          <button type="button" className="btn" onClick={() => setShowInviteModal(true)}>
            + Invite Client
          </button>
        </div>
      </div>

      {/* ─── VIEW 1: ACTIVE ROSTER (Master-Detail Dossier) ─── */}
      {view === 'roster' && (
        <>
          {members.length === 0 ? (
            <div className="empty">
              <h3 className="serif-md" style={{ marginBottom: 6 }}>
                No active clients yet
              </h3>
              <p className="muted" style={{ marginBottom: 20 }}>
                Invite a client by email so they can receive splits and log workouts.
              </p>
              <button type="button" className="btn" onClick={() => setShowInviteModal(true)}>
                + Invite Client
              </button>
            </div>
          ) : (
            <div className="lux-split-layout">
              {/* Left Rail: Client List with Search (§3.3) */}
              <div className="lux-surface-flush">
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span className="lux-label">Clients ({filteredMembers.length})</span>
                  <input
                    className="lux-input"
                    style={{ minHeight: 34, fontSize: 13 }}
                    placeholder="Search client name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="lux-list">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedClient?.id === m.id;
                    const plan = activeAssignmentByMember.get(m.id);
                    const gm = membershipByMemberId.get(m.id);
                    const daysLeft = gm ? daysUntilMembershipExpiry(gm.end_date) : null;
                    const mSessions = sessions.filter(
                      (s) => s.user_id === m.user_id && s.status === 'completed',
                    );
                    const wk = countLast7Days(mSessions);
                    return (
                      <div
                        key={m.id}
                        className="lux-row lux-row-interactive"
                        onClick={() => setSelectedId(m.id)}
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
                          <div className="lux-row-title">{displayName(m)}</div>
                          <div className="lux-row-sub">
                            {plan?.program_version?.program?.name ?? 'No split assigned'}
                            {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0
                              ? ` · Renews in ${daysLeft}d`
                              : ''}
                          </div>
                        </div>
                        <span className="mono muted" style={{ fontSize: 12 }}>
                          {wk}/wk
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Detail Pane: Client Dossier */}
              {selectedClient && (
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
                        <span className="eyebrow">Client Dossier</span>
                        <h2 className="serif-lg">{displayName(selectedClient)}</h2>
                        <p className="muted" style={{ fontSize: 13.5 }}>
                          Joined {formatDate(selectedClient.joined_at)}
                        </p>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                      >
                        {/* Dossier Sub-Tabs */}
                        <div className="lux-pills">
                          <button
                            type="button"
                            className={`lux-pill ${dossierTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setDossierTab('overview')}
                          >
                            Split & Adherence
                          </button>
                          <button
                            type="button"
                            className={`lux-pill ${dossierTab === 'measurements' ? 'active' : ''}`}
                            onClick={() => setDossierTab('measurements')}
                          >
                            Body Measurements (
                            {(measurementEntriesByUser[selectedClient.user_id] ?? []).length})
                          </button>
                        </div>

                        {/* Streak Pause Control (§3.8) */}
                        {(() => {
                          const stRow = streakByUserId.get(selectedClient.user_id);
                          const isPaused = Boolean(
                            stRow?.paused_until &&
                            stRow.paused_until >= new Date().toISOString().slice(0, 10),
                          );
                          return (
                            <button
                              type="button"
                              className={`lux-pill ${isPaused ? 'active' : ''}`}
                              disabled={isPending}
                              onClick={() => {
                                startTransition(async () => {
                                  const nextDate = new Date();
                                  nextDate.setDate(nextDate.getDate() + 14);
                                  await pauseClientStreakAction({
                                    workspaceId,
                                    userId: selectedClient.user_id,
                                    pausedUntil: isPaused
                                      ? null
                                      : nextDate.toISOString().slice(0, 10),
                                    reason: isPaused ? '' : 'Coach pause (travel / recovery)',
                                  });
                                  router.refresh();
                                });
                              }}
                            >
                              {isPaused ? '⏸ Streak Paused (Resume)' : 'Pause Streak'}
                            </button>
                          );
                        })()}

                        {isOwner && (
                          <Form
                            inline
                            action={removeMember}
                            variant="ghost"
                            submit="Archive Client"
                            confirm={t('people.remove_confirm', {
                              name: displayName(selectedClient),
                              workspace: workspaceName,
                            })}
                            hidden={{ workspaceId, memberId: selectedClient.id }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Client Key Metrics */}
                    <div className="lux-stats-row" style={{ marginTop: 20, marginBottom: 0 }}>
                      <div className="lux-stat" style={{ background: 'var(--bg)' }}>
                        <span className="lux-stat-label">Active Split</span>
                        <span className="serif-md" style={{ marginTop: 2 }}>
                          {selectedAssignment?.program_version?.program?.name ?? 'Unassigned'}
                        </span>
                        <span className="lux-stat-sub">
                          {nextDay ? `Next: ${nextDay.title}` : 'Assign a split below'}
                        </span>
                      </div>

                      <div className="lux-stat" style={{ background: 'var(--bg)' }}>
                        <span className="lux-stat-label">Last 7 Days</span>
                        <span className="lux-stat-value mono">{clientStats.weekSessions}</span>
                        <span className="lux-stat-sub">
                          {clientStats.totalSessions} total sessions
                        </span>
                      </div>

                      <div className="lux-stat" style={{ background: 'var(--bg)' }}>
                        <span className="lux-stat-label">Volume & PRs</span>
                        <span className="lux-stat-value mono">
                          {clientStats.volume.toLocaleString()}{' '}
                          <small style={{ fontSize: 13 }}>kg</small>
                        </span>
                        <span className="lux-stat-sub">{clientStats.prs} personal records</span>
                      </div>
                    </div>
                  </div>

                  {dossierTab === 'measurements' ? (
                    <MeasurementsPanel
                      subjectUserId={selectedClient.user_id}
                      workspaceId={workspaceId}
                      unitSystem="metric"
                      definitions={measurementDefinitions}
                      entries={measurementEntriesByUser[selectedClient.user_id] ?? []}
                      subjectLabel={displayName(selectedClient)}
                    />
                  ) : (
                    <>
                      {/* Physical Gym Membership Card for Gym Owners (§3.3) */}
                      {isGym && isOwner && (
                        <div className="lux-surface">
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
                              <span className="eyebrow">Facility Access</span>
                              <h3 className="serif-md">Physical Gym Membership</h3>
                              {(() => {
                                const gm = membershipByMemberId.get(selectedClient.id);
                                if (!gm) {
                                  return (
                                    <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                                      No physical membership dates recorded yet.
                                    </p>
                                  );
                                }
                                const days = daysUntilMembershipExpiry(gm.end_date);
                                return (
                                  <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                                    <strong>{gm.plan_label}</strong> · {gm.start_date.slice(0, 10)}{' '}
                                    to {gm.end_date.slice(0, 10)} ·{' '}
                                    <span className="mono">
                                      {days >= 0 ? `${days} days remaining` : 'Expired'}
                                    </span>
                                  </p>
                                );
                              })()}
                            </div>

                            <button
                              type="button"
                              className="btn secondary sm"
                              onClick={() => {
                                const gm = membershipByMemberId.get(selectedClient.id);
                                if (gm) {
                                  setPlanLabel(gm.plan_label);
                                  setStartDate(gm.start_date.slice(0, 10));
                                  setEndDate(gm.end_date.slice(0, 10));
                                  setMembershipStatus(gm.status);
                                }
                                setShowMembershipModal(true);
                              }}
                            >
                              Update Membership
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Split Assignment & Split Day Adherence */}
                      <div className="lux-surface">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexWrap: 'wrap',
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <span className="eyebrow">Program Assignment</span>
                            <h3 className="serif-md">Assigned Training Split</h3>
                          </div>

                          {selectedAssignment && (
                            <button
                              type="button"
                              className="btn ghost sm"
                              disabled={isPending}
                              onClick={() => {
                                startTransition(async () => {
                                  await unassignSplit(workspaceId, selectedAssignment.id);
                                  router.refresh();
                                });
                              }}
                            >
                              Unassign Split
                            </button>
                          )}
                        </div>

                        {versions.length > 0 && (
                          <div className="lux-pills" style={{ marginBottom: 20 }}>
                            {versions.map((ver) => {
                              const isCurrent = selectedAssignment?.program_version_id === ver.id;
                              return (
                                <button
                                  key={ver.id}
                                  type="button"
                                  disabled={isPending}
                                  className={`lux-pill ${isCurrent ? 'active' : ''}`}
                                  onClick={() => {
                                    if (isCurrent) return;
                                    startTransition(async () => {
                                      await publishAndAssignSplit({
                                        workspaceId,
                                        versionId: ver.id,
                                        isDraft: ver.status === 'draft',
                                        clientMemberId: selectedClient.id,
                                      });
                                      router.refresh();
                                    });
                                  }}
                                >
                                  {isCurrent ? '✓ ' : 'Assign: '}
                                  {ver.program.name}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selectedVersion && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                              gap: 12,
                            }}
                          >
                            {selectedVersion.days.map((day, idx) => {
                              const completedForDay = clientSessions.filter(
                                (s) => s.program_day_id === day.id,
                              );
                              const isNext = nextDay?.id === day.id;
                              return (
                                <div
                                  key={day.id}
                                  style={{
                                    background: 'var(--bg)',
                                    border: isNext
                                      ? '1px solid var(--accent)'
                                      : '1px solid var(--border)',
                                    borderRadius: 10,
                                    padding: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span className="eyebrow" style={{ marginBottom: 0 }}>
                                      Day {idx + 1}
                                    </span>
                                    {isNext && <span className="lux-tag">Up Next</span>}
                                  </div>
                                  <div style={{ fontWeight: 500, fontSize: 14 }}>{day.title}</div>
                                  <div
                                    className="mono muted"
                                    style={{ fontSize: 12, marginTop: 6 }}
                                  >
                                    Completed {completedForDay.length}×
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Gym Owner Trainer Assignment */}
                      {isGym && isOwner && trainers.length > 0 && (
                        <div className="lux-surface">
                          <span className="eyebrow">Coaching Staff</span>
                          <h3 className="serif-md" style={{ marginBottom: 14 }}>
                            Assigned Trainer
                          </h3>
                          <div className="lux-pills">
                            {trainers.map((tr) => {
                              const existing = (trainerLinksByMember[selectedClient.id] ?? []).find(
                                (l) => l.trainer.id === tr.id,
                              );
                              return (
                                <button
                                  key={tr.id}
                                  type="button"
                                  disabled={isPending}
                                  className={`lux-pill ${existing ? 'active' : ''}`}
                                  onClick={() => {
                                    startTransition(async () => {
                                      await toggleTrainerAssignment({
                                        workspaceId,
                                        clientMemberId: selectedClient.id,
                                        trainerMemberId: tr.id,
                                        existingAssignmentId: existing?.assignmentId,
                                      });
                                      router.refresh();
                                    });
                                  }}
                                >
                                  {existing ? '✓ ' : 'Assign: '}
                                  {displayName(tr)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Client Recent Sessions */}
                      <div className="lux-surface-flush">
                        <div
                          style={{
                            padding: '18px 24px',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <h3 className="serif-md">Recent Sessions ({clientSessions.length})</h3>
                        </div>
                        {clientSessions.length === 0 ? (
                          <div style={{ padding: 24 }} className="muted">
                            No sessions logged by {displayName(selectedClient)} yet.
                          </div>
                        ) : (
                          <div className="lux-list">
                            {clientSessions.slice(0, 6).map((s) => {
                              const sum = summarizeSession(s.exercises ?? []);
                              return (
                                <div key={s.id} className="lux-row">
                                  <div>
                                    <div className="lux-row-title">{s.title}</div>
                                    <div className="lux-row-sub">
                                      {new Date(s.started_at).toLocaleDateString(undefined, {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                      })}{' '}
                                      · {sum.completedSets} sets
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {sum.prsEarned > 0 && (
                                      <span className="lux-tag pr">{sum.prsEarned} PR</span>
                                    )}
                                    <span className="mono muted" style={{ fontSize: 13 }}>
                                      {Math.round(sum.totalVolumeKg).toLocaleString()} kg
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── VIEW 2: INVITATIONS & LEADS ─── */}
      {view === 'invites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="lux-surface-flush">
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 className="serif-md">Pending Invitations ({invitations.length})</h3>
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => setShowInviteModal(true)}
              >
                + Send Invite
              </button>
            </div>
            {invitations.length === 0 ? (
              <div style={{ padding: 24 }} className="muted">
                No pending invitations.
              </div>
            ) : (
              <div className="lux-list">
                {invitations.map((inv) => (
                  <div key={inv.id} className="lux-row">
                    <div>
                      <div className="lux-row-title">
                        {inv.email ?? t('people.open_invite_label')}
                      </div>
                      <div className="lux-row-sub">
                        {t('invitation.expires', { date: formatDate(inv.expires_at) })}
                      </div>
                    </div>
                    <Form
                      inline
                      action={revokeInvitation}
                      variant="ghost"
                      submit="Revoke"
                      hidden={{ invitationId: inv.id }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lux-surface-flush">
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 className="serif-md">Prospective Leads ({records.length})</h3>
              </div>
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => setShowAddLeadModal(true)}
              >
                + Add Lead
              </button>
            </div>
            {records.length === 0 ? (
              <div style={{ padding: 24 }} className="muted">
                Keep track of prospective clients before sending them an app invite.
              </div>
            ) : (
              <div className="lux-list">
                {records.map((r) => (
                  <div key={r.id} className="lux-row">
                    <div>
                      <div className="lux-row-title">{r.display_name}</div>
                      <div className="lux-row-sub">
                        {[r.email, r.phone].filter(Boolean).join(' · ') || 'No email on file'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Form
                        inline
                        action={invite}
                        variant="secondary"
                        submit="Send Invite"
                        hidden={{
                          workspaceId,
                          role: 'member',
                          email: r.email ?? '',
                          clientRecordId: r.id,
                        }}
                      />
                      <Form
                        inline
                        action={deletePerson}
                        variant="ghost"
                        submit="Remove"
                        hidden={{ recordId: r.id }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isOwner && archived.length > 0 && (
            <div className="lux-surface-flush">
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 className="serif-md">Archived Clients ({archived.length})</h3>
              </div>
              <div className="lux-list">
                {archived.map((m) => (
                  <div key={m.id} className="lux-row">
                    <div className="lux-row-title">{displayName(m)}</div>
                    <Form
                      inline
                      action={restoreMember}
                      variant="secondary"
                      submit="Restore"
                      hidden={{ workspaceId, memberId: m.id }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Invite Client */}
      {showInviteModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Invite Client to {workspaceName}</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowInviteModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <p className="muted">
                Enter your client’s email address to generate an invitation link.
              </p>
              <Form
                action={invite}
                submit="Send Invitation"
                hidden={{ workspaceId, role: 'member' }}
                fields={[{ name: 'email', label: 'Client Email', type: 'email' }]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Lead */}
      {showAddLeadModal && (
        <div className="lux-modal-backdrop" onClick={() => setShowAddLeadModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Add Prospective Client</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowAddLeadModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <Form
                action={addPerson}
                submit="Save Lead"
                hidden={{ workspaceId }}
                fields={[
                  { name: 'displayName', label: 'Full Name' },
                  { name: 'email', label: 'Email (Optional)', type: 'email' },
                  { name: 'phone', label: 'Phone (Optional)', type: 'tel' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Physical Gym Membership (§3.3) */}
      {showMembershipModal && selectedClient && (
        <div className="lux-modal-backdrop" onClick={() => setShowMembershipModal(false)}>
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lux-modal-header">
              <h3 className="serif-md">Physical Membership · {displayName(selectedClient)}</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowMembershipModal(false)}
              >
                Close
              </button>
            </div>
            <div className="lux-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  <span>Plan Label</span>
                  <input
                    value={planLabel}
                    onChange={(e) => setPlanLabel(e.target.value)}
                    placeholder="e.g., Annual All-Access, 3-Month Pass"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Start Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>End Date</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Status</span>
                  <select
                    value={membershipStatus}
                    onChange={(e) =>
                      setMembershipStatus(
                        e.target.value as 'active' | 'paused' | 'expired' | 'cancelled',
                      )
                    }
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setShowMembershipModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={isPending || !planLabel.trim()}
                    onClick={() => {
                      startTransition(async () => {
                        await upsertGymMembershipAction({
                          workspaceId,
                          memberId: selectedClient.id,
                          planLabel: planLabel.trim(),
                          startDate,
                          endDate,
                          status: membershipStatus,
                        });
                        setShowMembershipModal(false);
                        router.refresh();
                      });
                    }}
                  >
                    {isPending ? 'Saving...' : 'Save Membership'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
