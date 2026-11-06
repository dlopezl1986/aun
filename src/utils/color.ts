/** Returns `#RRGGBB` + alpha as rgba(). Accepts #RGB or #RRGGBB. */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Deterministic colour for a string (avatars, fallback accents). */
export function colorFromString(value: string, palette: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

/** Mixes a #RRGGBB colour towards white (amount 0–1) — e.g. accents on dark surfaces. */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** Is this a light colour (dark text / marks read better on it)? */
export function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  // Perceived brightness (ITU-R BT.601).
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62;
}

/** WCAG relative luminance of a #RRGGBB colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return -1;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const readableCache = new Map<string, string>();

/**
 * Module and category colours are picked for light backgrounds; on a dark
 * surface many of them (slate, violet, deep blue…) nearly disappear. This
 * lifts such a colour towards white just enough to reach `min` contrast
 * against `background`, keeping its hue. Light colours are returned as they
 * are, and so is near-black "ink" (meant for text on light swatches).
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  const lum = luminance(color);
  if (lum < 0 || luminance(background) > 0.3) return color;
  if (lum < 0.02) return color;
  const key = `${color}|${background}|${min}`;
  const hit = readableCache.get(key);
  if (hit) return hit;
  let out = color;
  for (let amount = 0.05; contrastRatio(out, background) < min && amount <= 1; amount += 0.05) {
    out = lighten(color, amount);
  }
  readableCache.set(key, out);
  return out;
}

/** Colour swatches get a thin outline when they would blend into the screen: light ones on light mode, very dark ones on dark mode. */
export function swatchNeedsOutline(color: string, mode: 'light' | 'dark'): boolean {
  return mode === 'dark' ? luminance(color) >= 0 && luminance(color) < 0.05 : isLight(color);
}
