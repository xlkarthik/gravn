// Design tokens for Gravn: Obsidian Titanium & Laser Crimson (`GRAVITY / BUILDS / INTENSITY`) —
// pitch obsidian void (#08090C), machined gunmetal cards (#111318), platinum silver text (#F3F5F8),
// and laser crimson intensity accents (#FF2E1F).

export const colors = {
  bg: '#08090C',
  surface: '#111318',
  surfaceRaised: '#181B22',
  border: '#222630',
  borderStrong: '#2F3543',
  text: '#F3F5F8',
  textMuted: '#9CA3B0',
  accent: '#FF2E1F',
  onAccent: '#FFFFFF',
  danger: '#FF453A',
  success: '#10B981',
  warning: '#F59E0B',
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
