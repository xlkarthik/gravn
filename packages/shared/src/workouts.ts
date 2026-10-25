// Pure workout domain logic shared by mobile and web: units, set states, volume,
// live PR detection, sequence scheduling, deadline timers and sync backoff (Part 2).

export type ResourceScope = 'global' | 'workspace' | 'personal';
export type TrackingType =
  'weight_reps' | 'reps' | 'added_weight' | 'assisted' | 'time' | 'distance' | 'distance_time';
export type SetType = 'warmup' | 'working' | 'drop' | 'failure' | 'amrap';
export type SetState = 'not_recorded' | 'completed' | 'incomplete' | 'skipped';
export type WeightUnit = 'kg' | 'lb';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type ProgramVersionStatus = 'draft' | 'published';

export const KG_PER_LB = 0.45359237;

export function roundWeight(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function toCanonicalKg(
  value: number | null | undefined,
  unit: WeightUnit = 'kg',
): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return unit === 'lb' ? roundWeight(value * KG_PER_LB, 2) : roundWeight(value, 2);
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return roundWeight(value, 2);
  return from === 'lb' ? roundWeight(value * KG_PER_LB, 2) : roundWeight(value / KG_PER_LB, 1);
}

export function defaultWeightStep(unit: WeightUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

export function stepWeight(
  current: number | null | undefined,
  direction: 1 | -1,
  unit: WeightUnit = 'kg',
  step = defaultWeightStep(unit),
): number {
  const base = current ?? 0;
  return Math.max(0, roundWeight(base + direction * step, 2));
}

export interface SetRecord {
  id: string;
  set_index: number;
  set_type: SetType;
  planned_reps_min?: number | null;
  planned_reps_max?: number | null;
  planned_weight_value?: number | null;
  planned_weight_unit?: WeightUnit | null;
  planned_duration_s?: number | null;
  actual_reps: number | null;
  actual_weight_value: number | null;
  actual_weight_unit: WeightUnit;
  actual_duration_s: number | null;
  rpe?: number | null;
  note?: string | null;
  state: SetState;
  is_pr?: boolean;
  completed_at?: string | null;
}

// Volume counts only completed working/drop/failure/amrap sets of weighted exercises.
// Warm-up sets and 0-weight / bodyweight / timed sets never add to volume (plan 2.8).
export function setVolumeKg(
  set: Pick<
    SetRecord,
    'state' | 'set_type' | 'actual_reps' | 'actual_weight_value' | 'actual_weight_unit'
  >,
  trackingType: TrackingType,
): number {
  if (set.state !== 'completed' || set.set_type === 'warmup') return 0;
  if (trackingType !== 'weight_reps' && trackingType !== 'added_weight') return 0;
  if (!set.actual_reps || set.actual_reps <= 0) return 0;
  const kg = toCanonicalKg(set.actual_weight_value, set.actual_weight_unit);
  if (!kg || kg <= 0) return 0;
  return roundWeight(kg * set.actual_reps, 2);
}

export interface PrCheckResult {
  isPr: boolean;
  heldForConfirmation: boolean;
}

// Live PR detection against historical completed sets of the same exercise (plan 2.6).
// Heaviest weight for >= 1 rep (weight_reps), or most reps (reps / bodyweight).
// Implausible jumps (>50% over an established >=20 kg lift, or >2x over >=10 reps) are held back.
export function detectSetPr(
  candidate: Pick<
    SetRecord,
    'state' | 'set_type' | 'actual_reps' | 'actual_weight_value' | 'actual_weight_unit'
  >,
  history: ReadonlyArray<
    Pick<
      SetRecord,
      'state' | 'set_type' | 'actual_reps' | 'actual_weight_value' | 'actual_weight_unit'
    >
  >,
  trackingType: TrackingType,
): PrCheckResult {
  if (candidate.state !== 'completed' || candidate.set_type === 'warmup') {
    return { isPr: false, heldForConfirmation: false };
  }

  const validHistory = history.filter((h) => h.state === 'completed' && h.set_type !== 'warmup');

  if (trackingType === 'weight_reps' || trackingType === 'added_weight') {
    const reps = candidate.actual_reps ?? 0;
    const kg = toCanonicalKg(candidate.actual_weight_value, candidate.actual_weight_unit) ?? 0;
    if (reps < 1 || kg <= 0) return { isPr: false, heldForConfirmation: false };

    let bestKg = 0;
    for (const h of validHistory) {
      if ((h.actual_reps ?? 0) >= 1) {
        const hKg = toCanonicalKg(h.actual_weight_value, h.actual_weight_unit) ?? 0;
        if (hKg > bestKg) bestKg = hKg;
      }
    }
    if (bestKg === 0 || kg <= bestKg) return { isPr: false, heldForConfirmation: false };
    if (bestKg >= 20 && kg > bestKg * 1.5) {
      return { isPr: false, heldForConfirmation: true };
    }
    return { isPr: true, heldForConfirmation: false };
  }

  if (trackingType === 'reps') {
    const reps = candidate.actual_reps ?? 0;
    if (reps < 1) return { isPr: false, heldForConfirmation: false };

    let bestReps = 0;
    for (const h of validHistory) {
      if ((h.actual_reps ?? 0) > bestReps) bestReps = h.actual_reps ?? 0;
    }
    if (bestReps === 0 || reps <= bestReps) return { isPr: false, heldForConfirmation: false };
    if (bestReps >= 10 && reps > bestReps * 2) {
      return { isPr: false, heldForConfirmation: true };
    }
    return { isPr: true, heldForConfirmation: false };
  }

  return { isPr: false, heldForConfirmation: false };
}

export interface SessionExerciseSummaryInput {
  tracking_type: TrackingType;
  skipped: boolean;
  sets: SetRecord[];
}

export interface SessionSummary {
  completedSets: number;
  skippedSets: number;
  skippedExercises: number;
  totalVolumeKg: number;
  prsEarned: number;
  volumeDeltaKg: number | null;
}

export function summarizeSession(
  exercises: ReadonlyArray<SessionExerciseSummaryInput>,
  previousVolumeKg?: number | null,
): SessionSummary {
  let completedSets = 0;
  let skippedSets = 0;
  let skippedExercises = 0;
  let totalVolumeKg = 0;
  let prsEarned = 0;

  for (const ex of exercises) {
    if (ex.skipped) skippedExercises += 1;
    for (const s of ex.sets) {
      if (s.state === 'completed') {
        completedSets += 1;
        totalVolumeKg = roundWeight(totalVolumeKg + setVolumeKg(s, ex.tracking_type), 2);
        if (s.is_pr && s.set_type !== 'warmup') prsEarned += 1;
      } else if (s.state === 'skipped' || ex.skipped) {
        skippedSets += 1;
      }
    }
  }

  const volumeDeltaKg =
    previousVolumeKg !== null && previousVolumeKg !== undefined && previousVolumeKg > 0
      ? roundWeight(totalVolumeKg - previousVolumeKg, 2)
      : null;

  return {
    completedSets,
    skippedSets,
    skippedExercises,
    totalVolumeKg,
    prsEarned,
    volumeDeltaKg,
  };
}

export interface ProgramDayRef {
  id: string;
  week_index: number;
  day_index: number;
  title: string;
  weekday_hint?: number | null;
}

// Sequence schedule (D-10): picks the day after the last completed day, wrapping around.
export function pickNextProgramDay<T extends ProgramDayRef>(
  days: ReadonlyArray<T>,
  lastCompletedDayId?: string | null,
): T | undefined {
  if (days.length === 0) return undefined;
  const sorted = [...days].sort((a, b) => a.week_index - b.week_index || a.day_index - b.day_index);
  if (!lastCompletedDayId) return sorted[0];
  const idx = sorted.findIndex((d) => d.id === lastCompletedDayId);
  if (idx === -1) return sorted[0];
  return sorted[(idx + 1) % sorted.length];
}

// Deadline-based timer (plan 2.9): stays accurate across app backgrounding and restarts.
export function remainingTimerSeconds(endsAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Exponential backoff with optional jitter for offline sync retries (plan 2.4).
export function syncBackoffMs(attempt: number, jitterSeed = 0): number {
  const exp = Math.min(6, Math.max(0, attempt));
  const base = Math.min(60_000, 1000 * 2 ** exp);
  const jitter = Math.max(-0.2, Math.min(0.2, jitterSeed)) * base;
  return Math.round(base + jitter);
}

// Pre-built workout split formats for solo users and trainers.
export interface SplitTemplateItem {
  exerciseName: string;
  setsCount: number;
  repsMin?: number;
  repsMax?: number;
  durationSeconds?: number;
  supersetGroup?: string;
}

export interface SplitTemplateDay {
  title: string;
  items: SplitTemplateItem[];
}

export interface SplitTemplate {
  id: string;
  name: string;
  tag: string;
  daysPerWeek: number;
  description: string;
  days: SplitTemplateDay[];
}

export const SPLIT_TEMPLATES: readonly SplitTemplate[] = [
  {
    id: 'ppl-3',
    name: 'Push / Pull / Legs',
    tag: '3 days / week · Hypertrophy',
    daysPerWeek: 3,
    description: 'Classic 3-day split grouping pressing muscles, pulling muscles, and lower body.',
    days: [
      {
        title: 'Day 1 • Push (Chest, Shoulders & Triceps)',
        items: [
          { exerciseName: 'Barbell Bench Press', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Incline Dumbbell Press', setsCount: 3, repsMin: 8, repsMax: 10 },
          {
            exerciseName: 'Seated Dumbbell Shoulder Press',
            setsCount: 3,
            repsMin: 8,
            repsMax: 10,
          },
          { exerciseName: 'Dumbbell Lateral Raise', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Cable Tricep Pushdown', setsCount: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        title: 'Day 2 • Pull (Back & Biceps)',
        items: [
          { exerciseName: 'Conventional Deadlift', setsCount: 3, repsMin: 5, repsMax: 5 },
          { exerciseName: 'Lat Pulldown', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Seated Cable Row', setsCount: 3, repsMin: 8, repsMax: 12 },
          { exerciseName: 'Cable Face Pull', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Barbell Bicep Curl', setsCount: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        title: 'Day 3 • Legs (Quads, Hamstrings & Calves)',
        items: [
          { exerciseName: 'Barbell Back Squat', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Romanian Deadlift', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Leg Press', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Lying Leg Curl', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Standing Calf Raise', setsCount: 4, repsMin: 12, repsMax: 15 },
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower Split',
    tag: '4 days / week · Strength & Size',
    daysPerWeek: 4,
    description:
      'Alternates heavy strength days with higher-volume hypertrophy days twice per week.',
    days: [
      {
        title: 'Day 1 • Upper Strength',
        items: [
          { exerciseName: 'Barbell Bench Press', setsCount: 4, repsMin: 5, repsMax: 6 },
          { exerciseName: 'Barbell Bent-Over Row', setsCount: 4, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Overhead Barbell Press', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Pull-Up', setsCount: 3, repsMin: 6, repsMax: 10 },
          { exerciseName: 'Barbell Bicep Curl', setsCount: 3, repsMin: 8, repsMax: 10 },
        ],
      },
      {
        title: 'Day 2 • Lower Strength',
        items: [
          { exerciseName: 'Barbell Back Squat', setsCount: 4, repsMin: 5, repsMax: 6 },
          { exerciseName: 'Romanian Deadlift', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Leg Press', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Lying Leg Curl', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Standing Calf Raise', setsCount: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      {
        title: 'Day 3 • Upper Hypertrophy',
        items: [
          { exerciseName: 'Incline Dumbbell Press', setsCount: 3, repsMin: 8, repsMax: 12 },
          { exerciseName: 'Lat Pulldown', setsCount: 3, repsMin: 8, repsMax: 12 },
          { exerciseName: 'Seated Cable Row', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Dumbbell Lateral Raise', setsCount: 4, repsMin: 12, repsMax: 15 },
          {
            exerciseName: 'Cable Tricep Pushdown',
            setsCount: 3,
            repsMin: 10,
            repsMax: 12,
            supersetGroup: 'A',
          },
          {
            exerciseName: 'Dumbbell Hammer Curl',
            setsCount: 3,
            repsMin: 10,
            repsMax: 12,
            supersetGroup: 'A',
          },
        ],
      },
      {
        title: 'Day 4 • Lower Hypertrophy',
        items: [
          { exerciseName: 'Barbell Front Squat', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Barbell Hip Thrust', setsCount: 3, repsMin: 8, repsMax: 12 },
          {
            exerciseName: 'Dumbbell Bulgarian Split Squat',
            setsCount: 3,
            repsMin: 8,
            repsMax: 10,
          },
          { exerciseName: 'Leg Extension', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Plank', setsCount: 3, durationSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'full-body-3',
    name: 'Full Body Foundation',
    tag: '3 days / week · All Levels',
    daysPerWeek: 3,
    description: 'High-efficiency compound lifts hitting every major muscle group each session.',
    days: [
      {
        title: 'Day 1 • Full Body A',
        items: [
          { exerciseName: 'Barbell Back Squat', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Barbell Bench Press', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Barbell Bent-Over Row', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Plank', setsCount: 3, durationSeconds: 45 },
        ],
      },
      {
        title: 'Day 2 • Full Body B',
        items: [
          { exerciseName: 'Conventional Deadlift', setsCount: 3, repsMin: 5, repsMax: 5 },
          { exerciseName: 'Overhead Barbell Press', setsCount: 3, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Lat Pulldown', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Hanging Knee Raise', setsCount: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        title: 'Day 3 • Full Body C',
        items: [
          { exerciseName: 'Leg Press', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Incline Dumbbell Press', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Seated Cable Row', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Dumbbell Lateral Raise', setsCount: 3, repsMin: 12, repsMax: 15 },
        ],
      },
    ],
  },
  {
    id: 'bro-split-5',
    name: '5-Day Body Part Split',
    tag: '5 days / week · Bodybuilding',
    daysPerWeek: 5,
    description: 'Dedicated daily focus for Chest, Back, Shoulders, Legs, and Arms.',
    days: [
      {
        title: 'Day 1 • Chest',
        items: [
          { exerciseName: 'Barbell Bench Press', setsCount: 4, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Incline Dumbbell Press', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Cable Chest Fly', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Push-Up', setsCount: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      {
        title: 'Day 2 • Back',
        items: [
          { exerciseName: 'Conventional Deadlift', setsCount: 3, repsMin: 5, repsMax: 5 },
          { exerciseName: 'Pull-Up', setsCount: 3, repsMin: 6, repsMax: 10 },
          { exerciseName: 'Barbell Bent-Over Row', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Seated Cable Row', setsCount: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        title: 'Day 3 • Shoulders & Core',
        items: [
          { exerciseName: 'Overhead Barbell Press', setsCount: 4, repsMin: 6, repsMax: 8 },
          {
            exerciseName: 'Seated Dumbbell Shoulder Press',
            setsCount: 3,
            repsMin: 8,
            repsMax: 10,
          },
          { exerciseName: 'Dumbbell Lateral Raise', setsCount: 4, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Cable Face Pull', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Cable Crunch', setsCount: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      {
        title: 'Day 4 • Legs',
        items: [
          { exerciseName: 'Barbell Back Squat', setsCount: 4, repsMin: 6, repsMax: 8 },
          { exerciseName: 'Romanian Deadlift', setsCount: 3, repsMin: 8, repsMax: 10 },
          { exerciseName: 'Leg Press', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Lying Leg Curl', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Standing Calf Raise', setsCount: 4, repsMin: 12, repsMax: 15 },
        ],
      },
      {
        title: 'Day 5 • Arms',
        items: [
          {
            exerciseName: 'Close-Grip Bench Press',
            setsCount: 3,
            repsMin: 8,
            repsMax: 10,
            supersetGroup: 'A',
          },
          {
            exerciseName: 'Barbell Bicep Curl',
            setsCount: 3,
            repsMin: 8,
            repsMax: 10,
            supersetGroup: 'A',
          },
          {
            exerciseName: 'EZ-Bar Skullcrusher',
            setsCount: 3,
            repsMin: 10,
            repsMax: 12,
            supersetGroup: 'B',
          },
          {
            exerciseName: 'Incline Dumbbell Curl',
            setsCount: 3,
            repsMin: 10,
            repsMax: 12,
            supersetGroup: 'B',
          },
          { exerciseName: 'Cable Tricep Pushdown', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Dumbbell Hammer Curl', setsCount: 3, repsMin: 12, repsMax: 15 },
        ],
      },
    ],
  },
  {
    id: 'bodyweight-3',
    name: 'Bodyweight / Home Minimalist',
    tag: '3 days / week · Minimal Equipment',
    daysPerWeek: 3,
    description: 'Calisthenics and minimal-equipment strength split you can do anywhere.',
    days: [
      {
        title: 'Day 1 • Upper Bodyweight',
        items: [
          { exerciseName: 'Push-Up', setsCount: 4, repsMin: 10, repsMax: 15 },
          { exerciseName: 'Pull-Up', setsCount: 4, repsMin: 6, repsMax: 10 },
          { exerciseName: 'Parallel Bar Dip', setsCount: 3, repsMin: 8, repsMax: 12 },
          { exerciseName: 'Inverted Row', setsCount: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        title: 'Day 2 • Lower & Core',
        items: [
          { exerciseName: 'Bodyweight Squat', setsCount: 4, repsMin: 15, repsMax: 20 },
          {
            exerciseName: 'Dumbbell Bulgarian Split Squat',
            setsCount: 3,
            repsMin: 10,
            repsMax: 12,
          },
          { exerciseName: 'Glute Bridge', setsCount: 3, repsMin: 15, repsMax: 15 },
          { exerciseName: 'Plank', setsCount: 3, durationSeconds: 60 },
        ],
      },
      {
        title: 'Day 3 • Full Body Conditioning',
        items: [
          { exerciseName: 'Chin-Up', setsCount: 3, repsMin: 6, repsMax: 10 },
          { exerciseName: 'Push-Up', setsCount: 3, repsMin: 12, repsMax: 15 },
          { exerciseName: 'Hanging Knee Raise', setsCount: 3, repsMin: 10, repsMax: 12 },
          { exerciseName: 'Side Plank', setsCount: 3, durationSeconds: 45 },
          { exerciseName: 'Dead Bug', setsCount: 3, repsMin: 12, repsMax: 12 },
        ],
      },
    ],
  },
];

// ─── Part 3: Measurements, Weekly Streaks & Physical Gym Memberships ───

export type MeasurementUnitKind = 'mass' | 'length' | 'percent';
export type MeasurementUnit = 'kg' | 'lb' | 'cm' | 'in' | '%';

export interface MeasurementDefinition {
  id: string;
  label: string;
  unit_kind: MeasurementUnitKind;
  metric_unit: MeasurementUnit;
  imperial_unit: MeasurementUnit;
  min_value: number;
  max_value: number;
  decimals: number;
  position: number;
}

export interface MeasurementEntry {
  id: string;
  subject_user_id: string;
  workspace_id: string | null;
  definition_id: string;
  value: number;
  unit: MeasurementUnit;
  value_canonical: number;
  measured_on: string;
  recorded_by: string | null;
  note: string;
  created_at: string;
}

export function toCanonicalMeasurement(value: number, unit: MeasurementUnit): number {
  if (unit === 'lb') return roundWeight(value * KG_PER_LB, 2);
  if (unit === 'in') return roundWeight(value * 2.54, 2);
  return roundWeight(value, 2);
}

export interface MeasurementChartPoint {
  date: string;
  value: number | null;
  dayOffset: number;
}

export interface MeasurementSeriesSummary {
  points: MeasurementChartPoint[];
  latestValue: number | null;
  firstValue: number | null;
  delta: number | null;
  minValue: number | null;
  maxValue: number | null;
  hasGaps: boolean;
}

// Builds a chronological series for a measurement definition.
// Gaps stay gaps (missing dates are represented with value: null or proportional dayOffset, never 0).
export function buildMeasurementSeries(
  entries: ReadonlyArray<Pick<MeasurementEntry, 'measured_on' | 'value'>>,
): MeasurementSeriesSummary {
  if (entries.length === 0) {
    return {
      points: [],
      latestValue: null,
      firstValue: null,
      delta: null,
      minValue: null,
      maxValue: null,
      hasGaps: false,
    };
  }

  // Deduplicate by date (latest entry on the same date wins) and sort ascending.
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (e.value > 0) byDate.set(e.measured_on.slice(0, 10), Number(e.value));
  }
  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  if (sortedDates.length === 0) {
    return {
      points: [],
      latestValue: null,
      firstValue: null,
      delta: null,
      minValue: null,
      maxValue: null,
      hasGaps: false,
    };
  }

  const firstMs = new Date(`${sortedDates[0]}T00:00:00Z`).getTime();
  const points: MeasurementChartPoint[] = [];
  let hasGaps = false;

  for (let i = 0; i < sortedDates.length; i += 1) {
    const d = sortedDates[i]!;
    const ms = new Date(`${d}T00:00:00Z`).getTime();
    const dayOffset = Math.round((ms - firstMs) / 86_400_000);
    if (i > 0) {
      const prevD = sortedDates[i - 1]!;
      const prevMs = new Date(`${prevD}T00:00:00Z`).getTime();
      const gapDays = Math.round((ms - prevMs) / 8_6400_000);
      if (gapDays > 1) {
        hasGaps = true;
        // Insert a null gap marker when entries are more than 14 days apart so charts can show a break, never 0.
        if (gapDays > 14) {
          points.push({
            date: '',
            value: null,
            dayOffset: Math.round((prevMs - firstMs) / 86_400_000) + Math.floor(gapDays / 2),
          });
        }
      }
    }
    points.push({
      date: d,
      value: byDate.get(d)!,
      dayOffset,
    });
  }

  const values = [...byDate.values()];
  const firstValue = byDate.get(sortedDates[0]!)!;
  const latestValue = byDate.get(sortedDates[sortedDates.length - 1]!)!;

  return {
    points,
    latestValue,
    firstValue,
    delta: sortedDates.length > 1 ? roundWeight(latestValue - firstValue, 2) : null,
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
    hasGaps,
  };
}

// Weekly streak (§3.8): rest days never break a streak; a week counts when sessions >= weeklyTarget.
// One automatic freeze every 4 weeks or a trainer pause preserves the streak.
export interface WeeklyStreakSummary {
  currentWeeks: number;
  bestWeeks: number;
  thisWeekCompleted: number;
  weeklyTarget: number;
  freezeUsed: boolean;
  isPaused: boolean;
  statusText: string;
}

function isoWeekStart(dateStrOrIso: string): string {
  const d = new Date(dateStrOrIso);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const diffToMon = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diffToMon);
  return utc.toISOString().slice(0, 10);
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeWeeklyStreak(
  completedSessionTimestamps: ReadonlyArray<string>,
  weeklyTarget = 3,
  options?: {
    nowIso?: string;
    pausedUntil?: string | null;
    freezesAvailable?: number;
  },
): WeeklyStreakSummary {
  const target = Math.max(1, Math.min(7, weeklyTarget));
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const currentWeekMonday = isoWeekStart(nowIso);
  const todayDate = nowIso.slice(0, 10);
  const isPaused = Boolean(options?.pausedUntil && options.pausedUntil >= todayDate);

  const countsByWeek = new Map<string, number>();
  for (const ts of completedSessionTimestamps) {
    const wk = isoWeekStart(ts);
    countsByWeek.set(wk, (countsByWeek.get(wk) ?? 0) + 1);
  }

  const thisWeekCompleted = countsByWeek.get(currentWeekMonday) ?? 0;

  // Walk backwards week by week from last week (plus current week if already met).
  let currentWeeks = thisWeekCompleted >= target ? 1 : 0;
  let freezesLeft = options?.freezesAvailable ?? 1;
  let freezeUsed = false;

  let cursorWeek = addDaysIso(currentWeekMonday, -7);
  let consecutiveCounted = 0;

  for (let i = 0; i < 52; i += 1) {
    const cnt = countsByWeek.get(cursorWeek) ?? 0;
    if (cnt >= target) {
      currentWeeks += 1;
      consecutiveCounted += 1;
      if (consecutiveCounted % 4 === 0 && freezesLeft < 1) {
        freezesLeft = 1;
      }
    } else if (isPaused) {
      // Trainer pause preserves streak without incrementing
      break;
    } else if (
      freezesLeft > 0 &&
      (currentWeeks > 0 || (countsByWeek.get(addDaysIso(cursorWeek, -7)) ?? 0) >= target)
    ) {
      freezesLeft -= 1;
      freezeUsed = true;
    } else {
      break;
    }
    cursorWeek = addDaysIso(cursorWeek, -7);
  }

  // Compute best streak across all recorded weeks
  const allWeeks = [...countsByWeek.keys()].sort((a, b) => a.localeCompare(b));
  let bestWeeks = currentWeeks;
  let run = 0;
  let prevWk: string | null = null;
  for (const wk of allWeeks) {
    if ((countsByWeek.get(wk) ?? 0) >= target) {
      if (prevWk && addDaysIso(prevWk, 7) === wk) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > bestWeeks) bestWeeks = run;
      prevWk = wk;
    }
  }

  let statusText: string;
  if (isPaused) {
    statusText = `Streak paused · ${currentWeeks}-week streak protected`;
  } else if (currentWeeks > 0) {
    statusText = `${currentWeeks}-week streak · ${thisWeekCompleted} of ${target} sessions this week`;
  } else {
    statusText = `New streak starts this week · ${thisWeekCompleted} of ${target} sessions`;
  }

  return {
    currentWeeks,
    bestWeeks,
    thisWeekCompleted,
    weeklyTarget: target,
    freezeUsed,
    isPaused,
    statusText,
  };
}

export type GymMembershipStatus = 'active' | 'paused' | 'expired' | 'cancelled';

export interface GymMembershipRecord {
  id: string;
  workspace_id: string;
  member_id: string;
  plan_label: string;
  start_date: string;
  end_date: string;
  status: GymMembershipStatus;
  notes: string;
}

export function daysUntilMembershipExpiry(
  endDate: string,
  todayIso = new Date().toISOString().slice(0, 10),
): number {
  const endMs = new Date(`${endDate.slice(0, 10)}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((endMs - todayMs) / 86_400_000);
}

export function filterExpiringMemberships(
  memberships: ReadonlyArray<GymMembershipRecord>,
  withinDays: number,
  todayIso = new Date().toISOString().slice(0, 10),
): GymMembershipRecord[] {
  return memberships
    .filter((m) => {
      if (m.status === 'cancelled') return false;
      const days = daysUntilMembershipExpiry(m.end_date, todayIso);
      return days >= 0 && days <= withinDays;
    })
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}
