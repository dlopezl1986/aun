import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Image } from 'expo-image';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { ChildAvatar } from '@/modules/family/components/ChildAvatar';
import { useChildren, useMembers } from '@/modules/family/hooks';
import { useFamily } from '@/services/sharing/hooks';
import { useAuthStore } from '@/state/authStore';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';

/** Inicio: a row with every family member (tap a face → their profile) + "Añadir". Only with Familia on. */
export function FamilyStrip({ size = 56 }: { size?: number }) {
  const enabled = useEnabledModules().some((m) => m.id === 'family');
  if (!enabled) return null;
  return <FamilyStripRow size={size} />;
}

function FamilyStripRow({ size: SIZE }: { size: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const children = useChildren();
  const members = children.data ?? [];
  const adults = useAdults(members.map((m) => m.name));
  if (children.isLoading) return null;

  const person = (key: string, label: string, onPress: () => void, avatar: ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s) => ({ alignItems: 'center', gap: spacing.xs, width: SIZE + 16, opacity: interaction(s).pressed ? 0.7 : 1 })}
    >
      {avatar}
      <AppText variant="smallStrong" tone="textMuted" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View accessibilityLabel={t('dashboard.family.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {adults.map((a) =>
          person(
            a.key,
            a.name.split(' ')[0],
            a.onPress,
            <View
              style={{ padding: 3, borderRadius: SIZE, backgroundColor: colors.surface, boxShadow: `0px 4px 14px ${colors.primary}22` }}
            >
              {a.photo ? (
                <Image
                  source={{ uri: a.photo }}
                  accessibilityLabel={a.name}
                  contentFit="cover"
                  style={{ width: SIZE - 6, height: SIZE - 6, borderRadius: SIZE }}
                />
              ) : (
                <Avatar name={a.name} size={SIZE - 6} />
              )}
            </View>,
          ),
        )}
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

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.toLocaleLowerCase() ?? '';

interface Adult {
  key: string;
  name: string;
  photo?: string | null;
  onPress: () => void;
}

/**
 * Me + the other adults of the family (people in the shared family and the ones
 * added in «Compartir familia»), skipping anyone who already has a profile in
 * Familia (that profile, with its photo, is shown instead).
 */
function useAdults(profileNames: string[]): Adult[] {
  const user = useAuthStore((s) => s.session?.user);
  const { family, me } = useFamily();
  const shared = useMembers().data ?? [];
  const taken = new Set(profileNames.map(firstName));
  const out: Adult[] = [];
  const add = (a: Adult) => {
    const k = firstName(a.name);
    if (!k || taken.has(k)) return;
    taken.add(k);
    out.push(a);
  };
  if (user) add({ key: 'me', name: user.displayName, photo: user.avatarUrl, onPress: () => router.navigate('/settings/profile') });
  for (const id of family?.memberIds ?? []) {
    if (id === me) continue;
    const name = family?.names[id];
    if (name) add({ key: `space:${id}`, name, onPress: () => router.navigate('/family') });
  }
  for (const m of shared) add({ key: `member:${m.id}`, name: m.name, onPress: () => router.navigate('/family') });
  return out;
}
