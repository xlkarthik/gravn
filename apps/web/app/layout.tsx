import { cssVariables, t } from '@gravn/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
  description: t('app.tagline'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
        <style>{`${cssVariables()}:root{--font-sans:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;--font-serif:'Instrument Serif',Georgia,serif;--font-mono:'JetBrains Mono',monospace;}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
