import { darkColors, lightColors, type ColorScheme } from './colors';
import { getPalette, type PaletteId } from './palettes';
import { fontFamily, layout, radius, spacing, typography } from './tokens';

export type ColorMode = 'light' | 'dark';

export interface Theme {
  mode: ColorMode;
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  layout: typeof layout;
  /** CSS gradient painted behind pages (null = flat background colour). */
  backdrop: string | null;
  shadow: {
    card: string;
    raised: string;
    none: string;
  };
}

export function buildTheme(mode: ColorMode, paletteId?: PaletteId, canvas = false): Theme {
  const palette = getPalette(paletteId);
  const colors: ColorScheme =
    mode === 'light' ? { ...lightColors, ...palette.light, ...(canvas ? palette.canvas : {}) } : { ...darkColors, ...palette.dark };
  return {
    mode,
    colors,
    spacing,
    radius,
    typography,
    fontFamily,
    layout,
    backdrop: palette.backdrop ? palette.backdrop[mode] : null,
    // `boxShadow` is supported by React Native's New Architecture on every platform.
    shadow:
      mode === 'light'
        ? {
            card: '0px 1px 2px rgba(20, 26, 46, 0.04), 0px 8px 24px rgba(40, 52, 110, 0.07)',
            raised: '0px 18px 48px rgba(20, 26, 46, 0.16)',
            none: 'none',
          }
        : {
            card: '0px 1px 2px rgba(0, 0, 0, 0.45), 0px 4px 12px rgba(0, 0, 0, 0.25)',
            raised: '0px 12px 32px rgba(0, 0, 0, 0.55)',
            none: 'none',
          },
  };
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
