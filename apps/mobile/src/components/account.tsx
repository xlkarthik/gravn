import {
  displayName,
  formatDate,
  isOwner,
  profileSchema,
  roleKey,
  type Shell,
  shellsFor,
  t,
  workspaceSchema,
  type WorkspaceAccess,
} from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useEffect, useState } from 'react';

import { discardOutbox, flushOutbox, getOutboxStatus, subscribeSyncState } from '@/lib/offline';
import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api, supabase } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

import { usePeople } from './people';
import {
  Body,
  Button,
  Choice,
  ListItem,
  Message,
  QueryView,
  Screen,
  Section,
  TextField,
} from './ui';

// Profile tab (members, trainers) and Settings tab (owners): account, workspace switcher,
// membership details, workspace settings, privacy and sign-out.
export function AccountScreen() {
  const { access, workspace, shell, selectWorkspace, selectShell, session } = useSession();
  const ws = workspace!;
  const shells = shellsFor(ws);
  const userId = session!.user.id;
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: () => api.profile(userId) });

  return (
    <Screen title={t('account.title')}>
      <Body muted>{session!.user.email}</Body>
      <QueryView query={profile}>
        {(p) => (
          <ProfileForm userId={userId} displayName={p.display_name} unitSystem={p.unit_system} />
        )}
      </QueryView>

      <Section title={t('account.workspaces')}>
        <Body muted>{t('account.switch_hint')}</Body>
        {access!.workspaces.map((w) => (
          <ListItem
            key={w.id}
            title={w.type === 'personal' ? t('roles.personal') : w.name}
            badge={t(roleKey(w))}
            selected={w.id === ws.id}
            onPress={() => selectWorkspace(w.id)}
          />
        ))}
        {shells.length > 1 && shell && (
          <Choice
            label={t('account.view_as')}
            value={shell}
            onChange={(next) => selectShell(next as Shell)}
            options={shells.map((s) => ({ value: s, label: t(`roles.${s}`) }))}
          />
        )}
      </Section>

      {ws.type !== 'personal' &&
        (isOwner(ws) ? <WorkspaceSettings ws={ws} /> : <Membership ws={ws} />)}

      <PrivacyAndSupportSection userId={userId} workspaceId={ws.id} />

      <SignOutSection userId={userId} />
    </Screen>
  );
}

function PrivacyAndSupportSection({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}) {
  const [reportText, setReportText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const reportMutation = useMutation({
    mutationFn: () =>
      api.submitProblemReport({
        userId,
        workspaceId,
        platform: 'mobile',
        screen: 'AccountScreen',
        description: reportText.trim(),
      }),
    onSuccess: () => setReportText(''),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await discardOutbox(userId);
      await api.requestAccountDeletion(deleteReason.trim() || undefined);
      await supabase.auth.signOut();
    },
  });

  return (
    <>
      <Section title="Report a Problem">
        <Body muted>
          Found a bug or have pilot feedback? Send a diagnostic report directly to the team.
        </Body>
        <TextField label="Description" value={reportText} onChangeText={setReportText} />
        <Button
          label="Send Report"
          variant="secondary"
          loading={reportMutation.isPending}
          onPress={() => {
            if (reportText.trim().length >= 5) {
              reportMutation.mutate();
            }
          }}
        />
        <Message tone="error" text={errorText(reportMutation.error)} />
        <Message
          tone="notice"
          text={reportMutation.isSuccess ? 'Problem report submitted. Thank you!' : null}
        />
      </Section>

      <Section title={t('account.privacy')}>
        <Body muted>{t('account.privacy_body')}</Body>
        {!confirmDelete ? (
          <Button
            label="Delete My Account & Data"
            variant="danger"
            onPress={() => setConfirmDelete(true)}
          />
        ) : (
          <>
            <Message
              tone="error"
              text="Permanent action: deleting your account removes your workouts, measurements, streaks, and personal workspace."
            />
            <TextField
              label="Reason (Optional)"
              value={deleteReason}
              onChangeText={setDeleteReason}
            />
            <Button
              label="Confirm Permanent Deletion"
              variant="danger"
              loading={deleteMutation.isPending}
              onPress={() => deleteMutation.mutate()}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setConfirmDelete(false)}
            />
            <Message tone="error" text={errorText(deleteMutation.error)} />
          </>
        )}
      </Section>
    </>
  );
}

function SignOutSection({ userId }: { userId: string }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => {
      void getOutboxStatus(userId).then((s) => setPendingCount(s.pendingCount));
    };
    refresh();
    return subscribeSyncState(refresh);
  }, [userId]);

  if (!confirming || pendingCount === 0) {
    return (
      <Button
        label={t('common.sign_out')}
        variant="secondary"
        onPress={async () => {
          const s = await getOutboxStatus(userId);
          if (s.pendingCount > 0) {
            setPendingCount(s.pendingCount);
            setConfirming(true);
          } else {
            await supabase.auth.signOut();
          }
        }}
      />
    );
  }

  return (
    <Section title={t('common.sign_out')}>
      <Message tone="error" text={t('workout.unsynced_sign_out', { count: pendingCount })} />
      <Button
        label={t('workout.sync_retry')}
        loading={syncing}
        onPress={async () => {
          setSyncing(true);
          const ok = await flushOutbox(userId);
          setSyncing(false);
          if (ok) await supabase.auth.signOut();
        }}
      />
      <Button
        label={t('workout.discard_sign_out')}
        variant="danger"
        onPress={async () => {
          await discardOutbox(userId);
          await supabase.auth.signOut();
        }}
      />
      <Button label={t('common.cancel')} variant="secondary" onPress={() => setConfirming(false)} />
    </Section>
  );
}

function ProfileForm(props: {
  userId: string;
  displayName: string;
  unitSystem: 'metric' | 'imperial';
}) {
  const form = useForm(profileSchema, {
    displayName: props.displayName,
    unitSystem: props.unitSystem,
  });
  const save = useMutation({
    mutationFn: (data: { displayName: string; unitSystem: 'metric' | 'imperial' }) =>
      api.updateProfile(props.userId, data),
  });
  const units = form.field('unitSystem');
  return (
    <>
      <TextField
        label={t('auth.display_name')}
        autoComplete="name"
        {...form.field('displayName')}
      />
      <Choice
        label={t('account.units')}
        value={units.value}
        onChange={units.onChangeText}
        options={[
          { value: 'metric', label: t('account.metric') },
          { value: 'imperial', label: t('account.imperial') },
        ]}
      />
      <Button
        label={t('common.save')}
        loading={save.isPending}
        onPress={() => {
          const data = form.validate();
          if (data) save.mutate(data);
        }}
      />
      <Message tone="error" text={errorText(save.error)} />
      <Message tone="notice" text={save.isSuccess ? t('common.saved') : null} />
    </>
  );
}

function Membership({ ws }: { ws: WorkspaceAccess }) {
  const people = usePeople(ws);
  return (
    <Section title={t('account.membership')}>
      <ListItem title={ws.name} badge={t(roleKey(ws))} />
      <QueryView query={people}>
        {(p) => {
          const me =
            p.members.find((m) => m.id === ws.member_id) ??
            p.trainers.find((m) => m.id === ws.member_id);
          const trainers = p.trainersOf(ws.member_id).map((a) => displayName(a.trainer));
          return (
            <>
              {me && <Body muted>{t('account.joined', { date: formatDate(me.joined_at) })}</Body>}
              {ws.type === 'gym' && ws.roles.includes('member') && (
                <Body muted>
                  {trainers.length
                    ? t('people.trainer_of', { names: trainers.join(', ') })
                    : t('account.no_trainers')}
                </Body>
              )}
            </>
          );
        }}
      </QueryView>
    </Section>
  );
}

function WorkspaceSettings({ ws }: { ws: WorkspaceAccess }) {
  const form = useForm(workspaceSchema.pick({ name: true }), { name: ws.name });
  const rename = useMutation({ mutationFn: (name: string) => api.renameWorkspace(ws.id, name) });
  const isTrainer = ws.roles.includes('trainer');
  const toggleTrainer = useMutation({
    mutationFn: () => api.setOwnerTrainer(ws.id, !isTrainer),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['access'] }),
  });
  return (
    <Section title={t('account.gym_settings')}>
      <TextField label={t('account.workspace_name')} {...form.field('name')} />
      <Button
        label={t('common.save')}
        variant="secondary"
        loading={rename.isPending}
        onPress={() => {
          const data = form.validate();
          if (data) rename.mutate(data.name);
        }}
      />
      {ws.type === 'gym' && (
        <Button
          label={t(isTrainer ? 'account.owner_trainer_disable' : 'account.owner_trainer_enable')}
          variant="secondary"
          loading={toggleTrainer.isPending}
          onPress={() => toggleTrainer.mutate()}
        />
      )}
      <Message tone="error" text={errorText(rename.error ?? toggleTrainer.error)} />
      <Message tone="notice" text={rename.isSuccess ? t('common.saved') : null} />
    </Section>
  );
}
