import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useTheme } from '@/theme';
import type { EntityRef } from '@/types/entity';
import { withAlpha } from '@/utils/color';
import { sameRef, useResolvedLinks } from './useLinks';

interface Props {
  refs: EntityRef[];
  /** Edit mode: shows a remove (×) button on each chip. */
  onRemove?: (ref: EntityRef) => void;
  /** Read mode: tapping a chip opens the linked entity. */
  openable?: boolean;
  onOpen?: () => void;
}

/** Chips for cross-module links (documents, people…). */
export function LinkChips({ refs, onRemove, openable, onOpen }: Props) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const { data } = useResolvedLinks(refs);
  const items = (data ?? []).filter((i) => refs.some((r) => sameRef(r, i.ref)));
  if (!items.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {items.map((item) => {
        const color = item.color ?? item.module.accent;
        const canOpen = openable && !!item.route;
        return (
          <View
            key={`${item.ref.module}:${item.ref.id}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: withAlpha(color, 0.35),
              backgroundColor: withAlpha(color, 0.08),
            }}
          >
            <Pressable
              disabled={!canOpen}
              onPress={() => {
                onOpen?.();
                router.navigate(item.route as Href);
              }}
              accessibilityRole={canOpen ? 'link' : 'text'}
              accessibilityLabel={`${t(item.module.titleKey)}: ${item.title}`}
              style={(s) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: 32,
                paddingLeft: spacing.md,
                paddingRight: onRemove ? spacing.xs : spacing.md,
                borderRadius: radius.pill,
                opacity: interaction(s).pressed ? 0.7 : 1,
              })}
            >
              <Icon name={item.icon} size={13} color={color} />
              <AppText variant="smallStrong" color={color} numberOfLines={1} style={{ maxWidth: 220 }}>
                {item.title}
              </AppText>
            </Pressable>
            {onRemove ? (
              <Pressable
                onPress={() => onRemove(item.ref)}
                accessibilityRole="button"
                accessibilityLabel={`${t('links.remove')}: ${item.title}`}
                hitSlop={8}
                style={{ paddingRight: spacing.sm, paddingLeft: 2 }}
              >
                <Icon name="x" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
