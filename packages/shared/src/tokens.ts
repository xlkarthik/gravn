// Design tokens for Gravn: Refined Athletic Light palette —
// warm alabaster canvas (#F3F4F6), pure white cards (#FFFFFF), deep carbon ink (#111827),
// carbon primary CTAs (#111827), and electric indigo highlights (#4F46E5).

export const colors = {
  bg: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceRaised: '#F9FAFB',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  text: '#111827',
  textMuted: '#6B7280',
  accent: '#4F46E5',
  onAccent: '#FFFFFF',
  danger: '#DC2626',
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
