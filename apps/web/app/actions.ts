'use server';

import {
  clientRecordSchema,
  commentSchema,
  detectSetPr,
  inviteSchema,
  inviteUrl,
  parseForm,
  profileSchema,
  programDaySchema,
  programItemSchema,
  programSchema,
  type SetRecord,
  type SetType,
  type SyncOpInput,
  t,
  type WeightUnit,
  workspaceSchema,
} from '@gravn/shared';
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { field, fieldErrors, type FormState, mutate } from '@/lib/form-state';
import { api, getUser } from '@/lib/supabase';

// Signed-in mutations. The form's workspace and member IDs are untrusted: every call
// below runs as the user, and RLS or the RPC decides whether it is allowed.

const ws = (formData: FormData) => field(formData, 'workspaceId');

export async function createWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(workspaceSchema, {
    type: field(formData, 'type'),
    name: field(formData, 'name'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  let id = '';
  const result = await mutate(formData, async () => {
    id = await (await api()).createWorkspace(parsed.data.type, parsed.data.name);
  });
  if (!id) return result;
  redirect(`/w/${id}`);
}

export async function acceptInvitation(_: FormState, formData: FormData): Promise<FormState> {
  let joined = false;
  const result = await mutate(formData, async () => {
    await (await api()).acceptInvitation(field(formData, 'token'));
    joined = true;
  });
  if (!joined) return result;
  redirect('/home');
}

export async function invite(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(inviteSchema, {
    email: field(formData, 'email'),
    role: field(formData, 'role'),
    clientRecordId: field(formData, 'clientRecordId'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  const { email, role, clientRecordId } = parsed.data;
  return mutate(formData, async () => {
    const token = await (
      await api()
    ).createInvitation(ws(formData), email ?? null, role, clientRecordId);
    return {
      notice: email ? t('people.invite_created', { email }) : t('people.invite_link_created'),
      link: inviteUrl(env.siteUrl, token),
    };
  });
}

export async function addPerson(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(clientRecordSchema, {
    displayName: field(formData, 'displayName'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () => (await api()).addClientRecord(ws(formData), parsed.data));
}

export const deletePerson = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => (await api()).deleteClientRecord(field(formData, 'recordId')));

export const revokeInvitation = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => (await api()).revokeInvitation(field(formData, 'invitationId')));

export const removeMember = async (_: FormState, formData: FormData) =>
  mutate(formData, async () =>
    (await api()).removeMember(ws(formData), field(formData, 'memberId')),
  );

export const restoreMember = async (_: FormState, formData: FormData) =>
  mutate(formData, async () =>
    (await api()).restoreMember(ws(formData), field(formData, 'memberId')),
  );

export const assignTrainer = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (
      await api()
    ).assignTrainer(ws(formData), field(formData, 'trainerId'), field(formData, 'memberId'));
  });

export const endAssignment = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => (await api()).endAssignment(field(formData, 'assignmentId')));

export async function renameWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(workspaceSchema.pick({ name: true }), { name: field(formData, 'name') });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () =>
    (await api()).renameWorkspace(ws(formData), parsed.data.name),
  );
}

export const toggleOwnerTrainer = async (_: FormState, formData: FormData) =>
  mutate(formData, async () =>
    (await api()).setOwnerTrainer(ws(formData), field(formData, 'enabled') === 'true'),
  );

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(profileSchema, {
    displayName: field(formData, 'displayName'),
    unitSystem: field(formData, 'unitSystem'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  const user = await getUser();
  return mutate(formData, async () => (await api()).updateProfile(user!.id, parsed.data));
}

export async function createProgramAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(programSchema, {
    name: field(formData, 'name'),
    description: field(formData, 'description'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () => {
    await (await api()).createProgram(ws(formData), parsed.data.name, parsed.data.description);
  });
}

export const publishProgramAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (await api()).publishProgram(field(formData, 'versionId'));
  });

export const createProgramDraftAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (await api()).createProgramDraft(field(formData, 'programId'));
  });

export async function addProgramDayAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(programDaySchema, {
    title: field(formData, 'title'),
    weekIndex: field(formData, 'weekIndex') || '1',
    dayIndex: field(formData, 'dayIndex') || '1',
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () => {
    await (
      await api()
    ).addProgramDay(
      field(formData, 'versionId'),
      parsed.data.weekIndex,
      parsed.data.dayIndex,
      parsed.data.title,
    );
  });
}

export async function addProgramItemAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(programItemSchema, {
    exerciseId: field(formData, 'exerciseId'),
    setsCount: field(formData, 'setsCount') || '3',
    targetRepsMin: field(formData, 'targetRepsMin') || '8',
    targetRepsMax: field(formData, 'targetRepsMax') || '10',
    restSeconds: field(formData, 'restSeconds') || '90',
    supersetGroup: field(formData, 'supersetGroup'),
    notes: field(formData, 'notes'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () => {
    await (
      await api()
    ).addProgramItem({
      programDayId: field(formData, 'dayId'),
      exerciseId: parsed.data.exerciseId,
      position: Number(field(formData, 'position') || '1'),
      setsCount: parsed.data.setsCount,
      targetRepsMin: parsed.data.targetRepsMin,
      targetRepsMax: parsed.data.targetRepsMax,
      restSeconds: parsed.data.restSeconds,
      supersetGroup: parsed.data.supersetGroup,
      notes: parsed.data.notes,
    });
  });
}

export const deleteProgramItemAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (await api()).deleteProgramItem(field(formData, 'itemId'));
  });

export const assignProgramAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (
      await api()
    ).assignProgram(ws(formData), field(formData, 'clientMemberId'), field(formData, 'versionId'));
  });

export const endProgramAssignmentAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    await (await api()).endProgramAssignment(field(formData, 'assignmentId'));
  });

export const startWebSessionAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const user = await getUser();
    const workspaceId = ws(formData);
    const assignmentId = field(formData, 'assignmentId') || null;
    const versionId = field(formData, 'versionId') || null;
    const dayId = field(formData, 'dayId') || null;
    const customTitle = field(formData, 'customTitle') || null;
    const profile = await client.profile(user!.id);
    const unit: WeightUnit = profile.unit_system === 'imperial' ? 'lb' : 'kg';

    let title = customTitle ?? t('workout.today_title');
    let plannedSnapshot: Record<string, unknown> = {};
    const ops: SyncOpInput[] = [];
    const sessionId = randomUUID();
    const nowIso = new Date().toISOString();

    if (versionId && dayId) {
      const ver = await client.programVersion(versionId);
      const day = (ver.days ?? []).find((d) => d.id === dayId);
      if (day) {
        title = customTitle ?? (day.title === 'Day 1' ? ver.program.name : day.title);
        plannedSnapshot = { day_id: day.id, title };
        const items = [...(day.items ?? [])].sort((a, b) => a.position - b.position);
        items.forEach((item, idx) => {
          const exId = randomUUID();
          const tracking = item.exercise?.tracking_type ?? 'weight_reps';
          ops.push({
            op_id: randomUUID(),
            type: 'upsert_exercise',
            payload: {
              id: exId,
              session_id: sessionId,
              exercise_id: item.exercise_id,
              position: idx + 1,
              superset_group: item.superset_group ?? null,
              tracking_type: tracking,
              rest_seconds: item.rest_seconds ?? item.exercise?.default_rest_seconds ?? 90,
              skipped: false,
              skip_reason: null,
              notes: item.notes ?? '',
            },
          });
          const setsCount = Math.max(1, item.sets_count);
          for (let sIdx = 0; sIdx < setsCount; sIdx += 1) {
            ops.push({
              op_id: randomUUID(),
              type: 'upsert_set',
              base_revision: 1,
              payload: {
                id: randomUUID(),
                session_id: sessionId,
                session_exercise_id: exId,
                set_index: sIdx + 1,
                set_type: item.set_type ?? 'working',
                planned_reps_min: item.target_reps_min ?? null,
                planned_reps_max: item.target_reps_max ?? null,
                planned_weight_value: item.target_weight_value ?? null,
                planned_weight_unit: item.target_weight_unit ?? unit,
                planned_duration_s: item.target_duration_s ?? null,
                actual_reps:
                  item.target_reps_max ?? item.target_reps_min ?? (tracking === 'time' ? null : 8),
                actual_weight_value:
                  item.target_weight_value ?? (tracking === 'weight_reps' ? 20 : null),
                actual_weight_unit: item.target_weight_unit ?? unit,
                actual_duration_s: item.target_duration_s ?? (tracking === 'time' ? 45 : null),
                state: 'not_recorded',
                is_pr: false,
              },
            });
          }
        });
      }
    }

    ops.unshift({
      op_id: randomUUID(),
      type: 'upsert_session',
      base_revision: 1,
      payload: {
        id: sessionId,
        workspace_id: workspaceId,
        assignment_id: assignmentId,
        program_version_id: versionId,
        program_day_id: dayId,
        title,
        planned_snapshot: plannedSnapshot,
        status: 'in_progress',
        started_at: nowIso,
        finished_at: null,
        duration_seconds: null,
        notes: '',
      },
    });

    await client.syncPush(ops);
  });

export const logWebSetAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const user = await getUser();
    const workspaceId = ws(formData);
    const sessionId = field(formData, 'sessionId');
    const sessionExerciseId = field(formData, 'sessionExerciseId');
    const exerciseId = field(formData, 'exerciseId');
    const setId = field(formData, 'setId');
    const setIndex = Number(field(formData, 'setIndex') || '1');
    const setType = (field(formData, 'setType') || 'working') as SetType;
    const trackingType = (field(formData, 'trackingType') || 'weight_reps') as
      'weight_reps' | 'reps' | 'time';
    const unit = (field(formData, 'weightUnit') || 'kg') as WeightUnit;
    const weightRaw = field(formData, 'weight');
    const repsRaw = field(formData, 'reps');
    const secondsRaw = field(formData, 'seconds');

    const actualWeight = weightRaw ? Number(weightRaw) : null;
    const actualReps = repsRaw ? Number(repsRaw) : null;
    const actualDuration = secondsRaw ? Number(secondsRaw) : null;

    const historySessions = await client.sessions(workspaceId, user!.id);
    const pastSets: SetRecord[] = [];
    for (const s of historySessions) {
      for (const ex of s.exercises ?? []) {
        if (ex.exercise_id === exerciseId) {
          for (const st of ex.sets) {
            if (st.id !== setId) pastSets.push(st);
          }
        }
      }
    }

    const candidate: Pick<
      SetRecord,
      'state' | 'set_type' | 'actual_reps' | 'actual_weight_value' | 'actual_weight_unit'
    > = {
      state: 'completed',
      set_type: setType,
      actual_reps: actualReps,
      actual_weight_value: actualWeight,
      actual_weight_unit: unit,
    };
    const pr = detectSetPr(candidate, pastSets, trackingType);

    await client.syncPush([
      {
        op_id: randomUUID(),
        type: 'upsert_set',
        base_revision: 1,
        payload: {
          id: setId,
          session_id: sessionId,
          session_exercise_id: sessionExerciseId,
          set_index: setIndex,
          set_type: setType,
          actual_reps: actualReps,
          actual_weight_value: actualWeight,
          actual_weight_unit: unit,
          actual_duration_s: actualDuration,
          state: 'completed',
          is_pr: pr.isPr,
          completed_at: new Date().toISOString(),
        },
      },
    ]);
  });

export const addWebExerciseAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const user = await getUser();
    const sessionId = field(formData, 'sessionId');
    const exerciseId = field(formData, 'exerciseId');
    const position = Number(field(formData, 'position') || '1');
    const profile = await client.profile(user!.id);
    const unit: WeightUnit = profile.unit_system === 'imperial' ? 'lb' : 'kg';
    const exercises = await client.exercises();
    const ex = exercises.find((e) => e.id === exerciseId);
    const tracking = ex?.tracking_type ?? 'weight_reps';
    const sessionExId = randomUUID();

    await client.syncPush([
      {
        op_id: randomUUID(),
        type: 'upsert_exercise',
        payload: {
          id: sessionExId,
          session_id: sessionId,
          exercise_id: exerciseId,
          position,
          superset_group: null,
          tracking_type: tracking,
          rest_seconds: ex?.default_rest_seconds ?? 90,
          skipped: false,
          skip_reason: null,
          notes: '',
        },
      },
      {
        op_id: randomUUID(),
        type: 'upsert_set',
        base_revision: 1,
        payload: {
          id: randomUUID(),
          session_id: sessionId,
          session_exercise_id: sessionExId,
          set_index: 1,
          set_type: 'working',
          actual_reps: tracking === 'time' ? null : 8,
          actual_weight_value: tracking === 'weight_reps' ? 20 : null,
          actual_weight_unit: unit,
          actual_duration_s: tracking === 'time' ? 45 : null,
          state: 'not_recorded',
          is_pr: false,
        },
      },
    ]);
  });

export const addWebSetAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const sessionId = field(formData, 'sessionId');
    const sessionExerciseId = field(formData, 'sessionExerciseId');
    const setIndex = Number(field(formData, 'setIndex') || '1');
    const tracking = field(formData, 'trackingType') || 'weight_reps';
    const unit = (field(formData, 'weightUnit') || 'kg') as WeightUnit;

    await client.syncPush([
      {
        op_id: randomUUID(),
        type: 'upsert_set',
        base_revision: 1,
        payload: {
          id: randomUUID(),
          session_id: sessionId,
          session_exercise_id: sessionExerciseId,
          set_index: setIndex,
          set_type: 'working',
          actual_reps: tracking === 'time' ? null : 8,
          actual_weight_value: tracking === 'weight_reps' ? 20 : null,
          actual_weight_unit: unit,
          actual_duration_s: tracking === 'time' ? 45 : null,
          state: 'not_recorded',
          is_pr: false,
        },
      },
    ]);
  });

export const finishWebSessionAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const sessionId = field(formData, 'sessionId');
    const current = await client.sessionDetail(sessionId);
    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - new Date(current.started_at).getTime()) / 1000),
    );
    await client.syncPush([
      {
        op_id: randomUUID(),
        type: 'upsert_session',
        base_revision: current.revision,
        payload: {
          id: current.id,
          workspace_id: current.workspace_id,
          assignment_id: current.assignment_id,
          program_version_id: current.program_version_id,
          program_day_id: current.program_day_id,
          title: current.title,
          planned_snapshot: current.planned_snapshot,
          status: 'completed',
          started_at: current.started_at,
          finished_at: finishedAt,
          duration_seconds: durationSeconds,
          notes: current.notes,
        },
      },
    ]);
  });

export const abandonWebSessionAction = async (_: FormState, formData: FormData) =>
  mutate(formData, async () => {
    const client = await api();
    const sessionId = field(formData, 'sessionId');
    const current = await client.sessionDetail(sessionId);
    await client.syncPush([
      {
        op_id: randomUUID(),
        type: 'upsert_session',
        base_revision: current.revision,
        payload: {
          id: current.id,
          workspace_id: current.workspace_id,
          assignment_id: current.assignment_id,
          program_version_id: current.program_version_id,
          program_day_id: current.program_day_id,
          title: current.title,
          planned_snapshot: current.planned_snapshot,
          status: 'abandoned',
          started_at: current.started_at,
          finished_at: new Date().toISOString(),
          duration_seconds: null,
          notes: current.notes,
        },
      },
    ]);
  });

export async function addSessionCommentAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(commentSchema, { body: field(formData, 'body') });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  return mutate(formData, async () => {
    await (await api()).addSessionComment(field(formData, 'sessionId'), parsed.data.body);
  });
}
