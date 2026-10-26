'use client';

import {
  daysUntilMembershipExpiry,
  displayName,
  type Exercise,
  filterExpiringMemberships,
  type GymMembershipRecord,
  type HighFiveRecord,
  isStaff,
  type MeasurementDefinition,
  type MeasurementEntry,
  type PendingInvitation,
  type ProgramAssignment,
  roleKey,
  type RosterEntry,
  summarizeSession,
  t,
  type WorkoutSessionRecord,
  type WorkspaceAccess,
} from '@gravn/shared';
import Link from 'next/link';
import { useState } from 'react';

import { invite, removeMember, renameWorkspace, toggleOwnerTrainer } from '../app/actions';
import { signOut } from '../app/(auth)/actions';
import { ActivityFeedStudio } from './activity-feed-studio';
import { ClientsDirectoryStudio } from './clients-directory-studio';
import { Form } from './form';
import { type SplitVersionDetail, TrainerSplitsStudio } from './trainer-splits-studio';
import { EmptyState, Section, Wordmark } from './ui';

type StaffTab = 'overview' | 'members' | 'programs' | 'activity' | 'more';

interface Props {
  workspace: WorkspaceAccess;
  otherWorkspaces: WorkspaceAccess[];
  isOwner: boolean;
  isPlatformAdmin: boolean;
  currentUserId: string;
  initialTab?: StaffTab;
  initialClientId?: string;
  members: RosterEntry[];
  trainers: RosterEntry[];
  trainerLinksByMember: Record<string, { assignmentId: string; trainer: RosterEntry }[]>;
  invitations: PendingInvitation[];
  records: { id: string; display_name: string; email: string | null; phone: string | null }[];
  archived: RosterEntry[];
  assignments: ProgramAssignment[];
  sessions: WorkoutSessionRecord[];
  versions: SplitVersionDetail[];
  exercises: Exercise[];
  gymMemberships: GymMembershipRecord[];
  measurementDefinitions: MeasurementDefinition[];
  measurementEntriesByUser: Record<string, MeasurementEntry[]>;
  streaks: {
    id: string;
    user_id: string;
    workspace_id: string;
    weekly_target: number;
    current_weeks: number;
    best_weeks: number;
    freezes_available: number;
    paused_until: string | null;
    paused_reason: string;
  }[];
  highFives: HighFiveRecord[];
}

export function StaffStudio({
  workspace,
  otherWorkspaces,
  isOwner,
  isPlatformAdmin,
  currentUserId,
  initialTab = 'overview',
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
  exercises,
  gymMemberships,
  measurementDefinitions,
  measurementEntriesByUser,
  streaks,
  highFives,
}: Props) {
  const [tab, setTab] = useState<StaffTab>(initialClientId ? 'members' : initialTab);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(initialClientId);

  const isGym = workspace.type === 'gym';
  const isTrainer = workspace.roles.includes('trainer');

  const assignedMemberIds = new Set(
    assignments.filter((a) => a.status === 'active').map((a) => a.client_member_id),
  );
  const assignedCount = members.filter((m) => assignedMemberIds.has(m.id)).length;
  const withoutPlanCount = members.length - assignedCount;

  const [weekAgoIso] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString());
  const sessionsThisWeekTotal = sessions.filter(
    (s) => s.status === 'completed' && s.started_at >= weekAgoIso,
  ).length;

  const recentSessions = sessions.filter((s) => s.status === 'completed').slice(0, 5);
  const expiring7 = filterExpiringMemberships(gymMemberships, 7);
  const expiring30 = filterExpiringMemberships(gymMemberships, 30);

  function openClient(memberId: string) {
    setSelectedClientId(memberId);
    setTab('members');
  }

  return (
    <div className="dashboard">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wordmark />
          <div className="sidebar-ws-name">{workspace.name}</div>
          <div className="sidebar-ws-role">{t(roleKey(workspace))}</div>
        </div>

        <nav aria-label="Workspace">
          <button
            type="button"
            className={`sidebar-tab-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`sidebar-tab-btn ${tab === 'members' ? 'active' : ''}`}
            onClick={() => setTab('members')}
          >
            {workspace.type === 'coach' || !isOwner ? 'Clients' : 'Members & Clients'}
          </button>
          <button
            type="button"
            className={`sidebar-tab-btn ${tab === 'programs' ? 'active' : ''}`}
            onClick={() => setTab('programs')}
          >
            Splits & Programs
          </button>
          <button
            type="button"
            className={`sidebar-tab-btn ${tab === 'activity' ? 'active' : ''}`}
            onClick={() => setTab('activity')}
          >
            Activity Feed
          </button>
          {isOwner && (
            <button
              type="button"
              className={`sidebar-tab-btn ${tab === 'more' ? 'active' : ''}`}
              onClick={() => setTab('more')}
            >
              Staff & Settings
            </button>
          )}
        </nav>

        {otherWorkspaces.length > 0 && (
          <nav aria-label="Switch Space">
            {otherWorkspaces.map((w) => (
              <Link key={w.id} href={isStaff(w) ? `/w/${w.id}` : `/home?ws=${w.id}`}>
                {w.type === 'personal' ? 'My Personal Workouts' : w.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="footer">
          {isPlatformAdmin && <Link href="/admin">{t('web.admin_title')}</Link>}
          <Form action={signOut} submit={t('common.sign_out')} variant="ghost" />
        </div>
      </aside>

      {/* Mobile Sticky Top Header */}
      <header className="mobile-ws-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span className="wordmark" style={{ flexShrink: 0 }}>
            GRAVN
          </span>
          <span
            className="lux-tag"
            style={{
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block',
            }}
          >
            {workspace.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {otherWorkspaces.slice(0, 1).map((w) => (
            <Link
              key={w.id}
              href={isStaff(w) ? `/w/${w.id}` : `/home?ws=${w.id}`}
              className="lux-pill"
              style={{ fontSize: 11.5, padding: '5px 10px' }}
            >
              {w.type === 'personal' ? 'My Workouts →' : w.name}
            </Link>
          ))}
        </div>
      </header>

      {/* Instant 0ms Tab Content */}
      <main className="content">
        {/* ─── TAB 1: OVERVIEW ─── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span className="eyebrow">{t(roleKey(workspace))} Studio</span>
                <h1>{workspace.name}</h1>
                <p className="muted" style={{ fontSize: 13.5 }}>
                  Client adherence, active training splits, and floor activity.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => setTab('programs')}
                >
                  Split Builder
                </button>
                <button type="button" className="btn sm" onClick={() => setTab('members')}>
                  Manage Clients
                </button>
              </div>
            </div>

            <div className="lux-stats-row" style={{ marginBottom: 0 }}>
              <div className="lux-stat" onClick={() => setTab('members')} style={{ cursor: 'pointer' }}>
                <span className="lux-stat-label">
                  {workspace.type === 'coach' || !isOwner ? 'Active Clients' : 'Active Members'}
                </span>
                <span className="lux-stat-value mono">{members.length}</span>
                <span className="lux-stat-sub">{assignedCount} on a split</span>
              </div>

              <div className="lux-stat" onClick={() => setTab('activity')} style={{ cursor: 'pointer' }}>
                <span className="lux-stat-label">7-Day Workouts</span>
                <span className="lux-stat-value mono">{sessionsThisWeekTotal}</span>
                <span className="lux-stat-sub">Completed sets</span>
              </div>

              <div className="lux-stat" onClick={() => setTab('members')} style={{ cursor: 'pointer' }}>
                <span className="lux-stat-label">Needs Split</span>
                <span className="lux-stat-value mono">{withoutPlanCount}</span>
                <span className="lux-stat-sub">Unassigned clients</span>
              </div>

              {isGym && isOwner ? (
                <div className="lux-stat" onClick={() => setTab('members')} style={{ cursor: 'pointer' }}>
                  <span className="lux-stat-label">Expiring (30d)</span>
                  <span className="lux-stat-value mono">{expiring30.length}</span>
                  <span className="lux-stat-sub">{expiring7.length} within 7 days</span>
                </div>
              ) : (
                <div className="lux-stat" onClick={() => setTab('members')} style={{ cursor: 'pointer' }}>
                  <span className="lux-stat-label">Open Invites</span>
                  <span className="lux-stat-value mono">{invitations.length}</span>
                  <span className="lux-stat-sub">Pending join</span>
                </div>
              )}
            </div>

            {isGym && isOwner && expiring30.length > 0 && (
              <div className="lux-surface-flush">
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span className="eyebrow" style={{ marginBottom: 2 }}>
                      Membership Renewals
                    </span>
                    <h2 className="serif-md">Expiring in Next 30 Days ({expiring30.length})</h2>
                  </div>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {expiring7.length} due in 7d
                  </span>
                </div>
                <div className="lux-list">
                  {expiring30.map((gm) => {
                    const member = members.find((m) => m.id === gm.member_id);
                    const daysLeft = daysUntilMembershipExpiry(gm.end_date);
                    return (
                      <div
                        key={gm.id}
                        onClick={() => openClient(gm.member_id)}
                        className="lux-row lux-row-interactive"
                      >
                        <div>
                          <div className="lux-row-title">
                            {member ? displayName(member) : 'Member'}
                          </div>
                          <div className="lux-row-sub">
                            {gm.plan_label} · Ends {gm.end_date.slice(0, 10)}
                          </div>
                        </div>
                        <span className={`lux-tag ${daysLeft <= 7 ? '' : 'subtle'}`}>
                          {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 18,
                alignItems: 'start',
              }}
            >
              {/* Client Roster Snapshot */}
              <div className="lux-surface-flush">
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <h2 className="serif-md">Client Roster</h2>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setTab('members')}
                  >
                    View all →
                  </button>
                </div>

                {members.length === 0 ? (
                  <div style={{ padding: 20 }} className="muted">
                    No clients yet. Invite your first client from the Clients tab.
                  </div>
                ) : (
                  <div className="lux-list">
                    {members.slice(0, 6).map((m) => {
                      const plan = assignments.find(
                        (a) => a.client_member_id === m.id && a.status === 'active',
                      );
                      const weekCount = sessions.filter(
                        (s) =>
                          s.user_id === m.user_id &&
                          s.status === 'completed' &&
                          s.started_at >= weekAgoIso,
                      ).length;
                      return (
                        <div
                          key={m.id}
                          onClick={() => openClient(m.id)}
                          className="lux-row lux-row-interactive"
                        >
                          <div>
                            <div className="lux-row-title">{displayName(m)}</div>
                            <div className="lux-row-sub">
                              {plan?.program_version?.program?.name ?? 'No split assigned'}
                            </div>
                          </div>
                          <span className="mono muted" style={{ fontSize: 12.5 }}>
                            {weekCount} / wk
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Floor Activity */}
              <div className="lux-surface-flush">
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <h2 className="serif-md">Recent Floor Activity</h2>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setTab('activity')}
                  >
                    Full feed →
                  </button>
                </div>

                {recentSessions.length === 0 ? (
                  <div style={{ padding: 20 }} className="muted">
                    Completed client workouts will appear here as they log sets.
                  </div>
                ) : (
                  <div className="lux-list">
                    {recentSessions.map((s) => {
                      const member = members.find((m) => m.user_id === s.user_id);
                      const sum = summarizeSession(s.exercises ?? []);
                      return (
                        <div
                          key={s.id}
                          onClick={() => setTab('activity')}
                          className="lux-row lux-row-interactive"
                        >
                          <div>
                            <div className="lux-row-title">
                              {member ? displayName(member) : 'Client'} — {s.title}
                            </div>
                            <div className="lux-row-sub">
                              {new Date(s.started_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              · {sum.completedSets} sets ·{' '}
                              {Math.round(sum.totalVolumeKg).toLocaleString()} kg
                            </div>
                          </div>
                          {sum.prsEarned > 0 && (
                            <span className="lux-tag pr">{sum.prsEarned} PR</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: MEMBERS & CLIENTS ─── */}
        {tab === 'members' && (
          <ClientsDirectoryStudio
            key={selectedClientId ?? 'default'}
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            isGym={isGym}
            isOwner={isOwner}
            initialClientId={selectedClientId}
            members={members}
            trainers={trainers}
            trainerLinksByMember={trainerLinksByMember}
            invitations={invitations}
            records={records}
            archived={archived}
            assignments={assignments}
            sessions={sessions}
            versions={versions}
            gymMemberships={gymMemberships}
            measurementDefinitions={measurementDefinitions}
            measurementEntriesByUser={measurementEntriesByUser}
            streaks={streaks}
          />
        )}

        {/* ─── TAB 3: SPLITS & PROGRAMS ─── */}
        {tab === 'programs' && (
          <TrainerSplitsStudio
            workspaceId={workspace.id}
            versions={versions}
            exercises={exercises}
            clients={members}
            assignments={assignments}
            sessions={sessions}
          />
        )}

        {/* ─── TAB 4: ACTIVITY FEED ─── */}
        {tab === 'activity' && (
          <ActivityFeedStudio
            workspaceId={workspace.id}
            currentUserId={currentUserId}
            clients={members}
            sessions={sessions}
            highFives={highFives}
          />
        )}

        {/* ─── TAB 5: STAFF & SETTINGS ─── */}
        {tab === 'more' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <span className="eyebrow">Administration</span>
              <h1>Staff & Workspace Settings</h1>
            </div>

            {isGym && isOwner && (
              <>
                <Section title={t('people.invite_trainer')}>
                  <div className="panel">
                    <Form
                      inline
                      action={invite}
                      submit={t('people.invite')}
                      hidden={{ workspaceId: workspace.id, role: 'trainer' }}
                      fields={[{ name: 'email', label: t('auth.email'), type: 'email' }]}
                    />
                  </div>
                </Section>

                <Section title={t('people.trainers_title')}>
                  {trainers.length === 0 ? (
                    <EmptyState
                      title={t('people.no_trainers')}
                      body={t('people.no_trainers_body')}
                    />
                  ) : (
                    <ul className="rows">
                      {trainers.map((tr) => {
                        const clientCount = Object.values(trainerLinksByMember).filter((links) =>
                          links.some((l) => l.trainer.id === tr.id),
                        ).length;
                        return (
                          <li key={tr.id}>
                            <div className="grow">
                              <strong>{displayName(tr)}</strong>
                              <small>{t('people.clients_count', { count: clientCount })}</small>
                            </div>
                            <Form
                              inline
                              action={removeMember}
                              variant="danger"
                              submit={t('common.remove')}
                              confirm={t('people.remove_confirm', {
                                name: displayName(tr),
                                workspace: workspace.name,
                              })}
                              hidden={{ workspaceId: workspace.id, memberId: tr.id }}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>
              </>
            )}

            {isOwner && (
              <>
                <Section title={t('account.workspace_name')}>
                  <div className="panel">
                    <Form
                      inline
                      action={renameWorkspace}
                      submit={t('common.save')}
                      hidden={{ workspaceId: workspace.id }}
                      fields={[
                        {
                          name: 'name',
                          label: t('account.workspace_name'),
                          defaultValue: workspace.name,
                        },
                      ]}
                    />
                  </div>
                </Section>

                {isGym && (
                  <Section title={t('account.owner_trainer')}>
                    <div className="panel">
                      <Form
                        inline
                        action={toggleOwnerTrainer}
                        variant="secondary"
                        submit={t(
                          isTrainer
                            ? 'account.owner_trainer_disable'
                            : 'account.owner_trainer_enable',
                        )}
                        hidden={{ workspaceId: workspace.id, enabled: String(!isTrainer) }}
                      />
                    </div>
                  </Section>
                )}
              </>
            )}

            <Section title="Account & Session">
              <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Sign Out</strong>
                  <p className="muted" style={{ fontSize: 13 }}>
                    Sign out of {workspace.name} on this device
                  </p>
                </div>
                <Form action={signOut} submit={t('common.sign_out')} variant="secondary" />
              </div>
            </Section>
          </div>
        )}
      </main>

      {/* Mobile Fixed 5-Icon Bottom Tab Bar */}
      <nav className="mobile-ws-bottomnav" aria-label="Workspace Navigation">
        <button
          type="button"
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={tab === 'members' ? 'active' : ''}
          onClick={() => setTab('members')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Clients</span>
        </button>

        <button
          type="button"
          className={tab === 'programs' ? 'active' : ''}
          onClick={() => setTab('programs')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6.5 6.5 11 11" />
            <path d="m21 21-1-1" />
            <path d="m3 3 1 1" />
            <path d="m18 22 4-4" />
            <path d="m2 6 4-4" />
            <path d="m3 10 7-7" />
            <path d="m14 21 7-7" />
          </svg>
          <span>Splits</span>
        </button>

        <button
          type="button"
          className={tab === 'activity' ? 'active' : ''}
          onClick={() => setTab('activity')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>Activity</span>
        </button>

        <button
          type="button"
          className={tab === 'more' ? 'active' : ''}
          onClick={() => setTab('more')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
