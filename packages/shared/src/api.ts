import type { SupabaseClient } from '@supabase/supabase-js';

import type { Access, Role, WorkspaceType } from './access';
import type { InvitationInfo } from './invitations';
import type {
  GymMembershipRecord,
  GymMembershipStatus,
  MeasurementDefinition,
  MeasurementEntry,
  MeasurementUnit,
  ProgramVersionStatus,
  ResourceScope,
  SessionStatus,
  SetRecord,
  SetType,
  TrackingType,
  WeightUnit,
} from './workouts';

// Error keys raised by the database (supabase/migrations) and shown through i18n.
const ERROR_KEYS = new Set([
  'not_authenticated',
  'not_allowed',
  'not_found',
  'invalid_name',
  'invalid_email',
  'already_member',
  'last_owner',
  'invitation_invalid',
  'invitation_expired',
  'invitation_used',
  'invitation_revoked',
  'invitation_wrong_account',
  'version_immutable',
  'invalid_ops',
  'unknown_op_type',
]);

export class AppError extends Error {
  constructor(public readonly key: string) {
    super(key);
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = (error as { message?: string } | null)?.message ?? '';
  return new AppError(ERROR_KEYS.has(message) ? message : 'generic');
}

// Supabase Auth error codes → i18n error keys. Never reveals whether an email is registered.
export function authErrorKey(error: { code?: string } | null): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'sign_in_failed';
    case 'user_already_exists':
    case 'email_exists':
      return 'user_already_exists';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'weak_password':
      return 'weak_password';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
    case 'otp_expired':
      return 'link_invalid';
    default:
      return 'generic';
  }
}

export interface RosterEntry {
  id: string;
  user_id: string;
  roles: Role[];
  status: 'active' | 'archived';
  joined_at: string;
  profile: { display_name: string } | null;
}

export interface PendingInvitation {
  id: string;
  email: string | null;
  role: Role;
  expires_at: string;
  created_at: string;
}

export interface ClientRecord {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
}

export interface TrainerAssignment {
  id: string;
  trainer_member_id: string;
  client_member_id: string;
}

export interface AdminWorkspace {
  id: string;
  type: WorkspaceType;
  name: string;
  created_at: string;
  members: number;
  trainers: number;
}

export interface Exercise {
  id: string;
  scope: ResourceScope;
  workspace_id: string | null;
  owner_user_id: string | null;
  name: string;
  instructions: string;
  tracking_type: TrackingType;
  primary_muscle: string;
  equipment_id: string;
  default_rest_seconds: number;
  placeholder_demo: string;
}

export interface ProgramItem {
  id: string;
  program_day_id: string;
  exercise_id: string;
  position: number;
  superset_group: string | null;
  tracking_type: TrackingType | null;
  sets_count: number;
  set_type: SetType;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_value: number | null;
  target_weight_unit: WeightUnit | null;
  target_duration_s: number | null;
  target_rpe: number | null;
  rest_seconds: number;
  instructions: string;
  notes: string;
  exercise?: Exercise;
}

export interface ProgramDay {
  id: string;
  program_version_id: string;
  week_index: number;
  day_index: number;
  title: string;
  weekday_hint: number | null;
  items?: ProgramItem[];
}

export interface ProgramVersionSummary {
  id: string;
  program_id: string;
  version_number: number;
  status: ProgramVersionStatus;
  published_at: string | null;
  days?: ProgramDay[];
}

export interface ProgramSummary {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  client_member_id: string | null;
  created_at: string;
  versions: ProgramVersionSummary[];
}

export interface ProgramAssignment {
  id: string;
  workspace_id: string;
  client_member_id: string;
  program_version_id: string;
  start_date: string;
  status: 'active' | 'ended';
  program_version?: {
    id: string;
    version_number: number;
    program: { id: string; name: string; description: string } | null;
    days?: ProgramDay[];
  };
}

export interface SessionExerciseRecord {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  superset_group: string | null;
  tracking_type: TrackingType;
  rest_seconds: number;
  skipped: boolean;
  skip_reason: string | null;
  notes: string;
  exercise?: Exercise;
  sets: SetRecord[];
}

export interface SessionCommentRecord {
  id: string;
  session_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

export interface HighFiveRecord {
  id: string;
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  comment: string;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: 'workout_assigned' | 'high_five' | 'membership_expiring';
  title: string;
  body: string;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

export interface StreakRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  weekly_target: number;
  current_weeks: number;
  best_weeks: number;
  freezes_available: number;
  paused_until: string | null;
  paused_reason: string;
}

export interface DeletionRequestRecord {
  id: string;
  user_id: string | null;
  email: string;
  source: 'in_app' | 'web';
  status: 'requested' | 'verified' | 'scheduled' | 'completed' | 'cancelled';
  reason: string;
  scheduled_for: string;
  created_at: string;
}

export interface WorkoutSessionRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  assignment_id: string | null;
  program_version_id: string | null;
  program_day_id: string | null;
  title: string;
  planned_snapshot: Record<string, unknown>;
  status: SessionStatus;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  notes: string;
  revision: number;
  exercises?: SessionExerciseRecord[];
  comments?: SessionCommentRecord[];
}

export interface SyncOpInput {
  op_id: string;
  type: 'upsert_session' | 'upsert_exercise' | 'upsert_set' | 'delete_set';
  payload: Record<string, unknown>;
  base_revision?: number;
}

export interface SyncOpResult {
  op_id: string;
  status: 'synced';
  entity_id: string;
  revision?: number;
}

// Rows are cast to the interfaces above until generated database types replace them.
async function must<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data as T;
}

// Every database call both apps make, in one place.
export function gravnApi(sb: SupabaseClient) {
  const rpc = <T>(fn: string, args?: Record<string, unknown>) => must<T>(sb.rpc(fn, args));

  return {
    getMyAccess: () => rpc<Access>('get_my_access'),
    createWorkspace: (type: 'gym' | 'coach', name: string) =>
      rpc<string>('create_workspace', { p_type: type, p_name: name }),
    renameWorkspace: (id: string, name: string) =>
      must<void>(sb.from('workspaces').update({ name }).eq('id', id)),
    setOwnerTrainer: (workspaceId: string, enabled: boolean) =>
      rpc<void>('set_owner_trainer', { p_workspace: workspaceId, p_enabled: enabled }),

    getInvitation: (token: string) => rpc<InvitationInfo>('get_invitation', { p_token: token }),
    createInvitation: (
      workspaceId: string,
      email: string | null,
      role: Role,
      clientRecordId?: string,
    ) =>
      rpc<string>('create_invitation', {
        p_workspace: workspaceId,
        p_email: email,
        p_role: role,
        p_client_record: clientRecordId ?? null,
      }),
    acceptInvitation: (token: string) => rpc<string>('accept_invitation', { p_token: token }),
    revokeInvitation: (id: string) => rpc<void>('revoke_invitation', { p_invitation: id }),
    pendingInvitations: (workspaceId: string) =>
      must<PendingInvitation[]>(
        sb
          .from('invitations')
          .select('id, email, role, expires_at, created_at')
          .eq('workspace_id', workspaceId)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ),

    roster: (workspaceId: string) =>
      must<RosterEntry[]>(
        sb
          .from('workspace_members')
          .select('id, user_id, roles, status, joined_at, profile:profiles(display_name)')
          .eq('workspace_id', workspaceId)
          .order('joined_at'),
      ),
    removeMember: (workspaceId: string, memberId: string) =>
      rpc<void>('remove_member', { p_workspace: workspaceId, p_member: memberId }),
    restoreMember: (workspaceId: string, memberId: string) =>
      rpc<void>('restore_member', { p_workspace: workspaceId, p_member: memberId }),

    assignments: (workspaceId: string) =>
      must<TrainerAssignment[]>(
        sb
          .from('trainer_assignments')
          .select('id, trainer_member_id, client_member_id')
          .eq('workspace_id', workspaceId)
          .is('ended_at', null),
      ),
    assignTrainer: (workspaceId: string, trainerMemberId: string, clientMemberId: string) =>
      rpc<string>('assign_trainer', {
        p_workspace: workspaceId,
        p_trainer_member: trainerMemberId,
        p_client_member: clientMemberId,
      }),
    endAssignment: (id: string) => rpc<void>('end_trainer_assignment', { p_assignment: id }),

    clientRecords: (workspaceId: string) =>
      must<ClientRecord[]>(
        sb
          .from('client_records')
          .select('id, display_name, email, phone')
          .eq('workspace_id', workspaceId)
          .is('claimed_by_member_id', null)
          .order('created_at'),
      ),
    addClientRecord: (
      workspaceId: string,
      record: { displayName: string; email?: string; phone?: string },
    ) =>
      must<void>(
        sb.from('client_records').insert({
          workspace_id: workspaceId,
          display_name: record.displayName,
          email: record.email ?? null,
          phone: record.phone ?? null,
        }),
      ),
    deleteClientRecord: (id: string) => must<void>(sb.from('client_records').delete().eq('id', id)),

    profile: (userId: string) =>
      must<{ display_name: string; unit_system: 'metric' | 'imperial'; timezone: string }>(
        sb
          .from('profiles')
          .select('display_name, unit_system, timezone')
          .eq('user_id', userId)
          .single(),
      ),
    updateProfile: (
      userId: string,
      changes: { displayName?: string; unitSystem?: 'metric' | 'imperial'; onboarded?: true },
    ) =>
      must<void>(
        sb
          .from('profiles')
          .update({
            display_name: changes.displayName,
            unit_system: changes.unitSystem,
            onboarded_at: changes.onboarded ? new Date().toISOString() : undefined,
          })
          .eq('user_id', userId),
      ),

    adminWorkspaces: () => rpc<AdminWorkspace[]>('admin_workspaces'),

    // Part 2: Exercise catalog -----------------------------------------------
    exercises: () =>
      must<Exercise[]>(
        sb
          .from('exercises')
          .select(
            'id, scope, workspace_id, owner_user_id, name, instructions, tracking_type, primary_muscle, equipment_id, default_rest_seconds, placeholder_demo',
          )
          .order('name'),
      ),
    favoriteExerciseIds: async (userId: string): Promise<string[]> => {
      const rows = await must<{ exercise_id: string }[]>(
        sb.from('exercise_favorites').select('exercise_id').eq('user_id', userId),
      );
      return rows.map((r) => r.exercise_id);
    },
    toggleFavoriteExercise: (userId: string, exerciseId: string, favorite: boolean) =>
      favorite
        ? must<void>(
            sb.from('exercise_favorites').insert({ user_id: userId, exercise_id: exerciseId }),
          )
        : must<void>(
            sb
              .from('exercise_favorites')
              .delete()
              .eq('user_id', userId)
              .eq('exercise_id', exerciseId),
          ),
    createExercise: (input: {
      scope: 'workspace' | 'personal';
      workspaceId?: string;
      ownerUserId?: string;
      name: string;
      instructions?: string;
      trackingType: TrackingType;
      primaryMuscle: string;
      equipmentId: string;
      defaultRestSeconds?: number;
    }) =>
      must<Exercise>(
        sb
          .from('exercises')
          .insert({
            scope: input.scope,
            workspace_id: input.scope === 'workspace' ? (input.workspaceId ?? null) : null,
            owner_user_id: input.scope === 'personal' ? (input.ownerUserId ?? null) : null,
            name: input.name,
            instructions: input.instructions ?? '',
            tracking_type: input.trackingType,
            primary_muscle: input.primaryMuscle,
            equipment_id: input.equipmentId,
            default_rest_seconds: input.defaultRestSeconds ?? 90,
          })
          .select('*')
          .single(),
      ),

    // Part 2: Programs and assignments ---------------------------------------
    programs: (workspaceId: string) =>
      must<ProgramSummary[]>(
        sb
          .from('programs')
          .select(
            'id, workspace_id, name, description, client_member_id, created_at, versions:program_versions(id, program_id, version_number, status, published_at, days:program_days(id, program_version_id, week_index, day_index, title, weekday_hint))',
          )
          .eq('workspace_id', workspaceId)
          .is('archived_at', null)
          .order('created_at', { ascending: false }),
      ),
    programVersion: (versionId: string) =>
      must<
        ProgramVersionSummary & {
          program: { id: string; name: string; description: string; workspace_id: string };
          days: ProgramDay[];
        }
      >(
        sb
          .from('program_versions')
          .select(
            'id, program_id, version_number, status, published_at, program:programs(id, name, description, workspace_id), days:program_days(id, program_version_id, week_index, day_index, title, weekday_hint, items:program_items(*, exercise:exercises(*)))',
          )
          .eq('id', versionId)
          .single(),
      ),
    createProgram: (workspaceId: string, name: string, description = '', clientMemberId?: string) =>
      rpc<{ program_id: string; version_id: string; day_id: string }>('create_program', {
        p_workspace: workspaceId,
        p_name: name,
        p_description: description,
        p_client_member: clientMemberId ?? null,
      }),
    createProgramDraft: (programId: string) =>
      rpc<string>('create_program_draft', { p_program: programId }),
    publishProgram: (versionId: string) => rpc<string>('publish_program', { p_version: versionId }),
    duplicateProgram: (programId: string, name: string, clientMemberId?: string) =>
      rpc<{ program_id: string; version_id: string }>('duplicate_program', {
        p_program: programId,
        p_name: name,
        p_client_member: clientMemberId ?? null,
      }),
    addProgramDay: (versionId: string, weekIndex: number, dayIndex: number, title: string) =>
      must<ProgramDay>(
        sb
          .from('program_days')
          .insert({
            program_version_id: versionId,
            week_index: weekIndex,
            day_index: dayIndex,
            title,
          })
          .select('*')
          .single(),
      ),
    deleteProgramDay: (dayId: string) =>
      must<void>(sb.from('program_days').delete().eq('id', dayId)),
    addProgramItem: (input: {
      programDayId: string;
      exerciseId: string;
      position: number;
      setsCount: number;
      setType?: SetType;
      targetRepsMin?: number | null;
      targetRepsMax?: number | null;
      targetWeightValue?: number | null;
      targetWeightUnit?: WeightUnit | null;
      targetDurationS?: number | null;
      restSeconds?: number;
      supersetGroup?: string | null;
      notes?: string;
    }) =>
      must<ProgramItem>(
        sb
          .from('program_items')
          .insert({
            program_day_id: input.programDayId,
            exercise_id: input.exerciseId,
            position: input.position,
            sets_count: input.setsCount,
            set_type: input.setType ?? 'working',
            target_reps_min: input.targetRepsMin ?? null,
            target_reps_max: input.targetRepsMax ?? null,
            target_weight_value: input.targetWeightValue ?? null,
            target_weight_unit: input.targetWeightUnit ?? null,
            target_duration_s: input.targetDurationS ?? null,
            rest_seconds: input.restSeconds ?? 90,
            superset_group: input.supersetGroup ?? null,
            notes: input.notes ?? '',
          })
          .select('*')
          .single(),
      ),
    updateProgramItem: (
      itemId: string,
      changes: Partial<{
        position: number;
        sets_count: number;
        notes: string;
        superset_group: string | null;
      }>,
    ) => must<void>(sb.from('program_items').update(changes).eq('id', itemId)),
    deleteProgramItem: (itemId: string) =>
      must<void>(sb.from('program_items').delete().eq('id', itemId)),
    assignProgram: (
      workspaceId: string,
      clientMemberId: string,
      versionId: string,
      startDate?: string,
    ) =>
      rpc<string>('assign_program', {
        p_workspace: workspaceId,
        p_client_member: clientMemberId,
        p_version: versionId,
        p_start_date: startDate ?? new Date().toISOString().slice(0, 10),
      }),
    endProgramAssignment: (assignmentId: string) =>
      rpc<void>('end_program_assignment', { p_assignment: assignmentId }),
    programAssignments: (workspaceId: string) =>
      must<ProgramAssignment[]>(
        sb
          .from('assignments')
          .select(
            'id, workspace_id, client_member_id, program_version_id, start_date, status, program_version:program_versions(id, version_number, program:programs(id, name, description), days:program_days(id, program_version_id, week_index, day_index, title, weekday_hint, items:program_items(*, exercise:exercises(*))))',
          )
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
      ),

    // Part 2: Sessions, sync and trainer review ------------------------------
    sessions: (workspaceId: string, userId?: string) => {
      let q = sb
        .from('workout_sessions')
        .select(
          'id, user_id, workspace_id, assignment_id, program_version_id, program_day_id, title, planned_snapshot, status, started_at, finished_at, duration_seconds, notes, revision, exercises:session_exercises(*, exercise:exercises(*), sets:session_sets(*)), comments:session_comments(*)',
        )
        .eq('workspace_id', workspaceId)
        .order('started_at', { ascending: false })
        .limit(30);
      if (userId) q = q.eq('user_id', userId);
      return must<WorkoutSessionRecord[]>(q);
    },
    sessionDetail: (sessionId: string) =>
      must<WorkoutSessionRecord>(
        sb
          .from('workout_sessions')
          .select(
            'id, user_id, workspace_id, assignment_id, program_version_id, program_day_id, title, planned_snapshot, status, started_at, finished_at, duration_seconds, notes, revision, exercises:session_exercises(*, exercise:exercises(*), sets:session_sets(*)), comments:session_comments(*)',
          )
          .eq('id', sessionId)
          .single(),
      ),
    addSessionComment: (sessionId: string, body: string) =>
      must<void>(sb.from('session_comments').insert({ session_id: sessionId, body })),
    syncPush: (ops: SyncOpInput[]) => rpc<SyncOpResult[]>('sync_push', { p_ops: ops }),

    // Part 3: Measurements, Gym Memberships, High-Fives, Streaks & Privacy ---
    measurementDefinitions: () =>
      must<MeasurementDefinition[]>(
        sb.from('measurement_definitions').select('*').order('position', { ascending: true }),
      ),
    measurementEntries: (subjectUserId: string, workspaceId?: string) => {
      let q = sb
        .from('measurement_entries')
        .select('*')
        .eq('subject_user_id', subjectUserId)
        .order('measured_on', { ascending: false })
        .limit(120);
      if (workspaceId) q = q.eq('workspace_id', workspaceId);
      return must<MeasurementEntry[]>(q);
    },
    workspaceMeasurementEntries: (workspaceId: string) =>
      must<MeasurementEntry[]>(
        sb
          .from('measurement_entries')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('measured_on', { ascending: false })
          .limit(300),
      ),
    recordMeasurement: (input: {
      subjectUserId: string;
      workspaceId: string | null;
      definitionId: string;
      value: number;
      unit: MeasurementUnit;
      measuredOn?: string;
      note?: string;
    }) =>
      rpc<MeasurementEntry>('record_measurement', {
        p_subject_user_id: input.subjectUserId,
        p_workspace_id: input.workspaceId,
        p_definition_id: input.definitionId,
        p_value: input.value,
        p_unit: input.unit,
        p_measured_on: input.measuredOn ?? new Date().toISOString().slice(0, 10),
        p_note: input.note ?? '',
      }),
    deleteMeasurement: (entryId: string) =>
      must<void>(sb.from('measurement_entries').delete().eq('id', entryId)),

    gymMemberships: (workspaceId: string) =>
      must<GymMembershipRecord[]>(
        sb
          .from('gym_memberships')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('end_date', { ascending: true }),
      ),
    upsertGymMembership: (input: {
      workspaceId: string;
      memberId: string;
      planLabel: string;
      startDate: string;
      endDate: string;
      status?: GymMembershipStatus;
      notes?: string;
    }) =>
      rpc<GymMembershipRecord>('upsert_gym_membership', {
        p_workspace_id: input.workspaceId,
        p_member_id: input.memberId,
        p_plan_label: input.planLabel,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_status: input.status ?? 'active',
        p_notes: input.notes ?? '',
      }),

    highFivesForSessions: (sessionIds: string[]) => {
      if (sessionIds.length === 0) return Promise.resolve([] as HighFiveRecord[]);
      return must<HighFiveRecord[]>(sb.from('high_fives').select('*').in('session_id', sessionIds));
    },
    sendHighFive: (sessionId: string, comment = '') =>
      rpc<HighFiveRecord>('send_high_five', {
        p_session_id: sessionId,
        p_comment: comment,
      }),
    notifications: (userId: string) =>
      must<NotificationRecord[]>(
        sb
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ),
    markNotificationRead: (notificationId: string) =>
      must<void>(
        sb
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId),
      ),
    streaks: (workspaceId: string, userId?: string) => {
      let q = sb.from('streaks').select('*').eq('workspace_id', workspaceId);
      if (userId) q = q.eq('user_id', userId);
      return must<StreakRecord[]>(q);
    },
    pauseClientStreak: (input: {
      workspaceId: string;
      userId: string;
      pausedUntil: string | null;
      reason?: string;
    }) =>
      rpc<StreakRecord>('pause_client_streak', {
        p_workspace_id: input.workspaceId,
        p_user_id: input.userId,
        p_paused_until: input.pausedUntil,
        p_reason: input.reason ?? '',
      }),

    requestAccountDeletion: (reason = '') =>
      rpc<DeletionRequestRecord>('request_account_deletion', { p_reason: reason }),
    requestPublicDeletion: (email: string, reason = '') =>
      rpc<string>('request_public_deletion', { p_email: email, p_reason: reason }),
    submitProblemReport: (input: {
      userId: string;
      workspaceId?: string | null;
      appVersion?: string;
      platform?: string;
      screen: string;
      description: string;
    }) =>
      must<void>(
        sb.from('problem_reports').insert({
          user_id: input.userId,
          workspace_id: input.workspaceId ?? null,
          app_version: input.appVersion ?? '1.0.0',
          platform: input.platform ?? 'web',
          screen: input.screen,
          description: input.description,
        }),
      ),
  };
}

export type GravnApi = ReturnType<typeof gravnApi>;
