import { describe, expect, it } from 'vitest';

import {
  buildMeasurementSeries,
  computeWeeklyStreak,
  convertWeight,
  detectSetPr,
  filterExpiringMemberships,
  formatTimer,
  pickNextProgramDay,
  remainingTimerSeconds,
  setVolumeKg,
  stepWeight,
  summarizeSession,
  syncBackoffMs,
  toCanonicalKg,
  toCanonicalMeasurement,
} from './workouts';

describe('units and steppers', () => {
  it('converts lb to canonical kg accurately without mutating entered values', () => {
    expect(toCanonicalKg(100, 'kg')).toBe(100);
    expect(toCanonicalKg(100, 'lb')).toBe(45.36);
    expect(toCanonicalKg(0, 'kg')).toBe(0);
    expect(toCanonicalKg(null, 'kg')).toBeNull();
    expect(convertWeight(100, 'kg', 'lb')).toBe(220.5);
  });

  it('steps weights by 2.5 kg or 5 lb and clamps at 0', () => {
    expect(stepWeight(60, 1, 'kg')).toBe(62.5);
    expect(stepWeight(60, -1, 'kg')).toBe(57.5);
    expect(stepWeight(1, -1, 'kg')).toBe(0);
    expect(stepWeight(135, 1, 'lb')).toBe(140);
  });
});

describe('setVolumeKg and summarizeSession', () => {
  const baseSet = {
    id: 's1',
    set_index: 0,
    set_type: 'working' as const,
    actual_reps: 10,
    actual_weight_value: 50,
    actual_weight_unit: 'kg' as const,
    actual_duration_s: null,
    state: 'completed' as const,
  };

  it('counts completed working weight_reps sets and ignores warmups, 0 kg, skipped and timed sets', () => {
    expect(setVolumeKg(baseSet, 'weight_reps')).toBe(500);
    expect(setVolumeKg({ ...baseSet, set_type: 'warmup' }, 'weight_reps')).toBe(0);
    expect(setVolumeKg({ ...baseSet, actual_weight_value: 0 }, 'weight_reps')).toBe(0);
    expect(setVolumeKg({ ...baseSet, state: 'incomplete' }, 'weight_reps')).toBe(0);
    expect(setVolumeKg({ ...baseSet, state: 'skipped' }, 'weight_reps')).toBe(0);
    expect(setVolumeKg(baseSet, 'reps')).toBe(0);
    expect(setVolumeKg(baseSet, 'time')).toBe(0);
  });

  it('summarises completed sets, skipped sets, volume and PRs', () => {
    const summary = summarizeSession(
      [
        {
          tracking_type: 'weight_reps',
          skipped: false,
          sets: [
            { ...baseSet, set_type: 'warmup', is_pr: true },
            { ...baseSet, id: 's2', is_pr: true },
            { ...baseSet, id: 's3', state: 'skipped' },
          ],
        },
      ],
      400,
    );
    expect(summary).toEqual({
      completedSets: 2,
      skippedSets: 1,
      skippedExercises: 0,
      totalVolumeKg: 500,
      prsEarned: 1,
      volumeDeltaKg: 100,
    });
  });
});

describe('detectSetPr', () => {
  const history = [
    {
      state: 'completed' as const,
      set_type: 'working' as const,
      actual_reps: 5,
      actual_weight_value: 80,
      actual_weight_unit: 'kg' as const,
    },
  ];

  it('detects a heavier weight PR across mixed kg/lb history', () => {
    expect(
      detectSetPr(
        {
          state: 'completed',
          set_type: 'working',
          actual_reps: 3,
          actual_weight_value: 82.5,
          actual_weight_unit: 'kg',
        },
        history,
        'weight_reps',
      ),
    ).toEqual({ isPr: true, heldForConfirmation: false });

    // 180 lb = 81.65 kg > 80 kg
    expect(
      detectSetPr(
        {
          state: 'completed',
          set_type: 'working',
          actual_reps: 5,
          actual_weight_value: 180,
          actual_weight_unit: 'lb',
        },
        history,
        'weight_reps',
      ),
    ).toEqual({ isPr: true, heldForConfirmation: false });
  });

  it('holds implausible jumps (>50% over >=20 kg) for confirmation and ignores warmups/0 kg', () => {
    expect(
      detectSetPr(
        {
          state: 'completed',
          set_type: 'working',
          actual_reps: 5,
          actual_weight_value: 150,
          actual_weight_unit: 'kg',
        },
        history,
        'weight_reps',
      ),
    ).toEqual({ isPr: false, heldForConfirmation: true });

    expect(
      detectSetPr(
        {
          state: 'completed',
          set_type: 'warmup',
          actual_reps: 5,
          actual_weight_value: 90,
          actual_weight_unit: 'kg',
        },
        history,
        'weight_reps',
      ),
    ).toEqual({ isPr: false, heldForConfirmation: false });
  });

  it('detects bodyweight rep PRs', () => {
    const bwHistory = [
      {
        state: 'completed' as const,
        set_type: 'working' as const,
        actual_reps: 12,
        actual_weight_value: null,
        actual_weight_unit: 'kg' as const,
      },
    ];
    expect(
      detectSetPr(
        {
          state: 'completed',
          set_type: 'working',
          actual_reps: 15,
          actual_weight_value: null,
          actual_weight_unit: 'kg',
        },
        bwHistory,
        'reps',
      ),
    ).toEqual({ isPr: true, heldForConfirmation: false });
  });
});

describe('pickNextProgramDay', () => {
  const days = [
    { id: 'd2', week_index: 1, day_index: 2, title: 'Day 2' },
    { id: 'd1', week_index: 1, day_index: 1, title: 'Day 1' },
    { id: 'd3', week_index: 1, day_index: 3, title: 'Day 3' },
  ];

  it('picks Day 1 first, advances in sequence, and wraps around after the last day', () => {
    expect(pickNextProgramDay(days, null)?.id).toBe('d1');
    expect(pickNextProgramDay(days, 'd1')?.id).toBe('d2');
    expect(pickNextProgramDay(days, 'd2')?.id).toBe('d3');
    expect(pickNextProgramDay(days, 'd3')?.id).toBe('d1');
  });
});

describe('timers and backoff', () => {
  it('computes remaining timer seconds from deadline and clamps at 0', () => {
    expect(remainingTimerSeconds(10_000, 4_200)).toBe(6);
    expect(remainingTimerSeconds(10_000, 15_000)).toBe(0);
    expect(formatTimer(95)).toBe('1:35');
  });

  it('scales exponential backoff up to 60 seconds', () => {
    expect(syncBackoffMs(0)).toBe(1000);
    expect(syncBackoffMs(2)).toBe(4000);
    expect(syncBackoffMs(10)).toBe(60000);
  });
});

describe('Part 3: measurements, weekly streaks and membership expiry', () => {
  it('converts measurement units to canonical metric values and keeps gaps as gaps in series', () => {
    expect(toCanonicalMeasurement(100, 'lb')).toBe(45.36);
    expect(toCanonicalMeasurement(32, 'in')).toBe(81.28);
    expect(toCanonicalMeasurement(15.4, '%')).toBe(15.4);

    const series = buildMeasurementSeries([
      { measured_on: '2026-10-01', value: 78.5 },
      { measured_on: '2026-10-20', value: 77.0 },
      { measured_on: '2026-10-25', value: 76.4 },
    ]);

    expect(series.firstValue).toBe(78.5);
    expect(series.latestValue).toBe(76.4);
    expect(series.delta).toBe(-2.1);
    expect(series.hasGaps).toBe(true);
    // Gaps never produce 0 values; a >14-day gap inserts a null break point
    expect(series.points.some((p) => p.value === 0)).toBe(false);
    expect(series.points.some((p) => p.value === null)).toBe(true);
  });

  it('computes weekly streaks where rest days never break a streak and a freeze/pause preserves it', () => {
    // 2 weeks completed (target = 2/wk), 1 missed week protected by freeze, current week has 2 sessions
    const sessions = [
      '2026-09-28T10:00:00Z',
      '2026-10-01T10:00:00Z',
      '2026-10-05T10:00:00Z',
      '2026-10-08T10:00:00Z',
      // week of 2026-10-12 missed (freeze protects it)
      '2026-10-19T10:00:00Z',
      '2026-10-22T10:00:00Z',
    ];
    const streak = computeWeeklyStreak(sessions, 2, {
      nowIso: '2026-10-23T12:00:00Z',
      freezesAvailable: 1,
    });
    expect(streak.thisWeekCompleted).toBe(2);
    expect(streak.currentWeeks).toBe(3);
    expect(streak.freezeUsed).toBe(true);

    // Paused streak stays protected
    const paused = computeWeeklyStreak(sessions.slice(0, 4), 2, {
      nowIso: '2026-10-23T12:00:00Z',
      pausedUntil: '2026-10-31',
    });
    expect(paused.isPaused).toBe(true);
  });

  it('filters physical gym memberships expiring within 7 and 30 days', () => {
    const memberships = [
      {
        id: 'm1',
        workspace_id: 'w1',
        member_id: 'mem1',
        plan_label: 'Monthly',
        start_date: '2026-09-28',
        end_date: '2026-10-28',
        status: 'active' as const,
        notes: '',
      },
      {
        id: 'm2',
        workspace_id: 'w1',
        member_id: 'mem2',
        plan_label: 'Quarterly',
        start_date: '2026-08-15',
        end_date: '2026-11-12',
        status: 'active' as const,
        notes: '',
      },
      {
        id: 'm3',
        workspace_id: 'w1',
        member_id: 'mem3',
        plan_label: 'Annual',
        start_date: '2026-06-01',
        end_date: '2027-06-01',
        status: 'active' as const,
        notes: '',
      },
    ];

    expect(filterExpiringMemberships(memberships, 7, '2026-10-25').map((m) => m.id)).toEqual([
      'm1',
    ]);
    expect(filterExpiringMemberships(memberships, 30, '2026-10-25').map((m) => m.id)).toEqual([
      'm1',
      'm2',
    ]);
  });
});
