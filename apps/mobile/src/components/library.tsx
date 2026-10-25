import { type Exercise, exerciseSchema, isStaff, t, type TrackingType } from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

import {
  Badge,
  Body,
  Button,
  Choice,
  EmptyState,
  ListItem,
  Message,
  QueryView,
  Screen,
  Section,
  TextField,
} from './ui';

const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'calves',
  'core',
  'full_body',
] as const;

const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;

export function useExercises(userId: string) {
  const catalog = useQuery({ queryKey: ['exercises'], queryFn: () => api.exercises() });
  const favorites = useQuery({
    queryKey: ['exercise_favorites', userId],
    queryFn: () => api.favoriteExerciseIds(userId),
  });
  return { catalog, favorites };
}

export function ExerciseLibraryScreen() {
  const { session, workspace } = useSession();
  const userId = session!.user.id;
  const ws = workspace!;
  const { catalog, favorites } = useExercises(userId);

  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);

  const toggleFav = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      api.toggleFavoriteExercise(userId, id, next),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['exercise_favorites', userId] }),
  });

  const form = useForm(exerciseSchema, {
    name: '',
    instructions: '',
    trackingType: 'weight_reps' as const,
    primaryMuscle: 'chest' as const,
    equipmentId: 'barbell' as const,
    defaultRestSeconds: '90',
  });

  const create = useMutation({
    mutationFn: (data: {
      name: string;
      instructions: string;
      trackingType: TrackingType;
      primaryMuscle: string;
      equipmentId: string;
      defaultRestSeconds: number;
    }) =>
      api.createExercise({
        scope: isStaff(ws) ? 'workspace' : 'personal',
        workspaceId: isStaff(ws) ? ws.id : undefined,
        ownerUserId: isStaff(ws) ? undefined : userId,
        ...data,
      }),
    onSuccess: () => {
      form.reset();
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });

  return (
    <Screen
      title={t('library.title')}
      onRefresh={() => {
        void catalog.refetch();
        void favorites.refetch();
      }}
      refreshing={catalog.isRefetching}
    >
      <TextField
        label={t('library.search')}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <Choice
        label={t('library.primary_muscle')}
        value={muscle}
        onChange={setMuscle}
        options={[
          { value: 'all', label: t('library.all_muscles') },
          { value: 'quads', label: t('muscles.quads') },
          { value: 'chest', label: t('muscles.chest') },
          { value: 'back', label: t('muscles.back') },
          { value: 'shoulders', label: t('muscles.shoulders') },
        ]}
      />

      <Button
        label={favOnly ? `★ ${t('library.favorites_only')}` : t('library.favorites_only')}
        variant="secondary"
        onPress={() => setFavOnly((v) => !v)}
      />

      {creating ? (
        <Section title={t('library.create_title')}>
          <TextField label={t('library.name')} {...form.field('name')} />
          <TextField label={t('library.instructions')} {...form.field('instructions')} />
          <Choice
            label={t('library.tracking_type')}
            value={form.field('trackingType').value}
            onChange={form.field('trackingType').onChangeText}
            options={[
              { value: 'weight_reps', label: t('tracking.weight_reps') },
              { value: 'reps', label: t('tracking.reps') },
              { value: 'time', label: t('tracking.time') },
            ]}
          />
          <Choice
            label={t('library.primary_muscle')}
            value={form.field('primaryMuscle').value}
            onChange={form.field('primaryMuscle').onChangeText}
            options={MUSCLES.slice(0, 5).map((m) => ({ value: m, label: t(`muscles.${m}`) }))}
          />
          <Choice
            label={t('library.equipment')}
            value={form.field('equipmentId').value}
            onChange={form.field('equipmentId').onChangeText}
            options={EQUIPMENT.slice(0, 5).map((e) => ({ value: e, label: t(`equipment.${e}`) }))}
          />
          <Button
            label={t('common.save')}
            loading={create.isPending}
            onPress={() => {
              const data = form.validate();
              if (data) create.mutate(data);
            }}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => setCreating(false)}
          />
          <Message tone="error" text={errorText(create.error)} />
        </Section>
      ) : (
        <Button
          label={t('library.create_cta')}
          variant="secondary"
          onPress={() => setCreating(true)}
        />
      )}

      {selected && (
        <Section title={selected.name}>
          <Badge label={selected.placeholder_demo || t('library.demo_placeholder')} />
          <Body>
            {t(`muscles.${selected.primary_muscle}`)} · {t(`equipment.${selected.equipment_id}`)} ·{' '}
            {t(`tracking.${selected.tracking_type}`)}
          </Body>
          {!!selected.instructions && <Body muted>{selected.instructions}</Body>}
          <Button label={t('common.back')} variant="secondary" onPress={() => setSelected(null)} />
        </Section>
      )}

      <QueryView query={catalog}>
        {(list) => {
          const favSet = new Set(favorites.data ?? []);
          const q = search.trim().toLowerCase();
          const filtered = list.filter((ex) => {
            if (q && !ex.name.toLowerCase().includes(q)) return false;
            if (muscle !== 'all' && ex.primary_muscle !== muscle) return false;
            if (favOnly && !favSet.has(ex.id)) return false;
            return true;
          });

          if (filtered.length === 0) {
            return <EmptyState title={t('library.empty')} />;
          }

          return (
            <Section title={`${t('library.title')} (${filtered.length})`}>
              {filtered.map((ex) => {
                const isFav = favSet.has(ex.id);
                return (
                  <ListItem
                    key={ex.id}
                    title={ex.name}
                    subtitle={`${t(`muscles.${ex.primary_muscle}`)} · ${t(`equipment.${ex.equipment_id}`)}`}
                    badge={t(`tracking.${ex.tracking_type}`)}
                    selected={selected?.id === ex.id}
                    onPress={() => setSelected(ex)}
                    right={
                      <Button
                        label={isFav ? '★' : '☆'}
                        variant="secondary"
                        onPress={() => toggleFav.mutate({ id: ex.id, next: !isFav })}
                      />
                    }
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
