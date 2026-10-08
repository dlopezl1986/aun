import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorScheme, type FontWeightToken, type TypographyVariant } from '@/theme';

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
          color: color ?? theme.colors[tone],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
