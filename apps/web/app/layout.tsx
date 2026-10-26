import { cssVariables, t } from '@gravn/shared';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#08090C',
};

export const metadata: Metadata = {
  title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
  description: t('app.tagline'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gravn',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <style>{`${cssVariables()}:root{--font-sans:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;--font-serif:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;--font-mono:'JetBrains Mono',monospace;}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
