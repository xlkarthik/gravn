import {
  type ClientRecord,
  clientRecordSchema,
  displayName,
  fetchPeople,
  formatDate,
  inviteSchema,
  inviteUrl,
  type PendingInvitation,
  type Role,
  t,
  type WorkspaceAccess,
} from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { env } from '@/lib/env';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

import {
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

export const usePeople = (ws: WorkspaceAccess) =>
  useQuery({ queryKey: ['ws', ws.id, 'people'], queryFn: () => fetchPeople(api, ws.id) });

type Mode = 'members' | 'trainers' | 'clients';

// The owner's Members and Trainers tabs and the trainer's Clients tab. RLS decides which
// rows come back: a trainer only ever receives their own clients.
export function PeopleScreen({ mode }: { mode: Mode }) {
  const ws = useSession().workspace!;
  const query = usePeople(ws);
  const role: Role = mode === 'trainers' ? 'trainer' : 'member';
  const title = t(`people.${mode}_title`);
  const inviteLabel = {
    members: 'people.invite_member',
    trainers: 'people.invite_trainer',
    clients: 'people.invite_client',
  }[mode];

  return (
    <Screen title={title} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <InviteForm workspaceId={ws.id} role={role} label={t(inviteLabel)} />
      <QueryView query={query}>
        {(people) => {
          const list = role === 'trainer' ? people.trainers : people.members;
          const subtitle = (m: (typeof list)[number]) => {
            if (role === 'trainer')
              return t('people.clients_count', { count: people.clientsOf(m.id) });
            const plan = people.planOf(m.id);
            const planLabel = plan
              ? t('programs.assigned_plan', {
                  name: plan.program_version?.program?.name ?? '',
                  version: plan.program_version?.version_number ?? 1,
                })
              : t('programs.no_plan');
            const adherence = t('workout.adherence_week', {
              count: people.sessionsThisWeek(m.user_id),
            });
            if (ws.type !== 'gym') return `${planLabel} • ${adherence}`;
            const names = people.trainersOf(m.id).map((a) => displayName(a.trainer));
            const trainerLabel = names.length
              ? t('people.trainer_of', { names: names.join(', ') })
              : t('people.no_trainer');
            return `${trainerLabel} • ${planLabel} • ${adherence}`;
          };
          const archived = people.archived.filter((m) => m.roles.includes(role));
          return (
            <>
              <Section title={title}>
                {list.length === 0 ? (
                  <EmptyState title={t(`people.no_${mode}`)} body={t(`people.no_${mode}_body`)} />
                ) : (
                  list.map((m) => (
                    <ListItem
                      key={m.id}
                      title={displayName(m)}
                      subtitle={subtitle(m)}
                      onPress={() => router.push(`/member/${m.id}`)}
                    />
                  ))
                )}
              </Section>
              <Invitations list={people.invitations.filter((i) => i.role === role)} />
              {role === 'member' && <PendingPeople workspaceId={ws.id} records={people.records} />}
              {archived.length > 0 && (
                <Section title={t('people.removed')}>
                  {archived.map((m) => (
                    <ListItem
                      key={m.id}
                      title={displayName(m)}
                      onPress={() => router.push(`/member/${m.id}`)}
                    />
                  ))}
                </Section>
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function InviteForm({
  workspaceId,
  role,
  label,
}: {
  workspaceId: string;
  role: Role;
  label: string;
}) {
  const form = useForm(inviteSchema, { email: '', role });
  const invite = useMutation({
    mutationFn: async (email: string) => ({
      email,
      token: await api.createInvitation(workspaceId, email, role),
    }),
    onSuccess: () => form.reset(),
  });
  return (
    <Section title={label}>
      <TextField
        label={t('auth.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        {...form.field('email')}
      />
      <Button
        label={t('people.invite')}
        loading={invite.isPending}
        onPress={() => {
          const data = form.validate();
          if (data?.email) invite.mutate(data.email);
        }}
      />
      <Message tone="error" text={errorText(invite.error)} />
      {invite.data && <ShareLink email={invite.data.email} token={invite.data.token} />}
    </Section>
  );
}

// The invitation link, shown once (only its hash is stored), with the share sheet.
function ShareLink({ email, token }: { email: string | null; token: string }) {
  const url = inviteUrl(env.webUrl, token);
  return (
    <>
      <Message
        tone="notice"
        text={email ? t('people.invite_created', { email }) : t('people.invite_link_created')}
      />
      <Body selectable>{url}</Body>
      <Button
        label={t('common.share')}
        variant="secondary"
        onPress={() => void Share.share({ message: url })}
      />
    </>
  );
}

function Invitations({ list }: { list: PendingInvitation[] }) {
  const revoke = useMutation({ mutationFn: api.revokeInvitation });
  if (list.length === 0) return null;
  return (
    <Section title={t('people.pending_invitations')}>
      {list.map((inv) => (
        <ListItem
          key={inv.id}
          title={inv.email ?? t('people.open_invite_label')}
          subtitle={t('invitation.expires', { date: formatDate(inv.expires_at) })}
          right={
            <Button
              label={t('people.revoke')}
              variant="danger"
              onPress={() => revoke.mutate(inv.id)}
            />
          }
        />
      ))}
      <Message tone="error" text={errorText(revoke.error)} />
    </Section>
  );
}

// People added by name before they have an account; invited via email or an open single-use link (D-57).
function PendingPeople({ workspaceId, records }: { workspaceId: string; records: ClientRecord[] }) {
  const [adding, setAdding] = useState(false);
  const form = useForm(clientRecordSchema, { displayName: '', email: '', phone: '' });
  const add = useMutation({
    mutationFn: (data: { displayName: string; email?: string; phone?: string }) =>
      api.addClientRecord(workspaceId, data),
    onSuccess: () => {
      form.reset();
      setAdding(false);
    },
  });
  const invite = useMutation({
    mutationFn: async (r: ClientRecord) => ({
      email: r.email,
      token: await api.createInvitation(workspaceId, r.email, 'member', r.id),
    }),
  });
  const remove = useMutation({ mutationFn: api.deleteClientRecord });

  return (
    <Section title={t('people.not_invited')}>
      {records.map((r) => (
        <ListItem
          key={r.id}
          title={r.display_name}
          subtitle={[r.email, r.phone].filter(Boolean).join(' · ') || t('people.needs_email')}
          right={
            <>
              <Button
                label={t('people.invite')}
                variant="secondary"
                onPress={() => invite.mutate(r)}
              />
              <Button
                label={t('common.remove')}
                variant="danger"
                onPress={() => remove.mutate(r.id)}
              />
            </>
          }
        />
      ))}
      {invite.data && <ShareLink email={invite.data.email} token={invite.data.token} />}
      {adding ? (
        <>
          <Body muted>{t('people.add_person_body')}</Body>
          <TextField label={t('auth.display_name')} {...form.field('displayName')} />
          <TextField
            label={t('people.email_optional')}
            keyboardType="email-address"
            autoCapitalize="none"
            {...form.field('email')}
          />
          <TextField
            label={t('people.phone_optional')}
            keyboardType="phone-pad"
            {...form.field('phone')}
          />
          <Button
            label={t('people.add_person')}
            loading={add.isPending}
            onPress={() => {
              const data = form.validate();
              if (data) add.mutate(data);
            }}
          />
        </>
      ) : (
        <Button
          label={t('people.add_person')}
          variant="secondary"
          onPress={() => setAdding(true)}
        />
      )}
      <Message tone="error" text={errorText(add.error ?? invite.error ?? remove.error)} />
    </Section>
  );
}
