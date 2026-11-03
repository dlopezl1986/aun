import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { ChildAvatar } from '@/modules/family/components/ChildAvatar';
import { useChildren } from '@/modules/family/hooks';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';

const SIZE = 56;

/** Inicio: a row of family avatars (tap to open a member) + "Añadir". Only with Familia on. */
export function FamilyStrip() {
  const enabled = useEnabledModules().some((m) => m.id === 'family');
  if (!enabled) return null;
  return <FamilyStripRow />;
}

function FamilyStripRow() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const children = useChildren();
  const members = children.data ?? [];
  if (children.isLoading) return null;

  const person = (key: string, label: string, onPress: () => void, avatar: React.ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s) => ({ alignItems: 'center', gap: spacing.xs, width: SIZE + 16, opacity: interaction(s).pressed ? 0.7 : 1 })}
    >
      {avatar}
      <AppText variant="caption" tone="textMuted" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View accessibilityLabel={t('dashboard.family.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {members.map((m) =>
          person(
            m.id,
            m.name.split(' ')[0],
            () => router.navigate(`/family/child/${m.id}` as Href),
            <View style={{ padding: 3, borderRadius: SIZE, backgroundColor: colors.surface, boxShadow: `0px 4px 14px ${m.color}33` }}>
              <ChildAvatar child={m} size={SIZE - 6} />
            </View>,
          ),
        )}
        {person(
          'add',
          members.length ? t('dashboard.family.add') : t('dashboard.family.addFirst'),
          () => router.navigate('/family'),
          <View
            style={{
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={22} color={colors.primary} />
          </View>,
        )}
      </ScrollView>
    </View>
  );
}
