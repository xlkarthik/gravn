import {
  displayName,
  type ProgramDay,
  programDaySchema,
  type ProgramItem,
  programItemSchema,
  programSchema,
  type ProgramSummary,
  SPLIT_TEMPLATES,
  type SplitTemplate,
  t,
} from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

import { usePeople } from './people';
import {
  Badge,
  Body,
  Button,
  EmptyState,
  ListItem,
  Message,
  QueryView,
  Screen,
  Section,
  TextField,
} from './ui';

export function ProgramsScreen() {
  const ws = useSession().workspace!;
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const programs = useQuery({
    queryKey: ['ws', ws.id, 'programs'],
    queryFn: () => api.programs(ws.id),
  });
  const form = useForm(programSchema, { name: '', description: '' });
  const create = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.createProgram(ws.id, data.name, data.description),
    onSuccess: (res) => {
      form.reset();
      setActiveVersionId(res.version_id);
      void queryClient.invalidateQueries({ queryKey: ['ws', ws.id, 'programs'] });
    },
  });
  const applyTemplate = useMutation({
    mutationFn: async (tpl: SplitTemplate) => {
      const catalog = await api.exercises();
      const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
      const created = await api.createProgram(ws.id, tpl.name, tpl.description);
      await api.deleteProgramDay(created.day_id);

      for (let dIdx = 0; dIdx < tpl.days.length; dIdx += 1) {
        const daySpec = tpl.days[dIdx]!;
        const day = await api.addProgramDay(created.version_id, 1, dIdx + 1, daySpec.title);
        for (let iIdx = 0; iIdx < daySpec.items.length; iIdx += 1) {
          const itemSpec = daySpec.items[iIdx]!;
          const ex = byName.get(itemSpec.exerciseName.toLowerCase());
          if (!ex) continue;
          await api.addProgramItem({
            programDayId: day.id,
            exerciseId: ex.id,
            position: iIdx + 1,
            setsCount: itemSpec.setsCount,
            targetRepsMin: itemSpec.repsMin,
            targetRepsMax: itemSpec.repsMax,
            targetDurationS: itemSpec.durationSeconds,
            supersetGroup: itemSpec.supersetGroup,
            restSeconds: ex.default_rest_seconds ?? 90,
          });
        }
      }
      await api.publishProgram(created.version_id);
      if (ws.type === 'personal') {
        await api.assignProgram(ws.id, ws.member_id, created.version_id);
      }
      return created.version_id;
    },
    onSuccess: (vid) => {
      setActiveVersionId(vid);
      void queryClient.invalidateQueries({ queryKey: ['ws', ws.id, 'programs'] });
    },
  });

  if (activeVersionId) {
    return (
      <ProgramVersionEditor
        workspaceId={ws.id}
        versionId={activeVersionId}
        onBack={() => setActiveVersionId(null)}
        onOpenVersion={(vid) => setActiveVersionId(vid)}
      />
    );
  }

  return (
    <Screen
      title={t('programs.title')}
      onRefresh={() => void programs.refetch()}
      refreshing={programs.isRefetching}
    >
      <Section title="Ready-made workout splits">
        {SPLIT_TEMPLATES.map((tpl) => (
          <ListItem
            key={tpl.id}
            title={tpl.name}
            subtitle={`${tpl.daysPerWeek} days/wk · ${tpl.days.map((d) => d.title).join(' / ')}`}
            badge={tpl.tag}
            right={
              <Button
                label="Use split"
                variant="secondary"
                loading={applyTemplate.isPending}
                onPress={() => applyTemplate.mutate(tpl)}
              />
            }
          />
        ))}
        <Message tone="error" text={errorText(applyTemplate.error)} />
      </Section>

      <Section title={t('programs.new_title')}>
        <TextField label={t('programs.name')} {...form.field('name')} />
        <TextField label={t('programs.description')} {...form.field('description')} />
        <Button
          label={t('programs.create')}
          loading={create.isPending}
          onPress={() => {
            const data = form.validate();
            if (data) create.mutate(data);
          }}
        />
        <Message tone="error" text={errorText(create.error)} />
      </Section>

      <QueryView query={programs}>
        {(list) => {
          if (list.length === 0) {
            return <EmptyState title={t('programs.empty_title')} body={t('programs.empty_body')} />;
          }
          return (
            <Section title={t('programs.title')}>
              {list.map((p) => {
                const latest = [...(p.versions ?? [])].sort(
                  (a, b) => b.version_number - a.version_number,
                )[0];
                if (!latest) return null;
                return (
                  <ProgramListRow
                    key={p.id}
                    program={p}
                    latestVersionId={latest.id}
                    versionNumber={latest.version_number}
                    status={latest.status}
                    daysCount={latest.days?.length ?? 0}
                    onOpen={() => setActiveVersionId(latest.id)}
                    onSelectVersion={setActiveVersionId}
                  />
                );
              })}
            </Section>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function ProgramListRow(props: {
  program: ProgramSummary;
  latestVersionId: string;
  versionNumber: number;
  status: 'draft' | 'published';
  daysCount: number;
  onOpen: () => void;
  onSelectVersion: (id: string) => void;
}) {
  const duplicate = useMutation({
    mutationFn: () => api.duplicateProgram(props.program.id, `${props.program.name} (Copy)`),
    onSuccess: (res) => props.onSelectVersion(res.version_id),
  });
  const badge = t(props.status === 'published' ? 'programs.published' : 'programs.draft', {
    version: props.versionNumber,
  });
  return (
    <ListItem
      title={props.program.name}
      subtitle={`${props.daysCount} day(s) · ${props.program.description || ''}`}
      badge={badge}
      onPress={props.onOpen}
      right={
        <Button
          label={t('programs.duplicate')}
          variant="secondary"
          loading={duplicate.isPending}
          onPress={() => duplicate.mutate()}
        />
      }
    />
  );
}

function ProgramVersionEditor(props: {
  workspaceId: string;
  versionId: string;
  onBack: () => void;
  onOpenVersion: (id: string) => void;
}) {
  const ws = useSession().workspace!;
  const versionQuery = useQuery({
    queryKey: ['ws', props.workspaceId, 'program_version', props.versionId],
    queryFn: () => api.programVersion(props.versionId),
  });
  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: () => api.exercises() });
  const peopleQuery = usePeople(ws);

  const publish = useMutation({
    mutationFn: () => api.publishProgram(props.versionId),
  });
  const makeDraft = useMutation({
    mutationFn: (programId: string) => api.createProgramDraft(programId),
    onSuccess: (newVerId) => props.onOpenVersion(newVerId),
  });
  const assign = useMutation({
    mutationFn: (clientMemberId: string) =>
      api.assignProgram(props.workspaceId, clientMemberId, props.versionId),
  });

  const dayForm = useForm(programDaySchema, { title: 'Day 2', weekIndex: '1', dayIndex: '2' });
  const addDay = useMutation({
    mutationFn: (d: { title: string; weekIndex: number; dayIndex: number }) =>
      api.addProgramDay(props.versionId, d.weekIndex, d.dayIndex, d.title),
    onSuccess: () => dayForm.reset(),
  });

  return (
    <Screen onRefresh={() => void versionQuery.refetch()} refreshing={versionQuery.isRefetching}>
      <Button label={t('common.back')} variant="secondary" onPress={props.onBack} />
      <QueryView query={versionQuery}>
        {(ver) => {
          const isDraft = ver.status === 'draft';
          const sortedDays = [...(ver.days ?? [])].sort(
            (a, b) => a.week_index - b.week_index || a.day_index - b.day_index,
          );
          return (
            <>
              <Section title={ver.program.name}>
                <Badge
                  label={t(isDraft ? 'programs.draft' : 'programs.published', {
                    version: ver.version_number,
                  })}
                />
                {!!ver.program.description && <Body muted>{ver.program.description}</Body>}
                {isDraft ? (
                  <Button
                    label={t('programs.publish')}
                    loading={publish.isPending}
                    onPress={() => publish.mutate()}
                  />
                ) : (
                  <Button
                    label={t('programs.edit_draft')}
                    variant="secondary"
                    loading={makeDraft.isPending}
                    onPress={() => makeDraft.mutate(ver.program_id)}
                  />
                )}
                <Message tone="error" text={errorText(publish.error ?? makeDraft.error)} />
              </Section>

              {!isDraft && (
                <Section title={t('programs.assign_title')}>
                  {ws.type === 'personal' ? (
                    <Button
                      label={t('programs.assign_cta')}
                      loading={assign.isPending}
                      onPress={() => assign.mutate(ws.member_id)}
                    />
                  ) : (
                    <QueryView query={peopleQuery}>
                      {(p) =>
                        p.members.length === 0 ? (
                          <Body muted>{t('people.no_clients_body')}</Body>
                        ) : (
                          p.members.map((m) => (
                            <ListItem
                              key={m.id}
                              title={displayName(m)}
                              right={
                                <Button
                                  label={t('programs.assign_cta')}
                                  variant="secondary"
                                  loading={assign.isPending}
                                  onPress={() => assign.mutate(m.id)}
                                />
                              }
                            />
                          ))
                        )
                      }
                    </QueryView>
                  )}
                  <Message tone="error" text={errorText(assign.error)} />
                  <Message tone="notice" text={assign.isSuccess ? t('common.saved') : null} />
                </Section>
              )}

              {sortedDays.map((day) => (
                <DayEditor
                  key={day.id}
                  day={day}
                  isDraft={isDraft}
                  exercises={exercisesQuery.data ?? []}
                />
              ))}

              {isDraft && (
                <Section title={t('programs.add_day')}>
                  <TextField label={t('programs.day_title')} {...dayForm.field('title')} />
                  <TextField
                    label={t('programs.day_index')}
                    keyboardType="number-pad"
                    {...dayForm.field('dayIndex')}
                  />
                  <Button
                    label={t('programs.add_day')}
                    variant="secondary"
                    loading={addDay.isPending}
                    onPress={() => {
                      const data = dayForm.validate();
                      if (data) addDay.mutate(data);
                    }}
                  />
                  <Message tone="error" text={errorText(addDay.error)} />
                </Section>
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function DayEditor(props: {
  day: ProgramDay;
  isDraft: boolean;
  exercises: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const items = [...(props.day.items ?? [])].sort((a, b) => a.position - b.position);
  const form = useForm(programItemSchema, {
    exerciseId: props.exercises[0]?.id ?? '',
    setsCount: '3',
    targetRepsMin: '8',
    targetRepsMax: '10',
    targetWeightValue: '',
    targetDurationS: '',
    restSeconds: '90',
    supersetGroup: '',
    notes: '',
  });

  const addItem = useMutation({
    mutationFn: (data: {
      exerciseId: string;
      setsCount: number;
      targetRepsMin?: number;
      targetRepsMax?: number;
      targetWeightValue?: number;
      targetDurationS?: number;
      restSeconds: number;
      supersetGroup?: string;
      notes: string;
    }) =>
      api.addProgramItem({
        programDayId: props.day.id,
        exerciseId: data.exerciseId,
        position: items.length,
        setsCount: data.setsCount,
        targetRepsMin: data.targetRepsMin,
        targetRepsMax: data.targetRepsMax,
        targetWeightValue: data.targetWeightValue,
        targetWeightUnit: data.targetWeightValue !== undefined ? 'kg' : null,
        targetDurationS: data.targetDurationS,
        restSeconds: data.restSeconds,
        supersetGroup: data.supersetGroup,
        notes: data.notes,
      }),
    onSuccess: () => {
      form.reset();
      setAdding(false);
    },
  });

  const removeItem = useMutation({ mutationFn: api.deleteProgramItem });
  const moveItem = useMutation({
    mutationFn: async ({ item, delta }: { item: ProgramItem; delta: -1 | 1 }) => {
      const idx = items.findIndex((i) => i.id === item.id);
      const neighbor = items[idx + delta];
      if (!neighbor) return;
      await api.updateProgramItem(item.id, { position: neighbor.position });
      await api.updateProgramItem(neighbor.id, { position: item.position });
    },
  });

  return (
    <Section title={`W${props.day.week_index}D${props.day.day_index} · ${props.day.title}`}>
      {items.map((item, idx) => {
        const repsLabel = item.target_reps_min
          ? `${item.target_reps_min}${item.target_reps_max && item.target_reps_max !== item.target_reps_min ? `–${item.target_reps_max}` : ''} reps`
          : item.target_duration_s
            ? `${item.target_duration_s}s`
            : '';
        const weightLabel =
          item.target_weight_value !== null && item.target_weight_value !== undefined
            ? ` @ ${item.target_weight_value} ${item.target_weight_unit ?? 'kg'}`
            : '';
        return (
          <ListItem
            key={item.id}
            title={item.exercise?.name ?? 'Exercise'}
            subtitle={`${item.sets_count} × ${repsLabel}${weightLabel} · Rest ${item.rest_seconds}s`}
            badge={item.superset_group ? `SS ${item.superset_group}` : undefined}
            right={
              props.isDraft ? (
                <>
                  {idx > 0 && (
                    <Button
                      label={t('programs.move_up')}
                      variant="secondary"
                      onPress={() => moveItem.mutate({ item, delta: -1 })}
                    />
                  )}
                  {idx < items.length - 1 && (
                    <Button
                      label={t('programs.move_down')}
                      variant="secondary"
                      onPress={() => moveItem.mutate({ item, delta: 1 })}
                    />
                  )}
                  <Button
                    label={t('common.remove')}
                    variant="danger"
                    onPress={() => removeItem.mutate(item.id)}
                  />
                </>
              ) : undefined
            }
          />
        );
      })}

      {props.isDraft &&
        (adding ? (
          <>
            {props.exercises.slice(0, 12).map((ex) => (
              <ListItem
                key={ex.id}
                title={ex.name}
                selected={form.field('exerciseId').value === ex.id}
                onPress={() => form.field('exerciseId').onChangeText(ex.id)}
              />
            ))}
            <TextField
              label={t('programs.sets_count')}
              keyboardType="number-pad"
              {...form.field('setsCount')}
            />
            <TextField
              label={t('programs.reps_min')}
              keyboardType="number-pad"
              {...form.field('targetRepsMin')}
            />
            <TextField
              label={t('programs.reps_max')}
              keyboardType="number-pad"
              {...form.field('targetRepsMax')}
            />
            <TextField
              label={t('programs.target_weight')}
              keyboardType="decimal-pad"
              {...form.field('targetWeightValue')}
            />
            <TextField
              label={t('programs.rest_seconds')}
              keyboardType="number-pad"
              {...form.field('restSeconds')}
            />
            <TextField label={t('programs.superset_group')} {...form.field('supersetGroup')} />
            <TextField label={t('programs.notes')} {...form.field('notes')} />
            <Button
              label={t('programs.add_item')}
              loading={addItem.isPending}
              onPress={() => {
                const data = form.validate();
                if (data) addItem.mutate(data);
              }}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setAdding(false)}
            />
            <Message tone="error" text={errorText(addItem.error)} />
          </>
        ) : (
          <Button
            label={t('programs.add_item')}
            variant="secondary"
            onPress={() => setAdding(true)}
          />
        ))}
    </Section>
  );
}
