import {
  buildMeasurementSeries,
  colors,
  computeWeeklyStreak,
  fontSize,
  type MeasurementDefinition,
  type MeasurementUnit,
  radius,
  space,
} from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText } from '@/lib/use-form';

import {
  Badge,
  Button,
  Choice,
  EmptyState,
  ListItem,
  Message,
  QueryView,
  Screen,
  Section,
  TextField,
} from '@/components/ui';

export default function ProgressScreen() {
  const { session, workspace } = useSession();
  const userId = session!.user.id;
  const ws = workspace!;

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.profile(userId),
  });
  const definitionsQuery = useQuery({
    queryKey: ['measurement-definitions'],
    queryFn: () => api.measurementDefinitions(),
  });
  const entriesQuery = useQuery({
    queryKey: ['measurement-entries', userId, ws.id],
    queryFn: () => api.measurementEntries(userId, ws.type === 'personal' ? undefined : ws.id),
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', ws.id, userId],
    queryFn: () => api.sessions(ws.id, userId),
  });
  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => api.notifications(userId),
  });

  const [selectedDefId, setSelectedDefId] = useState<string>('weight');
  const [valueInput, setValueInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [measuredOn, setMeasuredOn] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const unitSystem = profileQuery.data?.unit_system ?? 'metric';

  const activeDef: MeasurementDefinition | undefined = useMemo(() => {
    const defs = definitionsQuery.data ?? [];
    return defs.find((d) => d.id === selectedDefId) ?? defs[0];
  }, [definitionsQuery.data, selectedDefId]);

  const displayUnit: MeasurementUnit = useMemo(() => {
    if (!activeDef) return unitSystem === 'imperial' ? 'lb' : 'kg';
    return unitSystem === 'imperial' ? activeDef.imperial_unit : activeDef.metric_unit;
  }, [activeDef, unitSystem]);

  const filteredEntries = useMemo(() => {
    const entries = entriesQuery.data ?? [];
    return activeDef ? entries.filter((e) => e.definition_id === activeDef.id) : [];
  }, [activeDef, entriesQuery.data]);

  const series = useMemo(() => buildMeasurementSeries(filteredEntries), [filteredEntries]);

  const streakSummary = useMemo(() => {
    const completedTimestamps = (sessionsQuery.data ?? [])
      .filter((s) => s.status === 'completed')
      .map((s) => s.finished_at ?? s.started_at);
    return computeWeeklyStreak(completedTimestamps, 3);
  }, [sessionsQuery.data]);

  const highFiveCount = useMemo(
    () => (notificationsQuery.data ?? []).filter((n) => n.type === 'high_five').length,
    [notificationsQuery.data],
  );

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!activeDef) throw new Error('Select a metric first');
      const num = Number(valueInput);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error('Enter a valid positive measurement');
      }
      await api.recordMeasurement({
        subjectUserId: userId,
        workspaceId: ws.type === 'personal' ? null : ws.id,
        definitionId: activeDef.id,
        value: num,
        unit: displayUnit,
        measuredOn,
        note: notesInput.trim() || undefined,
      });
    },
    onSuccess: () => {
      setValueInput('');
      setNotesInput('');
      void queryClient.invalidateQueries({ queryKey: ['measurement-entries', userId, ws.id] });
    },
  });

  return (
    <Screen title="Progress & Body Tracking">
      <Section title="Weekly Adherence Streak">
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>WEEKLY STREAK</Text>
            <Text style={styles.statValue}>{streakSummary.currentWeeks}w</Text>
            <Text style={styles.statSub}>Best: {streakSummary.bestWeeks}w</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statValue}>
              {streakSummary.thisWeekCompleted}/{streakSummary.weeklyTarget}
            </Text>
            <Text style={styles.statSub}>Rest days protected</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>COACH HIGH-FIVES</Text>
            <Text style={styles.statValue}>🙌 {highFiveCount}</Text>
            <Text style={styles.statSub}>Session kudos</Text>
          </View>
        </View>
      </Section>

      <QueryView query={definitionsQuery}>
        {(defs) => (
          <>
            <Section title="Body Measurements">
              <Choice
                label="Metric"
                value={activeDef?.id ?? 'weight'}
                onChange={setSelectedDefId}
                options={defs.map((d) => ({ value: d.id, label: d.label }))}
              />

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>LATEST ({displayUnit.toUpperCase()})</Text>
                  <Text style={styles.statValue}>
                    {series.latestValue !== null ? `${series.latestValue} ${displayUnit}` : '—'}
                  </Text>
                  <Text style={styles.statSub}>
                    {filteredEntries[0]
                      ? `Logged ${filteredEntries[0].measured_on.slice(0, 10)}`
                      : 'No entries yet'}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>CHANGE</Text>
                  <Text style={styles.statValue}>
                    {series.delta !== null
                      ? `${series.delta > 0 ? '+' : ''}${series.delta} ${displayUnit}`
                      : '—'}
                  </Text>
                  <Text style={styles.statSub}>{filteredEntries.length} logged points</Text>
                </View>
              </View>

              <TextField
                label={`Value (${displayUnit})`}
                keyboardType="decimal-pad"
                value={valueInput}
                onChangeText={setValueInput}
              />
              <TextField
                label="Date (YYYY-MM-DD)"
                value={measuredOn}
                onChangeText={setMeasuredOn}
              />
              <TextField label="Notes (Optional)" value={notesInput} onChangeText={setNotesInput} />
              <Button
                label="Save Measurement"
                loading={recordMutation.isPending}
                onPress={() => recordMutation.mutate()}
              />
              <Message tone="error" text={errorText(recordMutation.error)} />
            </Section>

            <Section title={`History · ${activeDef?.label ?? 'Measurements'}`}>
              {filteredEntries.length === 0 ? (
                <EmptyState
                  title="No measurements recorded yet"
                  body="Log your first entry above to track your progress over time. Missing days remain true gaps and are never drawn as zero."
                />
              ) : (
                filteredEntries.map((entry) => (
                  <ListItem
                    key={entry.id}
                    title={`${entry.value} ${entry.unit}`}
                    subtitle={
                      entry.note
                        ? `${entry.measured_on.slice(0, 10)} · ${entry.note}`
                        : entry.measured_on.slice(0, 10)
                    }
                    right={<Badge label={entry.measured_on.slice(0, 10)} />}
                  />
                ))
              )}
            </Section>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: '700',
    marginTop: 4,
  },
  statSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
