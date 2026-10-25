import type { ExpoConfig } from 'expo/config';

// Three variants install side by side (plan 1.6). APP_VARIANT is set per EAS profile.
const VARIANTS = {
  development: { name: 'Gravn Dev', suffix: '.dev', scheme: 'gravn-dev' },
  preview: { name: 'Gravn Preview', suffix: '.preview', scheme: 'gravn-preview' },
  production: { name: 'Gravn', suffix: '', scheme: 'gravn' },
};
const variant = VARIANTS[process.env.APP_VARIANT as keyof typeof VARIANTS] ?? VARIANTS.development;

// D-01: permanent once published to a store.
const APP_ID = `app.gravn.mobile${variant.suffix}`;
const BACKGROUND = '#0B0B0C'; // colors.bg in packages/shared/src/tokens.ts

export default (): ExpoConfig => ({
  name: variant.name,
  slug: 'gravn',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: variant.scheme,
  userInterfaceStyle: 'dark',
  backgroundColor: BACKGROUND,
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false, // D-23
  },
  android: {
    package: APP_ID,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: BACKGROUND,
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: BACKGROUND, image: './assets/splash-icon.png', imageWidth: 120 },
    ],
    'expo-secure-store',
    'expo-sqlite',
    'expo-localization',
  ],
  experiments: { reactCompiler: true },
});
