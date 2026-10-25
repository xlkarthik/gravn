'use server';

import {
  type GymMembershipStatus,
  type MeasurementUnit,
  SPLIT_TEMPLATES,
  type SyncOpInput,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import { revalidatePath } from 'next/cache';

import { api } from '@/lib/supabase';

export async function pushWorkoutOps(ops: SyncOpInput[]): Promise<void> {
  const client = await api();
  await client.syncPush(ops);
  revalidatePath('/home');
}

export async function fetchWorkspaceSessions(
  workspaceId: string,
  userId: string,
): Promise<WorkoutSessionRecord[]> {
  const client = await api();
  return client.sessions(workspaceId, userId);
}

export async function createQuickRoutine(input: {
  workspaceId: string;
  name: string;
  exercises: {
    exerciseId: string;
    setsCount: number;
    repsMin: number;
    repsMax: number;
  }[];
}): Promise<void> {
  const client = await api();
  const created = await client.createProgram(input.workspaceId, input.name.trim(), '');
  for (let i = 0; i < input.exercises.length; i += 1) {
    const ex = input.exercises[i]!;
    await client.addProgramItem({
      programDayId: created.day_id,
      exerciseId: ex.exerciseId,
      position: i + 1,
      setsCount: ex.setsCount,
      targetRepsMin: ex.repsMin,
      targetRepsMax: ex.repsMax,
    });
  }
  revalidatePath('/home');
  revalidatePath(`/w/${input.workspaceId}/programs`);
}

export async function applySplitTemplate(input: {
  workspaceId: string;
  templateId: string;
  publish?: boolean;
}): Promise<void> {
  const tpl = SPLIT_TEMPLATES.find((t) => t.id === input.templateId);
  if (!tpl) return;
  const client = await api();
  const catalog = await client.exercises();
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));

  const created = await client.createProgram(input.workspaceId, tpl.name, tpl.description);
  await client.deleteProgramDay(created.day_id);

  for (let dIdx = 0; dIdx < tpl.days.length; dIdx += 1) {
    const daySpec = tpl.days[dIdx]!;
    const day = await client.addProgramDay(created.version_id, 1, dIdx + 1, daySpec.title);
    for (let iIdx = 0; iIdx < daySpec.items.length; iIdx += 1) {
      const itemSpec = daySpec.items[iIdx]!;
      const ex = byName.get(itemSpec.exerciseName.toLowerCase());
      if (!ex) continue;
      await client.addProgramItem({
        programDayId: day.id,
        exerciseId: ex.id,
        position: iIdx + 1,
        setsCount: itemSpec.setsCount,
        targetRepsMin: itemSpec.repsMin ?? null,
        targetRepsMax: itemSpec.repsMax ?? null,
        targetDurationS: itemSpec.durationSeconds ?? null,
        supersetGroup: itemSpec.supersetGroup ?? null,
        restSeconds: ex.default_rest_seconds ?? 90,
      });
    }
  }

  if (input.publish) {
    await client.publishProgram(created.version_id);
  }

  revalidatePath('/home');
  revalidatePath(`/w/${input.workspaceId}/programs`);
}

export async function createMultiDaySplit(input: {
  workspaceId: string;
  name: string;
  description?: string;
  days: {
    title: string;
    items: {
      exerciseId: string;
      setsCount: number;
      repsMin: number;
      repsMax: number;
      supersetGroup?: string;
    }[];
  }[];
  publish?: boolean;
}): Promise<void> {
  const client = await api();
  const created = await client.createProgram(
    input.workspaceId,
    input.name.trim(),
    input.description?.trim() ?? '',
  );
  await client.deleteProgramDay(created.day_id);

  for (let dIdx = 0; dIdx < input.days.length; dIdx += 1) {
    const daySpec = input.days[dIdx]!;
    const day = await client.addProgramDay(
      created.version_id,
      1,
      dIdx + 1,
      daySpec.title.trim() || `Day ${dIdx + 1}`,
    );
    for (let iIdx = 0; iIdx < daySpec.items.length; iIdx += 1) {
      const item = daySpec.items[iIdx]!;
      await client.addProgramItem({
        programDayId: day.id,
        exerciseId: item.exerciseId,
        position: iIdx + 1,
        setsCount: item.setsCount,
        targetRepsMin: item.repsMin,
        targetRepsMax: item.repsMax,
        supersetGroup: item.supersetGroup || null,
      });
    }
  }

  if (input.publish) {
    await client.publishProgram(created.version_id);
  }

  revalidatePath('/home');
  revalidatePath(`/w/${input.workspaceId}/programs`);
}

export async function addDayToSplitVersion(input: {
  workspaceId: string;
  versionId: string;
  dayIndex: number;
  title: string;
}): Promise<void> {
  const client = await api();
  await client.addProgramDay(input.versionId, 1, input.dayIndex, input.title.trim());
  revalidatePath('/home');
  revalidatePath(`/w/${input.workspaceId}/programs`);
}

export async function removeDayFromSplit(workspaceId: string, dayId: string): Promise<void> {
  const client = await api();
  await client.deleteProgramDay(dayId);
  revalidatePath('/home');
  revalidatePath(`/w/${workspaceId}/programs`);
}

export async function addExerciseToRoutineDay(input: {
  workspaceId?: string;
  dayId: string;
  exerciseId: string;
  position: number;
  setsCount: number;
  repsMin: number;
  repsMax: number;
  supersetGroup?: string;
}): Promise<void> {
  const client = await api();
  await client.addProgramItem({
    programDayId: input.dayId,
    exerciseId: input.exerciseId,
    position: input.position,
    setsCount: input.setsCount,
    targetRepsMin: input.repsMin,
    targetRepsMax: input.repsMax,
    supersetGroup: input.supersetGroup || null,
  });
  revalidatePath('/home');
  if (input.workspaceId) revalidatePath(`/w/${input.workspaceId}/programs`);
}

export async function removeExerciseFromRoutineDay(
  itemId: string,
  workspaceId?: string,
): Promise<void> {
  const client = await api();
  await client.deleteProgramItem(itemId);
  revalidatePath('/home');
  if (workspaceId) revalidatePath(`/w/${workspaceId}/programs`);
}

export async function publishAndAssignSplit(input: {
  workspaceId: string;
  versionId: string;
  isDraft: boolean;
  clientMemberId?: string;
}): Promise<void> {
  const client = await api();
  if (input.isDraft) {
    await client.publishProgram(input.versionId);
  }
  if (input.clientMemberId) {
    await client.assignProgram(input.workspaceId, input.clientMemberId, input.versionId);
  }
  revalidatePath(`/w/${input.workspaceId}/programs`);
  revalidatePath(`/w/${input.workspaceId}/members`);
}

export async function unassignSplit(workspaceId: string, assignmentId: string): Promise<void> {
  const client = await api();
  await client.endProgramAssignment(assignmentId);
  revalidatePath(`/w/${workspaceId}/programs`);
  revalidatePath(`/w/${workspaceId}/members`);
}

export async function createEditableSplitDraft(
  workspaceId: string,
  programId: string,
): Promise<void> {
  const client = await api();
  await client.createProgramDraft(programId);
  revalidatePath(`/w/${workspaceId}/programs`);
}

export async function postWorkoutComment(
  sessionId: string,
  body: string,
  workspaceId?: string,
): Promise<void> {
  const client = await api();
  await client.addSessionComment(sessionId, body.trim());
  revalidatePath('/home');
  if (workspaceId) {
    revalidatePath(`/w/${workspaceId}/programs`);
    revalidatePath(`/w/${workspaceId}/members`);
    revalidatePath(`/w/${workspaceId}/activity`);
  }
}

export async function toggleTrainerAssignment(input: {
  workspaceId: string;
  clientMemberId: string;
  trainerMemberId: string;
  existingAssignmentId?: string;
}): Promise<void> {
  const client = await api();
  if (input.existingAssignmentId) {
    await client.endAssignment(input.existingAssignmentId);
  } else {
    await client.assignTrainer(input.workspaceId, input.trainerMemberId, input.clientMemberId);
  }
  revalidatePath(`/w/${input.workspaceId}/members`);
}

// ─── Part 3 Server Actions: Measurements, Memberships, High-Fives & Privacy ───

export async function recordBodyMeasurementAction(input: {
  subjectUserId: string;
  workspaceId: string | null;
  definitionId: string;
  value: number;
  unit: MeasurementUnit;
  measuredOn?: string;
  note?: string;
}): Promise<void> {
  const client = await api();
  await client.recordMeasurement(input);
  revalidatePath('/home');
  if (input.workspaceId) {
    revalidatePath(`/w/${input.workspaceId}/members`);
  }
}

export async function deleteBodyMeasurementAction(
  entryId: string,
  workspaceId?: string | null,
): Promise<void> {
  const client = await api();
  await client.deleteMeasurement(entryId);
  revalidatePath('/home');
  if (workspaceId) {
    revalidatePath(`/w/${workspaceId}/members`);
  }
}

export async function upsertGymMembershipAction(input: {
  workspaceId: string;
  memberId: string;
  planLabel: string;
  startDate: string;
  endDate: string;
  status: GymMembershipStatus;
  notes?: string;
}): Promise<void> {
  const client = await api();
  await client.upsertGymMembership(input);
  revalidatePath(`/w/${input.workspaceId}`);
  revalidatePath(`/w/${input.workspaceId}/members`);
}

export async function sendCoachHighFiveAction(
  workspaceId: string,
  sessionId: string,
  comment = '',
): Promise<void> {
  const client = await api();
  await client.sendHighFive(sessionId, comment);
  revalidatePath(`/w/${workspaceId}/activity`);
  revalidatePath(`/w/${workspaceId}/members`);
  revalidatePath('/home');
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const client = await api();
  await client.markNotificationRead(notificationId);
  revalidatePath('/home');
}

export async function pauseClientStreakAction(input: {
  workspaceId: string;
  userId: string;
  pausedUntil: string | null;
  reason?: string;
}): Promise<void> {
  const client = await api();
  await client.pauseClientStreak(input);
  revalidatePath(`/w/${input.workspaceId}/members`);
  revalidatePath('/home');
}

export async function requestInAppAccountDeletionAction(reason = ''): Promise<void> {
  const client = await api();
  await client.requestAccountDeletion(reason);
  revalidatePath('/home');
  revalidatePath('/account');
}

export async function requestPublicDeletionAction(email: string, reason = ''): Promise<void> {
  const client = await api();
  await client.requestPublicDeletion(email, reason);
}

export async function submitProblemReportAction(input: {
  userId: string;
  workspaceId?: string | null;
  screen: string;
  description: string;
}): Promise<void> {
  const client = await api();
  await client.submitProblemReport(input);
}
