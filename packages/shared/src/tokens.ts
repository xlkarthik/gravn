// Design tokens for Gravn: Clean Light Athletic palette (Hevy / Strava / Apple Fitness) —
// crisp off-white canvas (#F7F8FA), pure white cards (#FFFFFF), deep slate ink (#0F172A),
// and high-contrast electric cobalt blue (#2563EB).

export const colors = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#64748B',
  accent: '#2563EB',
  onAccent: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

// Minimum touch target in dp / CSS px.
export const touchTarget = 48;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// `:root { --color-bg: …; --space-md: 12px; … }` for the web app.
export function cssVariables(): string {
  const vars = [
    ...Object.entries(colors).map(([k, v]) => `--color-${kebab(k)}:${v}`),
    ...Object.entries(space).map(([k, v]) => `--space-${k}:${v}px`),
    ...Object.entries(radius).map(([k, v]) => `--radius-${k}:${v}px`),
    ...Object.entries(fontSize).map(([k, v]) => `--font-${k}:${v}px`),
    `--touch-target:${touchTarget}px`,
  ];
  return `:root{${vars.join(';')}}`;
}
