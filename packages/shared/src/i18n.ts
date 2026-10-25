import i18next from 'i18next';

import en from './locales/en.json';

// One synchronous i18next instance shared by both apps. English only for now (D-25);
// add ml.json and a language switch when Malayalam is needed.
export const i18n = i18next.createInstance({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
void i18n.init();

export const t = i18n.t.bind(i18n);

// Translate an error key from AppError or a validation message.
export const tError = (key: string) =>
  key.startsWith('validation.')
    ? t(key)
    : t(`errors.${key}`, { defaultValue: t('errors.generic') });
