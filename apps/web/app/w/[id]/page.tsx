import {
  daysUntilMembershipExpiry,
  displayName,
  fetchPeople,
  filterExpiringMemberships,
  isOwner,
  roleKey,
  summarizeSession,
  t,
} from '@gravn/shared';
import Link from 'next/link';

import { api, requireStaffWorkspace } from '@/lib/supabase';

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws } = await requireStaffWorkspace(id);
  const owner = isOwner(ws);
  const client = await api();
  const [people, memberships] = await Promise.all([
    fetchPeople(client, id),
    ws.type === 'gym' && owner ? client.gymMemberships(id).catch(() => []) : Promise.resolve([]),
  ]);

  const assignedCount = people.members.length - people.membersWithoutPlan.length;
  const recentSessions = people.sessions.filter((s) => s.status === 'completed').slice(0, 4);
  const expiring7 = filterExpiringMemberships(memberships, 7);
  const expiring30 = filterExpiringMemberships(memberships, 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
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
          <span className="eyebrow">{t(roleKey(ws))} Studio</span>
          <h1>{ws.name}</h1>
          <p className="muted">
            Client adherence, active training splits, and recent floor activity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href={`/w/${id}/programs`} className="btn secondary">
            Split Builder
          </Link>
          <Link href={`/w/${id}/members`} className="btn">
            Manage Clients
          </Link>
        </div>
      </div>

      <div className="lux-stats-row" style={{ marginBottom: 0 }}>
        <div className="lux-stat">
          <span className="lux-stat-label">
            {ws.type === 'coach' || !owner ? 'Active Clients' : 'Active Members'}
          </span>
          <span className="lux-stat-value mono">{people.members.length}</span>
          <span className="lux-stat-sub">{assignedCount} on an active split</span>
        </div>

        <div className="lux-stat">
          <span className="lux-stat-label">Sessions (7 Days)</span>
          <span className="lux-stat-value mono">{people.sessionsThisWeek()}</span>
          <span className="lux-stat-sub">Completed across roster</span>
        </div>

        <div className="lux-stat">
          <span className="lux-stat-label">Awaiting Split</span>
          <span className="lux-stat-value mono">{people.membersWithoutPlan.length}</span>
          <span className="lux-stat-sub">Unassigned clients</span>
        </div>

        {ws.type === 'gym' && owner ? (
          <div className="lux-stat">
            <span className="lux-stat-label">Expiring (30 Days)</span>
            <span className="lux-stat-value mono">{expiring30.length}</span>
            <span className="lux-stat-sub">{expiring7.length} expiring within 7 days</span>
          </div>
        ) : (
          <div className="lux-stat">
            <span className="lux-stat-label">Pending Invites</span>
            <span className="lux-stat-value mono">{people.invitations.length}</span>
            <span className="lux-stat-sub">Awaiting acceptance</span>
          </div>
        )}
      </div>

      {/* Physical Gym Membership Expiry Alerts (§3.3) */}
      {ws.type === 'gym' && owner && expiring30.length > 0 && (
        <div className="lux-surface-flush">
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span className="eyebrow" style={{ marginBottom: 2 }}>
                Membership Renewals
              </span>
              <h2 className="serif-md">Expiring in Next 30 Days ({expiring30.length})</h2>
            </div>
            <span className="mono muted" style={{ fontSize: 12.5 }}>
              {expiring7.length} due within 7 days
            </span>
          </div>
          <div className="lux-list">
            {expiring30.map((gm) => {
              const member = people.members.find((m) => m.id === gm.member_id);
              const daysLeft = daysUntilMembershipExpiry(gm.end_date);
              return (
                <Link
                  key={gm.id}
                  href={`/w/${id}/members?client=${gm.member_id}`}
                  className="lux-row lux-row-interactive"
                >
                  <div>
                    <div className="lux-row-title">{member ? displayName(member) : 'Member'}</div>
                    <div className="lux-row-sub">
                      {gm.plan_label} · Ends {gm.end_date.slice(0, 10)}
                    </div>
                  </div>
                  <span className={`lux-tag ${daysLeft <= 7 ? '' : 'subtle'}`}>
                    {daysLeft === 0 ? 'Expires today' : `${daysLeft}d remaining`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 28,
          alignItems: 'start',
        }}
      >
        {/* Client Roster Snapshot */}
        <div className="lux-surface-flush">
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h2 className="serif-md">Client Roster</h2>
            <Link href={`/w/${id}/members`} className="muted" style={{ fontSize: 13 }}>
              View all →
            </Link>
          </div>

          {people.members.length === 0 ? (
            <div style={{ padding: 28 }} className="muted">
              No clients yet. Invite your first client from the Clients tab.
            </div>
          ) : (
            <div className="lux-list">
              {people.members.slice(0, 6).map((m) => {
                const plan = people.planOf(m.id);
                const weekCount = people.sessionsThisWeek(m.user_id);
                return (
                  <Link
                    key={m.id}
                    href={`/w/${id}/members?client=${m.id}`}
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
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Floor Activity */}
        <div className="lux-surface-flush">
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h2 className="serif-md">Recent Floor Activity</h2>
            <Link href={`/w/${id}/activity`} className="muted" style={{ fontSize: 13 }}>
              Full feed →
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div style={{ padding: 28 }} className="muted">
              Completed client workouts will appear here as they log sets.
            </div>
          ) : (
            <div className="lux-list">
              {recentSessions.map((s) => {
                const member = people.members.find((m) => m.user_id === s.user_id);
                const sum = summarizeSession(s.exercises ?? []);
                return (
                  <Link
                    key={s.id}
                    href={`/w/${id}/activity`}
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
                    {sum.prsEarned > 0 && <span className="lux-tag pr">{sum.prsEarned} PR</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
