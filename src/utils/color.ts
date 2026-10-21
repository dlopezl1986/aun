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
