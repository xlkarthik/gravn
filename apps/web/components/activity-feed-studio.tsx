'use client';

import {
  displayName,
  type HighFiveRecord,
  type RosterEntry,
  summarizeSession,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { postWorkoutComment, sendCoachHighFiveAction } from '../app/workout-actions';

interface Props {
  workspaceId: string;
  currentUserId: string;
  clients: RosterEntry[];
  sessions: WorkoutSessionRecord[];
  highFives: HighFiveRecord[];
}

export function ActivityFeedStudio({
  workspaceId,
  currentUserId,
  clients,
  sessions,
  highFives,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const completedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'completed')
        .filter((s) => (clientFilter === 'all' ? true : s.user_id === clientFilter)),
    [sessions, clientFilter],
  );

  const clientByUserId = useMemo(() => new Map(clients.map((c) => [c.user_id, c])), [clients]);

  const highFivesBySession = useMemo(() => {
    const map = new Map<string, HighFiveRecord[]>();
    for (const hf of highFives) {
      const list = map.get(hf.session_id) ?? [];
      list.push(hf);
      map.set(hf.session_id, list);
    }
    return map;
  }, [highFives]);

  return (
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
          <span className="eyebrow">Training Ledger</span>
          <h1>Activity Feed</h1>
          <p className="muted">
            Every completed session across your roster — send a high-five or leave coaching notes.
          </p>
        </div>

        <div className="lux-pills">
          <button
            type="button"
            className={`lux-pill ${clientFilter === 'all' ? 'active' : ''}`}
            onClick={() => setClientFilter('all')}
          >
            All Clients ({sessions.filter((s) => s.status === 'completed').length})
          </button>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`lux-pill ${clientFilter === c.user_id ? 'active' : ''}`}
              onClick={() => setClientFilter(c.user_id)}
            >
              {displayName(c)}
            </button>
          ))}
        </div>
      </div>

      {completedSessions.length === 0 ? (
        <div className="empty">
          <h3 className="serif-md" style={{ marginBottom: 6 }}>
            No completed sessions yet
          </h3>
          <p className="muted">
            When clients finish a session on web or mobile, their sets and PRs appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {completedSessions.map((session) => {
            const client = clientByUserId.get(session.user_id);
            const summary = summarizeSession(session.exercises ?? []);
            const dateStr = new Date(session.started_at).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const draft = commentDrafts[session.id] ?? '';
            const sessionHfs = highFivesBySession.get(session.id) ?? [];
            const alreadyHighFived = sessionHfs.some((h) => h.from_user_id === currentUserId);

            return (
              <div key={session.id} className="lux-surface">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    paddingBottom: 14,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <span className="eyebrow" style={{ marginBottom: 4 }}>
                      {client ? displayName(client) : 'Member'} · {dateStr}
                    </span>
                    <h3 className="serif-lg">{session.title}</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {summary.prsEarned > 0 && (
                      <span className="lux-tag pr">{summary.prsEarned} PR</span>
                    )}
                    <span className="mono muted" style={{ fontSize: 12.5 }}>
                      {Math.round(summary.totalVolumeKg).toLocaleString()} kg ·{' '}
                      {summary.completedSets} sets
                    </span>

                    <button
                      type="button"
                      disabled={isPending || alreadyHighFived}
                      className={`lux-pill ${alreadyHighFived ? 'active' : ''}`}
                      onClick={() => {
                        startTransition(async () => {
                          await sendCoachHighFiveAction(workspaceId, session.id, draft.trim());
                          router.refresh();
                        });
                      }}
                    >
                      {alreadyHighFived
                        ? `👏 High-Fived (${sessionHfs.length})`
                        : `👏 High-Five${sessionHfs.length > 0 ? ` (${sessionHfs.length})` : ''}`}
                    </button>
                  </div>
                </div>

                {/* Exercise Breakdown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '10px 24px',
                    padding: '18px 0',
                  }}
                >
                  {(session.exercises ?? []).map((se) => {
                    const doneSets = (se.sets ?? []).filter((st) => st.state === 'completed');
                    if (doneSets.length === 0) return null;
                    return (
                      <div
                        key={se.id}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13.5, marginBottom: 4 }}>
                          {se.exercise?.name}
                        </div>
                        <div className="mono muted" style={{ fontSize: 12 }}>
                          {doneSets
                            .map((st) =>
                              st.actual_weight_value !== null
                                ? `${st.actual_weight_value}${st.actual_weight_unit ?? 'kg'}×${st.actual_reps ?? 0}`
                                : `${st.actual_reps ?? 0} reps`,
                            )
                            .join('  ·  ')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Coaching Feedback */}
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {(session.comments ?? []).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        fontSize: 13.5,
                        background: 'var(--accent-soft)',
                        borderLeft: '2px solid var(--accent)',
                        padding: '8px 14px',
                        borderRadius: '0 8px 8px 0',
                      }}
                    >
                      <span>{c.body}</span>
                      <span className="muted" style={{ fontSize: 11.5, marginLeft: 10 }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      className="lux-input"
                      style={{ flex: 1, minHeight: 38 }}
                      placeholder="Leave a coaching note on this session…"
                      value={draft}
                      onChange={(e) =>
                        setCommentDrafts({ ...commentDrafts, [session.id]: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn secondary sm"
                      disabled={!draft.trim() || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await postWorkoutComment(session.id, draft.trim(), workspaceId);
                          setCommentDrafts({ ...commentDrafts, [session.id]: '' });
                          router.refresh();
                        });
                      }}
                    >
                      Post Note
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
