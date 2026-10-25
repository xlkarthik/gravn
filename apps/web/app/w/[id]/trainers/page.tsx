import { displayName, fetchPeople, t } from '@gravn/shared';
import { notFound } from 'next/navigation';

import { Form } from '@/components/form';
import { EmptyState, Section } from '@/components/ui';
import { api, requireOwnedWorkspace } from '@/lib/supabase';

import { invite, removeMember } from '../../../actions';

export default async function TrainersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws } = await requireOwnedWorkspace(id);
  if (ws.type !== 'gym') notFound();
  const people = await fetchPeople(await api(), id);

  return (
    <>
      <h1>{t('people.trainers_title')}</h1>
      <Section title={t('people.invite_trainer')}>
        <div className="panel">
          <Form
            inline
            action={invite}
            submit={t('people.invite')}
            hidden={{ workspaceId: id, role: 'trainer' }}
            fields={[{ name: 'email', label: t('auth.email'), type: 'email' }]}
          />
        </div>
      </Section>
      <Section title={t('people.trainers_title')}>
        {people.trainers.length === 0 ? (
          <EmptyState title={t('people.no_trainers')} body={t('people.no_trainers_body')} />
        ) : (
          <ul className="rows">
            {people.trainers.map((tr) => (
              <li key={tr.id}>
                <div className="grow">
                  {displayName(tr)}
                  <small>{t('people.clients_count', { count: people.clientsOf(tr.id) })}</small>
                </div>
                <Form
                  inline
                  action={removeMember}
                  variant="danger"
                  submit={t('common.remove')}
                  confirm={t('people.remove_confirm', {
                    name: displayName(tr),
                    workspace: ws.name,
                  })}
                  hidden={{ workspaceId: id, memberId: tr.id }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
