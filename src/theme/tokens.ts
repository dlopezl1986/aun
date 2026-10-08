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
  '#2563EB',
  '#7C3AED',
  '#0EA5A4',
  '#16A34A',
  '#84CC16',
  '#EAB308',
  '#F59E0B',
  '#F97316',
  '#E5484D',
  '#EC4899',
  '#8B5CF6',
  '#64748B',
  // More choices (appended so existing defaults keep their colour).
  '#4F46E5',
  '#06B6D4',
  '#C026D3',
  '#92400E',
  '#1F2937',
] as const;
