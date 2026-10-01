import clsx, { type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

export function slugify(v: string) {
  return v
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', ...opts }).format(new Date(d));
}

export function formatDateTime(d: string | Date | null | undefined) {
  return formatDate(d, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function titleCase(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pick<T extends object, K extends keyof T>(o: T, keys: K[]): Pick<T, K> {
  const r = {} as Pick<T, K>;
  keys.forEach((k) => { if (k in o) r[k] = o[k]; });
  return r;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function safeRedirectPath(p: string | null | undefined, fallback = '/') {
  if (!p || !p.startsWith('/') || p.startsWith('//')) return fallback;
  return p;
}

export const COUNTRIES: [string, string][] = [
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'],
  ['IE', 'Ireland'], ['FR', 'France'], ['DE', 'Germany'], ['IT', 'Italy'], ['ES', 'Spain'], ['NL', 'Netherlands'],
  ['BE', 'Belgium'], ['PT', 'Portugal'], ['SE', 'Sweden'], ['DK', 'Denmark'], ['NO', 'Norway'], ['CH', 'Switzerland'],
  ['AT', 'Austria'], ['PL', 'Poland'], ['FI', 'Finland'], ['ZA', 'South Africa'], ['KE', 'Kenya'], ['CI', "Côte d'Ivoire"],
  ['SN', 'Senegal'], ['RW', 'Rwanda'], ['UG', 'Uganda'], ['TZ', 'Tanzania'], ['CM', 'Cameroon'], ['BJ', 'Benin'], ['TG', 'Togo'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['QA', 'Qatar'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
  ['JM', 'Jamaica'], ['TT', 'Trinidad and Tobago'], ['BR', 'Brazil'], ['IN', 'India'], ['CN', 'China'], ['JP', 'Japan'], ['SG', 'Singapore'],
];
export const countryName = (code?: string | null) => COUNTRIES.find(([c]) => c === code)?.[1] ?? code ?? '';

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];
