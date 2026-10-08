import { canvasColors, type ColorScheme } from './colors';

/**
 * Colour styles the user can pick in Settings → Appearance. Every palette
 * keeps the same three layers (dark canvas → light cards → coloured module
 * tiles) and only overrides the base schemes in colors.ts. Module colours
 * (Calendarios azul, ToDo verde…) never change, so each module stays
 * recognisable whatever the style.
 */
export type PaletteId = 'nitido' | 'bosque' | 'grafito' | 'medianoche';

export interface Palette {
  id: PaletteId;
  light: Partial<ColorScheme>;
  dark: Partial<ColorScheme>;
  /** Overrides for content drawn directly on the canvas (light mode). */
  canvas: Partial<ColorScheme>;
  /** Swatches for the settings preview. */
  preview: { outer: string; menu: string; card: string; accent: string };
}

export const palettes: Palette[] = [
  {
    id: 'nitido',
    light: {},
    dark: {},
    canvas: canvasColors,
    preview: { outer: '#131C2E', menu: '#0B1220', card: '#FBF8F1', accent: '#2563EB' },
  },
  {
    id: 'bosque',
    light: {
      background: '#123128',
      surface: '#FAF6EC',
      surfaceMuted: '#F2ECDD',
      surfacePressed: '#EAE2CF',
      border: '#E3DAC6',
      borderStrong: '#CDBFA4',
      primary: '#2F6B4F',
      primaryPressed: '#25563F',
      primarySoft: '#E1EEE6',
      focus: '#4E9B76',
      sidebar: '#0B231C',
      sidebarSurface: '#133028',
      sidebarActive: '#1D4337',
      sidebarBorder: '#163A30',
      sidebarText: '#F2EFE6',
      sidebarTextMuted: '#A9B8AE',
      sidebarAccent: '#E9C46A',
    },
    dark: {
      background: '#0A1C17',
      surface: '#122822',
      surfaceMuted: '#183229',
      surfacePressed: '#1F3C32',
      border: '#24443A',
      borderStrong: '#33584B',
      primary: '#7CC3A0',
      primaryPressed: '#5FAE88',
      primarySoft: '#16352A',
      onPrimary: '#06130F',
      sidebar: '#06130F',
      sidebarSurface: '#0E211B',
      sidebarActive: '#173229',
      sidebarBorder: '#10241E',
      sidebarAccent: '#E9C46A',
    },
    canvas: {
      text: '#F2EFE6',
      textMuted: '#C3CEC6',
      textSubtle: '#93A69A',
      border: '#25493D',
      borderStrong: '#376052',
      surfaceMuted: '#1A3D33',
      surfacePressed: '#22493D',
      primary: '#E9C46A',
      primarySoft: '#2C4A3A',
      info: '#9BD8C0',
      success: '#8FD7A8',
      warning: '#F3D27A',
      danger: '#F4A796',
    },
    preview: { outer: '#123128', menu: '#0B231C', card: '#FAF6EC', accent: '#2F6B4F' },
  },
  {
    id: 'grafito',
    light: {
      background: '#24201D',
      surface: '#F7F3EE',
      surfaceMuted: '#EFE9E1',
      surfacePressed: '#E6DED3',
      border: '#E2D9CD',
      borderStrong: '#CBBFB0',
      primary: '#B45309',
      primaryPressed: '#9A4508',
      primarySoft: '#FCEFD9',
      focus: '#D97706',
      sidebar: '#181513',
      sidebarSurface: '#221E1B',
      sidebarActive: '#332D29',
      sidebarBorder: '#2A2522',
      sidebarText: '#F5F0EA',
      sidebarTextMuted: '#B1A79D',
      sidebarAccent: '#F59E0B',
    },
    dark: {
      background: '#141210',
      surface: '#1E1B18',
      surfaceMuted: '#272320',
      surfacePressed: '#302B27',
      border: '#332E2A',
      borderStrong: '#453E39',
      primary: '#FBBF24',
      primaryPressed: '#F59E0B',
      primarySoft: '#3A2E14',
      onPrimary: '#1A1405',
      sidebar: '#0C0B0A',
      sidebarSurface: '#171513',
      sidebarActive: '#26221F',
      sidebarBorder: '#1A1816',
      sidebarAccent: '#FBBF24',
    },
    canvas: {
      text: '#F5F0EA',
      textMuted: '#CBC1B6',
      textSubtle: '#9C9186',
      border: '#3A332E',
      borderStrong: '#4D4540',
      surfaceMuted: '#2E2925',
      surfacePressed: '#38322D',
      primary: '#FBBF24',
      primarySoft: '#3A2E1C',
      info: '#93C5FD',
      success: '#86EFAC',
      warning: '#FCD34D',
      danger: '#FCA5A5',
    },
    preview: { outer: '#24201D', menu: '#181513', card: '#F7F3EE', accent: '#B45309' },
  },
  {
    id: 'medianoche',
    light: {
      background: '#1B1A3A',
      surface: '#FAF8FF',
      surfaceMuted: '#F1EEFB',
      surfacePressed: '#E8E4F7',
      border: '#E2DDF3',
      borderStrong: '#C9C2E6',
      primary: '#6D28D9',
      primaryPressed: '#5B21B6',
      primarySoft: '#EDE7FE',
      focus: '#8B5CF6',
      sidebar: '#121128',
      sidebarSurface: '#1B1A38',
      sidebarActive: '#2A2852',
      sidebarBorder: '#211F45',
      sidebarText: '#F1EFFF',
      sidebarTextMuted: '#A9A5D1',
      sidebarAccent: '#A78BFA',
    },
    dark: {
      background: '#0E0D22',
      surface: '#17162F',
      surfaceMuted: '#1F1D3C',
      surfacePressed: '#272548',
      border: '#2A2850',
      borderStrong: '#3A3769',
      primary: '#A78BFA',
      primaryPressed: '#8B5CF6',
      primarySoft: '#2A2357',
      onPrimary: '#0E0D22',
      sidebar: '#08071A',
      sidebarSurface: '#12112A',
      sidebarActive: '#211F45',
      sidebarBorder: '#14132E',
      sidebarAccent: '#C4B5FD',
    },
    canvas: {
      text: '#F1EFFF',
      textMuted: '#C4C0E6',
      textSubtle: '#9894C4',
      border: '#302E5E',
      borderStrong: '#433F78',
      surfaceMuted: '#25234B',
      surfacePressed: '#2E2B5A',
      primary: '#C4B5FD',
      primarySoft: '#2F2A5E',
      info: '#93C5FD',
      success: '#86EFAC',
      warning: '#FCD34D',
      danger: '#FDA4AF',
    },
    preview: { outer: '#1B1A3A', menu: '#121128', card: '#FAF8FF', accent: '#6D28D9' },
  },
];

export const DEFAULT_PALETTE: PaletteId = 'nitido';

export const getPalette = (id: PaletteId | string | undefined): Palette => palettes.find((p) => p.id === id) ?? palettes[0];
