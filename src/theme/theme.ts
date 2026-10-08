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
    // `boxShadow` is supported by React Native's New Architecture on every platform.
    shadow:
      mode === 'light'
        ? {
            card: '0px 1px 2px rgba(11, 18, 32, 0.06), 0px 4px 12px rgba(11, 18, 32, 0.05)',
            raised: '0px 16px 40px rgba(11, 18, 32, 0.18)',
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
