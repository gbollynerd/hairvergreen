// Generates brand-coloured placeholder artwork (SVG) used by the demo seed.
// Replace these with real HairverGreen photography from Admin → Media.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'demo');
mkdirSync(OUT, { recursive: true });

const C = { emerald: '#0F3D2E', deep: '#0A2A20', gold: '#D8C08E', antique: '#B0925C', parchment: '#EFE6D2', ivory: '#F6F2EA', espresso: '#2B1D14', brown: '#5A3E2B' };

// Seeded PRNG so output is stable
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function strandPath(kind, x0, y0, len, amp, freq, phase, r) {
  const pts = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = y0 + t * len;
    let x = x0;
    const a = amp * (0.6 + 0.4 * t);
    switch (kind) {
      case 'straight': x += Math.sin(t * 2 + phase) * 4 + t * 10; break;
      case 'body-wave': x += Math.sin(t * Math.PI * freq + phase) * a; break;
      case 'loose-wave': x += Math.sin(t * Math.PI * freq * 0.7 + phase) * a * 1.1; break;
      case 'deep-wave': x += Math.sin(t * Math.PI * freq * 1.8 + phase) * a * 0.7; break;
      case 'curly': {
        const ang = t * Math.PI * freq * 3 + phase;
        x += Math.cos(ang) * a * 0.55; pts.push([x, y + Math.sin(ang) * a * 0.35]); continue;
      }
      case 'kinky': x += (Math.sin(t * Math.PI * freq * 5 + phase) * a * 0.3) + (r() - 0.5) * 3; break;
      default: x += Math.sin(t * Math.PI * freq + phase) * a;
    }
    pts.push([x, y]);
  }
  let d = `M${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
    d += ` Q${x1.toFixed(0)} ${y1.toFixed(0)} ${((x1 + x2) / 2).toFixed(0)} ${((y1 + y2) / 2).toFixed(0)}`;
  }
  return d;
}

const MARK = (fill, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s}) translate(-20 -20)" opacity="0.9">
<path fill="${fill}" d="M34 30H58V33C54 34 53 36 53 40V160C53 164 54 166 58 167V170H34V167C38 166 39 164 39 160V40C39 36 38 34 34 33Z"/>
<path fill="${fill}" d="M142 30H166V33C162 34 161 36 161 40V160C161 164 162 166 166 167V170H142V167C146 166 147 164 147 160V40C147 36 146 34 142 33Z"/>
<path fill="${fill}" d="M160 60C168 62 172 70 171 80L171 84C172 88 176 92 177 96C176 98 173 99 172 100C173 103 172 105 171 106C173 108 172 111 170 112C170 116 168 120 164 121C162 122 161 126 160 132Z"/>
<g fill="none" stroke="${fill}" stroke-linecap="round"><path stroke-width="4" d="M149 72C132 64 116 71 104 83C94 93 80 98 68 92C62 89 62 82 68 80"/><path stroke-width="5" d="M149 90C130 84 114 95 100 105C86 115 70 116 53 108"/><path stroke-width="3.5" d="M149 106C134 104 122 115 112 127C104 137 92 141 82 135C76 131 78 124 85 124"/><path stroke-width="3" d="M149 118C140 130 137 143 145 150"/></g></g>`;

function art({ file, w, h, bg1, bg2, strand, strand2, kind, seed, count = 70, spread = 0.55, top = 0.08, len = 0.95, mark = true, markFill }) {
  const r = rng(seed);
  const cx = w / 2;
  let paths = '';
  for (let i = 0; i < count; i++) {
    const x0 = cx + (r() - 0.5) * w * spread;
    const y0 = h * top + r() * h * 0.05;
    const L = h * len * (0.75 + r() * 0.25);
    const amp = w * (0.03 + r() * 0.04);
    const freq = 3 + r() * 1.5;
    const col = r() > 0.35 ? strand : strand2;
    const sw = (0.6 + r() * 1.6).toFixed(2);
    const op = (0.25 + r() * 0.6).toFixed(2);
    paths += `<path d="${strandPath(kind, x0, y0, L, amp, freq, r() * 6.28, r)}" stroke="${col}" stroke-width="${sw}" stroke-opacity="${op}" fill="none" stroke-linecap="round"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<radialGradient id="v" cx="0.5" cy="0.35" r="0.8"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>${paths}<rect width="${w}" height="${h}" fill="url(#v)"/>
${mark ? MARK(markFill || strand, w - Math.min(w, h) * 0.12, h - Math.min(w, h) * 0.12, Math.min(w, h) / 2600) : ''}
</svg>`;
  writeFileSync(join(OUT, file), svg);
}

const textures = ['straight', 'body-wave', 'loose-wave', 'deep-wave', 'curly', 'kinky'];
const palettes = [
  { bg1: C.parchment, bg2: '#E4D6B8', strand: C.espresso, strand2: C.brown, markFill: C.antique },
  { bg1: C.emerald, bg2: C.deep, strand: '#1a1410', strand2: C.gold, markFill: C.gold },
  { bg1: C.ivory, bg2: C.parchment, strand: '#1d1612', strand2: '#6b4a33', markFill: C.antique },
  { bg1: '#3b2a1f', bg2: C.espresso, strand: C.gold, strand2: '#8a6a45', markFill: C.gold },
];
let seed = 7;
for (const t of textures) {
  palettes.forEach((p, i) => art({ file: `${t}-${i + 1}.svg`, w: 800, h: 1000, kind: t, seed: seed++, ...p }));
}
// Hero & editorial
art({ file: 'hero.svg', w: 1920, h: 1080, bg1: C.emerald, bg2: C.deep, strand: C.gold, strand2: '#8f7a52', kind: 'body-wave', seed: 101, count: 140, spread: 1.2, top: -0.05, len: 1.1, mark: false });
art({ file: 'hero-mobile.svg', w: 900, h: 1400, bg1: C.emerald, bg2: C.deep, strand: C.gold, strand2: '#8f7a52', kind: 'body-wave', seed: 102, count: 110, spread: 1.3, top: -0.05, len: 1.1, mark: false });
art({ file: 'editorial-1.svg', w: 1200, h: 1500, bg1: C.parchment, bg2: '#E1D2B2', strand: C.espresso, strand2: C.antique, kind: 'loose-wave', seed: 103, count: 120, spread: 0.9, markFill: C.antique });
art({ file: 'editorial-2.svg', w: 1600, h: 1000, bg1: '#2f2118', bg2: '#1a120c', strand: C.gold, strand2: '#6f5536', kind: 'deep-wave', seed: 104, count: 140, spread: 1.1, markFill: C.gold });
art({ file: 'editorial-3.svg', w: 1200, h: 1500, bg1: C.emerald, bg2: C.deep, strand: C.parchment, strand2: C.gold, kind: 'straight', seed: 105, count: 110, spread: 0.8, markFill: C.gold });
art({ file: 'custom-unit.svg', w: 1600, h: 1100, bg1: C.ivory, bg2: C.parchment, strand: '#241a13', strand2: C.antique, kind: 'curly', seed: 106, count: 90, spread: 1.0, markFill: C.antique });
art({ file: 'journal-1.svg', w: 1200, h: 800, bg1: C.parchment, bg2: '#E8DCC2', strand: C.espresso, strand2: C.brown, kind: 'body-wave', seed: 107, count: 90, spread: 1.2, markFill: C.antique });
art({ file: 'journal-2.svg', w: 1200, h: 800, bg1: C.emerald, bg2: C.deep, strand: C.gold, strand2: C.parchment, kind: 'curly', seed: 108, count: 80, spread: 1.2, markFill: C.gold });
art({ file: 'journal-3.svg', w: 1200, h: 800, bg1: '#3b2a1f', bg2: C.espresso, strand: C.parchment, strand2: C.gold, kind: 'straight', seed: 109, count: 90, spread: 1.2, markFill: C.gold });
art({ file: 'journal-4.svg', w: 1200, h: 800, bg1: C.ivory, bg2: C.parchment, strand: '#241a13', strand2: C.antique, kind: 'deep-wave', seed: 110, count: 90, spread: 1.2, markFill: C.antique });
for (let i = 1; i <= 8; i++) {
  const p = palettes[i % 4];
  art({ file: `social-${i}.svg`, w: 900, h: 900, kind: textures[i % 6], seed: 200 + i, count: 80, spread: 0.9, ...p });
}
// Accessories
art({ file: 'care-kit.svg', w: 800, h: 1000, bg1: C.ivory, bg2: C.parchment, strand: C.antique, strand2: C.emerald, kind: 'loose-wave', seed: 301, count: 30, spread: 0.4, markFill: C.antique });
art({ file: 'storage-bag.svg', w: 800, h: 1000, bg1: C.emerald, bg2: C.deep, strand: C.gold, strand2: C.parchment, kind: 'straight', seed: 302, count: 30, spread: 0.4, markFill: C.gold });
console.log('Demo images written to', OUT);
