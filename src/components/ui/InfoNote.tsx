import { View } from 'react-native';

import { SurfaceScope, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface InfoNoteProps {
  title: string;
  description?: string;
  items?: string[];
  icon?: IconName;
  tone?: 'info' | 'warning';
}

/**
 * Honest status note: used to state clearly what is not available yet
 * (and when it will be) instead of shipping buttons that do nothing.
 */
function InfoNoteBase({ title, description, items, icon = 'info', tone = 'info' }: InfoNoteProps) {
  const { colors, spacing, radius } = useTheme();
  const fg = tone === 'info' ? colors.info : colors.warning;
  const bg = tone === 'info' ? colors.infoSoft : colors.warningSoft;
  return (
    <View
      style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: bg }}
      accessibilityRole="text"
    >
      <Icon name={icon} size={18} color={fg} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="smallStrong" color={fg}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="small" tone="textMuted">
            {description}
          </AppText>
        ) : null}
        {items?.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <AppText variant="small" tone="textMuted">
              •
            </AppText>
            <AppText variant="small" tone="textMuted" style={{ flex: 1 }}>
              {item}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Has its own background: always drawn with the normal (non-canvas) palette. */
export function InfoNote(props: InfoNoteProps) {
  return (
    <SurfaceScope>
      <InfoNoteBase {...props} />
    </SurfaceScope>
  );
}
