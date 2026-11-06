import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorScheme, type FontWeightToken, type TypographyVariant } from '@/theme';
import { readableOn } from '@/utils/color';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** Semantic colour from the theme. */
  tone?: keyof ColorScheme;
  /** Raw colour override (e.g. module accent). */
  color?: string;
  weight?: FontWeightToken;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', tone = 'text', color, weight, align, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const t = theme.typography[variant];
  const token = t as typeof t & { letterSpacing?: number; uppercase?: boolean };
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          fontFamily: theme.fontFamily[weight ?? t.weight],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: token.letterSpacing,
          textTransform: token.uppercase ? 'uppercase' : undefined,
          // Raw colours (module accents, categories) are lifted in dark mode so they stay legible.
          color: color ? (theme.mode === 'dark' ? readableOn(color, theme.colors.surface) : color) : theme.colors[tone],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
