// Design tokens for Gravn: Warm Luxury Athletic palette — deep warm obsidian & espresso
// surfaces (#0F0E0C / #171513), warm ivory text (#F4F0EA), and brushed champagne (#D4AF7A).

export const colors = {
  bg: '#0F0E0C',
  surface: '#171513',
  surfaceRaised: '#211E1B',
  border: '#292521',
  borderStrong: '#463F38',
  text: '#F4F0EA',
  textMuted: '#9E9589',
  accent: '#D4AF7A',
  onAccent: '#12100E',
  danger: '#D4726A',
  success: '#8FB583',
  warning: '#D9A760',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

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
