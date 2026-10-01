import type { ThemeSettings } from '@/lib/types';

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$|^(rgb|hsl|oklch)a?\([0-9.,%\s/-]+\)$/i;
const DEFAULT_FONTS = ['Cormorant Garamond', 'Jost'];
const RADIUS: Record<string, string> = { none: '0px', sm: '2px', md: '6px', lg: '12px' };

/** Injects the admin-configured theme as CSS variables (and loads non-default Google fonts). */
export function ThemeStyle({ theme }: { theme: ThemeSettings }) {
  const vars = Object.entries(theme.colors)
    .filter(([, v]) => typeof v === 'string' && SAFE_COLOR.test(v))
    .map(([k, v]) => `--hg-${k.replace(/_/g, '-')}:${v};`).join('');
  const clean = (f: string) => f.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 60);
  const display = clean(theme.fonts.display || '');
  const body = clean(theme.fonts.body || '');
  const extraFonts = [display, body].filter((f) => f && !DEFAULT_FONTS.includes(f));
  const fontVars = [
    display && !DEFAULT_FONTS.includes(display) ? `--hg-font-display:"${display}",Georgia,serif;` : '',
    body && !DEFAULT_FONTS.includes(body) ? `--hg-font-body:"${body}",system-ui,sans-serif;` : '',
  ].join('');
  const css = `:root{${vars}${fontVars}--hg-radius:${RADIUS[theme.radius] ?? '0px'};}`;
  return (
    <>
      {extraFonts.length > 0 && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${extraFonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600`).join('&')}&display=swap`} />
      )}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
