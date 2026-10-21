/**
 * Design tokens for AUN. Every visual value used by components must come
 * from here (directly or through the active Theme) — no magic numbers in UI.
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontWeightToken = keyof typeof fontFamily;

export interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightToken;
  letterSpacing?: number;
  uppercase?: boolean;
}

export const typography = {
  display: { fontSize: 32, lineHeight: 40, weight: 'bold', letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, weight: 'bold', letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, weight: 'semibold', letterSpacing: -0.3 },
  subheading: { fontSize: 16, lineHeight: 22, weight: 'semibold', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  bodyStrong: { fontSize: 15, lineHeight: 22, weight: 'medium' },
  small: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  smallStrong: { fontSize: 13, lineHeight: 18, weight: 'medium' },
  caption: { fontSize: 12, lineHeight: 16, weight: 'medium' },
  overline: { fontSize: 11, lineHeight: 14, weight: 'bold', letterSpacing: 0.9, uppercase: true },
} satisfies Record<string, TypographyToken>;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (WCAG / Apple HIG ≈ 44pt). */
export const hitSize = 44;

export const layout = {
  sidebarWidth: 252,
  sidebarRailWidth: 76,
  bottomBarHeight: 60,
  contentMaxWidth: 1280,
  formMaxWidth: 440,
} as const;

/** Accent colours used to identify modules, calendars, children, etc. */
export const accentPalette = [
  // By hue, from dark to light, so similar colours are easy to tell apart.
  '#1E3A8A', // navy
  '#2563EB', // blue
  '#60A5FA', // light blue
  '#0E7490', // dark teal
  '#06B6D4', // cyan
  '#14532D', // dark green
  '#16A34A', // green
  '#4ADE80', // light green
  '#A3E635', // lime
  '#CA8A04', // mustard
  '#FACC15', // yellow
  '#C2410C', // dark orange
  '#F97316', // orange
  '#FDBA74', // light orange
  '#991B1B', // dark red
  '#E5484D', // red
  '#FCA5A5', // light red
  '#BE185D', // magenta
  '#F472B6', // pink
  '#4C1D95', // dark purple
  '#8B5CF6', // purple
  '#C4B5FD', // lavender
  '#78350F', // brown
  '#1F2937', // charcoal
  '#64748B', // slate
  '#CBD5E1', // light grey
] as const;

/** Mid / dark colours only: for colours picked automatically under white text (avatars, new tags). */
export const strongPalette = [
  '#1E3A8A',
  '#2563EB',
  '#0E7490',
  '#16A34A',
  '#14532D',
  '#CA8A04',
  '#C2410C',
  '#E5484D',
  '#991B1B',
  '#BE185D',
  '#8B5CF6',
  '#4C1D95',
  '#78350F',
  '#64748B',
] as const;
