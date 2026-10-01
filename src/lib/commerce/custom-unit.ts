// Shared (client + server) custom-unit configurator pricing.
// ---------------------------------------------------------------------------
// Custom unit pricing (configurator). Surcharges are in kobo and stored in settings.custom_unit.
// ---------------------------------------------------------------------------
export type CustomUnitConfig = {
  base_length: number; per_inch: number;
  groups: { key: string; label: string; required?: boolean; multiple?: boolean; options: { value: string; label: string; price: number; review?: boolean }[] }[];
};

export const DEFAULT_CUSTOM_UNIT: CustomUnitConfig = {
  base_length: 14, per_inch: 1500000,
  groups: [
    { key: 'hair', label: 'Hair', required: true, options: [
      { value: 'virgin', label: 'Virgin hair', price: 0 }, { value: 'donor', label: 'Donor hair', price: 25000000 }] },
    { key: 'texture', label: 'Texture', required: true, options: [
      { value: 'straight', label: 'Straight', price: 0 }, { value: 'body-wave', label: 'Body Wave', price: 0 }, { value: 'loose-wave', label: 'Loose Wave', price: 0 },
      { value: 'deep-wave', label: 'Deep Wave', price: 2000000 }, { value: 'curly', label: 'Curly', price: 3000000 }, { value: 'kinky', label: 'Kinky', price: 3000000 }] },
    { key: 'length', label: 'Length', required: true, options: ['14', '16', '18', '20', '22', '24', '26', '28', '30'].map((l) => ({ value: l, label: `${l}"`, price: 0 })) },
    { key: 'lace', label: 'Lace', required: true, options: [
      { value: '5x5', label: '5×5 HD closure', price: 0 }, { value: '6x6', label: '6×6 HD closure', price: 4000000 },
      { value: '13x4', label: '13×4 HD frontal', price: 8000000 }, { value: '13x6', label: '13×6 HD frontal', price: 12000000 },
      { value: 'full-lace', label: 'Full lace', price: 25000000 }] },
    { key: 'density', label: 'Density', required: true, options: [
      { value: '150', label: '150%', price: 0 }, { value: '180', label: '180%', price: 4500000 }, { value: '200', label: '200%', price: 9000000 }, { value: '220', label: '220%', price: 14000000 }] },
    { key: 'color', label: 'Colour', required: true, options: [
      { value: 'natural-black', label: 'Natural black', price: 0 }, { value: 'chestnut-brown', label: 'Chestnut brown', price: 5000000 },
      { value: 'honey-blonde', label: 'Honey blonde', price: 8000000 }, { value: 'custom-colour', label: 'Custom colour (we will confirm)', price: 8000000, review: true }] },
    { key: 'parting', label: 'Parting', options: [
      { value: 'free', label: 'Free part', price: 0 }, { value: 'middle', label: 'Middle part', price: 0 }, { value: 'side', label: 'Side part', price: 0 }] },
    { key: 'cap_size', label: 'Cap size', required: true, options: [
      { value: 'small', label: 'Small (21")', price: 0 }, { value: 'medium', label: 'Medium (22")', price: 0 }, { value: 'large', label: 'Large (23")', price: 0 },
      { value: 'custom', label: 'Custom measurements', price: 1000000, review: true }] },
    { key: 'finish', label: 'Finishing', multiple: true, options: [
      { value: 'baby-hair', label: 'Baby hair', price: 1500000 }, { value: 'bleached-knots', label: 'Bleached knots', price: 1000000 },
      { value: 'plucking', label: 'Extra plucking', price: 1000000 }, { value: 'styling', label: 'Styling (curls or layers)', price: 2500000 },
      { value: 'glueless', label: 'Glueless conversion (band + combs)', price: 1500000 }] },
  ],
};

export function priceCustomUnit(base: number, cfg: CustomUnitConfig, sel: Record<string, unknown>) {
  let price = base; let review = true; // every custom unit is confirmed by the team before production
  const summary: string[] = [];
  const errors: string[] = [];
  for (const g of cfg.groups) {
    const raw = sel[g.key];
    const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
    if (g.required && !values.length) errors.push(`Choose ${g.label.toLowerCase()}`);
    for (const v of values) {
      const opt = g.options.find((o) => o.value === v);
      if (!opt) { errors.push(`Invalid ${g.label.toLowerCase()}`); continue; }
      price += opt.price;
      if (opt.review) review = true;
      summary.push(`${g.label}: ${opt.label}`);
    }
  }
  const len = Number(sel.length);
  if (len > cfg.base_length) price += (len - cfg.base_length) / 2 * cfg.per_inch;
  return { price: Math.round(price), review, summary, errors };
}

