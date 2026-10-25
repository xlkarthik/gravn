import { t } from '@gravn/shared';

import { Form } from '@/components/form';
import { Section } from '@/components/ui';
import { requireOwnedWorkspace } from '@/lib/supabase';

import { renameWorkspace, toggleOwnerTrainer } from '../../../actions';

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws } = await requireOwnedWorkspace(id);
  const isTrainer = ws.roles.includes('trainer');

  return (
    <>
      <h1>{t('account.gym_settings')}</h1>
      <Section title={t('account.workspace_name')}>
        <div className="panel">
          <Form
            inline
            action={renameWorkspace}
            submit={t('common.save')}
            hidden={{ workspaceId: id }}
            fields={[{ name: 'name', label: t('account.workspace_name'), defaultValue: ws.name }]}
          />
        </div>
      </Section>
      {ws.type === 'gym' && (
        <Section title={t('account.owner_trainer')}>
          <div className="panel">
            <Form
              inline
              action={toggleOwnerTrainer}
              variant="secondary"
              submit={t(
                isTrainer ? 'account.owner_trainer_disable' : 'account.owner_trainer_enable',
              )}
              hidden={{ workspaceId: id, enabled: String(!isTrainer) }}
            />
          </div>
        </Section>
      )}
    </>
  );
}
