// Dates and numbers go through Intl, in the user's timezone (Asia/Kolkata by default).

export interface FormatOptions {
  timeZone?: string;
  locale?: string;
}

export function formatDate(value: string | Date, opts: FormatOptions = {}): string {
  return new Intl.DateTimeFormat(opts.locale ?? 'en-IN', {
    dateStyle: 'medium',
    timeZone: opts.timeZone ?? 'Asia/Kolkata',
  }).format(new Date(value));
}

export function formatNumber(value: number, opts: FormatOptions = {}): string {
  return new Intl.NumberFormat(opts.locale ?? 'en-IN').format(value);
}
