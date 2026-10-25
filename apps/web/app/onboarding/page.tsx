import { t } from '@gravn/shared';

import { Form } from '@/components/form';
import { Card } from '@/components/ui';

import { createWorkspace } from '../actions';

export default function OnboardingPage() {
  return (
    <Card title={t('web.create_gym_cta')}>
      <Form
        action={createWorkspace}
        submit={t('onboarding.create')}
        fields={[
          {
            name: 'type',
            label: t('onboarding.title'),
            type: 'select',
            options: [
              { value: 'gym', label: t('onboarding.create_gym') },
              { value: 'coach', label: t('onboarding.coach') },
            ],
          },
          { name: 'name', label: t('onboarding.gym_name'), autoComplete: 'organization' },
        ]}
      />
    </Card>
  );
}
