export interface ColorScheme {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  focus: string;
  sidebar: string;
  sidebarSurface: string;
  sidebarActive: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarBorder: string;
  sidebarAccent: string;
}

export const lightColors: ColorScheme = {
  // Three layers: dark canvas (same family as the menu) → cream cards →
  // coloured tiles inside them. Text on the canvas uses `canvasColors`.
  background: '#131C2E',
  surface: '#FBF8F1',
  surfaceMuted: '#F3EEE4',
  surfacePressed: '#EBE4D7',
  border: '#E3DBCB',
  borderStrong: '#CEC4B1',
  text: '#0B1220',
  textMuted: '#3F4A5C',
  textSubtle: '#5F6B7E',
  primary: '#2563EB',
  primaryPressed: '#1D4FD7',
  primarySoft: '#E6EEFE',
  onPrimary: '#FFFFFF',
  success: '#15803D',
  successSoft: '#E3F5E9',
  warning: '#B45309',
  warningSoft: '#FEF2DC',
  danger: '#DC2626',
  dangerSoft: '#FDE8E8',
  info: '#0369A1',
  infoSoft: '#E0F0FB',
  overlay: 'rgba(11, 18, 32, 0.5)',
  focus: '#3B82F6',
  sidebar: '#0B1220',
  sidebarSurface: '#131C2E',
  sidebarActive: '#1C2840',
  sidebarText: '#F1F5F9',
  sidebarTextMuted: '#9AA6BA',
  sidebarBorder: '#1C2638',
  sidebarAccent: '#60A5FA',
};

export const darkColors: ColorScheme = {
  background: '#080C16',
  surface: '#111827',
  surfaceMuted: '#1A2233',
  surfacePressed: '#222C40',
  border: '#263147',
  borderStrong: '#36435D',
  text: '#F1F5F9',
  textMuted: '#B8C2D3',
  textSubtle: '#8D99AE',
  primary: '#60A5FA',
  primaryPressed: '#3B82F6',
  primarySoft: '#16284A',
  onPrimary: '#071226',
  success: '#4ADE80',
  successSoft: '#123222',
  warning: '#FBBF24',
  warningSoft: '#3A2C0E',
  danger: '#F87171',
  dangerSoft: '#3D1719',
  info: '#38BDF8',
  infoSoft: '#0E2C40',
  overlay: 'rgba(0, 0, 0, 0.65)',
  focus: '#93C5FD',
  sidebar: '#05080F',
  sidebarSurface: '#0D1424',
  sidebarActive: '#17223A',
  sidebarText: '#F1F5F9',
  sidebarTextMuted: '#8D99AE',
  sidebarBorder: '#141C2D',
  sidebarAccent: '#60A5FA',
};

/**
 * Overrides for content placed DIRECTLY on the dark canvas (page titles,
 * section labels, ghost buttons, chips…). Anything with its own surface
 * (cards, fields, buttons, sheets) switches back to the normal palette.
 */
export const canvasColors: Partial<ColorScheme> = {
  text: '#F1F5F9',
  textMuted: '#B9C3D3',
  textSubtle: '#8E9AAF',
  border: '#2A3650',
  borderStrong: '#3D4B68',
  surfaceMuted: '#1C2740',
  surfacePressed: '#243150',
  primary: '#7CB4FF',
  primarySoft: '#1B2D52',
  info: '#7DD3FC',
  success: '#6EE7A0',
  warning: '#FCD34D',
  danger: '#FCA5A5',
};
