import { parseInviteToken, t } from '@gravn/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Screen, TextField } from '@/components/ui';

// For people who received the link somewhere the app can't open it from.
export default function JoinWithLink() {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string>();

  return (
    <Screen title={t('onboarding.invitation')}>
      <TextField
        label={t('onboarding.invite_link')}
        placeholder={t('onboarding.invite_link_help')}
        autoCapitalize="none"
        autoCorrect={false}
        value={link}
        onChangeText={setLink}
        error={error}
      />
      <Button
        label={t('common.continue')}
        onPress={() => {
          const token = parseInviteToken(link);
          if (token) router.push(`/invite/${token}`);
          else setError(t('onboarding.invite_link_invalid'));
        }}
      />
    </Screen>
  );
}
