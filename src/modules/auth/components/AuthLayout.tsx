import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BrandMark } from '@/components/layout/BrandMark';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';

const highlights: { icon: IconName; key: string; color: string }[] = [
  { icon: 'book-open', key: 'secondBrain', color: '#9D94FF' },
  { icon: 'calendar', key: 'calendars', color: '#60A5FA' },
  { icon: 'check-square', key: 'todo', color: '#4ADE80' },
  { icon: 'users', key: 'family', color: '#FBBF24' },
  { icon: 'mail', key: 'email', color: '#FB7185' },
];

interface Props {
  title: string;
  subtitle?: string;
}

export function AuthLayout({ title, subtitle, children }: PropsWithChildren<Props>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { breakpoint } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const split = breakpoint === 'expanded' || breakpoint === 'wide';

  return (
    <View style={styles.root}>
      {split ? (
        <View style={styles.brandPanel}>
          <BrandMark onDark size={40} />
          <View style={{ gap: 20 }}>
            <AppText variant="display" color={colors.sidebarText} style={{ fontSize: 36, lineHeight: 44 }}>
              {t('auth.tagline')}
            </AppText>
            <AppText variant="body" color={colors.sidebarTextMuted}>
              {t('auth.taglineSub')}
            </AppText>
            <View style={{ gap: 14, marginTop: 12 }}>
              {highlights.map((h) => (
                <View key={h.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={[styles.highlightIcon, { backgroundColor: withAlpha(h.color, 0.16) }]}>
                    <Icon name={h.icon} size={18} color={h.color} />
                  </View>
                  <AppText variant="bodyStrong" color={colors.sidebarText}>
                    {t(`auth.highlights.${h.key}`)}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
          <AppText variant="small" color={colors.sidebarTextMuted}>
            © AUN · All You Need
          </AppText>
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.formScroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {split ? null : (
              <View style={{ marginBottom: 12 }}>
                <BrandMark size={40} />
              </View>
            )}
            <View style={{ gap: 6, marginBottom: 8 }}>
              <AppText variant="display" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="body" tone="textMuted">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, flexDirection: 'row', backgroundColor: t.colors.surface },
  brandPanel: {
    width: '44%',
    maxWidth: 620,
    backgroundColor: t.colors.sidebar,
    padding: t.spacing.huge,
    justifyContent: 'space-between',
  },
  highlightIcon: { width: 36, height: 36, borderRadius: t.radius.md, alignItems: 'center', justifyContent: 'center' },
  formScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: t.spacing.xl },
  form: { width: '100%', maxWidth: t.layout.formMaxWidth, gap: t.spacing.lg },
}));
