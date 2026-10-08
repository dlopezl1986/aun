import { Fragment } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';
import type { Folder } from '../types';

interface Props {
  path: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const crumbs = [
    { id: null as string | null, name: t('modules.secondBrain.title') },
    ...path.map((f) => ({ id: f.id as string | null, name: f.name })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: 'center', gap: spacing.xs }}
      accessibilityLabel={t('secondBrain.breadcrumb')}
    >
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={c.id ?? 'root'}>
            {i > 0 ? <Icon name="chevron-right" size={14} color={colors.textSubtle} /> : null}
            <Pressable
              onPress={() => onNavigate(c.id)}
              disabled={last}
              accessibilityRole="link"
              aria-disabled={last}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
            >
              {i === 0 ? <Icon name="home" size={14} color={last ? colors.text : colors.primary} /> : null}
              <AppText variant="smallStrong" color={last ? colors.text : colors.primary} numberOfLines={1}>
                {c.name}
              </AppText>
            </Pressable>
          </Fragment>
        );
      })}
    </ScrollView>
  );
}
