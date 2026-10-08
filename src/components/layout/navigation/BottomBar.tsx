import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { useSignOut } from '@/hooks/useSignOut';
import { useAuthStore } from '@/state/authStore';
import { makeStyles, useTheme } from '@/theme';
import { useNavItems } from './useNavItems';

interface BottomBarProps {
  activeRoute: string;
  onNavigate: (routeName: string) => void;
}

/**
 * Phone navigation: 4 primary destinations + "More" sheet with the rest,
 * notifications and settings. Disabled modules never appear.
 */
export function BottomBar({ activeRoute, onNavigate }: BottomBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { mobileBar, mobileMore, notificationBadge } = useNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((s) => s.session?.user);
  const signOut = useSignOut();
  const moreActive = mobileMore.some((i) => i.module.routeName === activeRoute);

  const go = (route: string) => {
    setMoreOpen(false);
    onNavigate(route);
  };

  const tab = (
    key: string,
    label: string,
    icon: Parameters<typeof Icon>[0]['name'],
    active: boolean,
    onPress: () => void,
    badge?: number,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      aria-selected={active}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <View style={[styles.iconPill, active && { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={20} color={active ? colors.primary : colors.textSubtle} />
        {badge ? <View style={styles.dot} /> : null}
      </View>
      <AppText variant="caption" color={active ? colors.primary : colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
        {mobileBar.map(({ module }) =>
          tab(module.id, t(module.shortTitleKey ?? module.titleKey), module.icon, activeRoute === module.routeName, () =>
            go(module.routeName),
          ),
        )}
        {tab('more', t('nav.more'), 'menu', moreActive || moreOpen, () => setMoreOpen(true), notificationBadge)}
      </View>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        {user ? (
          <View style={styles.userRow}>
            <Avatar name={user.displayName} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{user.displayName}</AppText>
              <AppText variant="small" tone="textMuted">
                {user.email}
              </AppText>
            </View>
          </View>
        ) : null}
        <View>
          {mobileMore.map(({ module, badge }) => (
            <ListRow
              key={module.id}
              icon={module.icon}
              accent={module.accent}
              title={t(module.titleKey)}
              subtitle={t(module.descriptionKey)}
              onPress={() => go(module.routeName)}
              chevron
              right={
                badge ? (
                  <View style={styles.countPill}>
                    <AppText variant="caption" color="#FFFFFF">
                      {badge}
                    </AppText>
                  </View>
                ) : undefined
              }
            />
          ))}
        </View>
        <Divider />
        <ListRow
          icon="log-out"
          title={t('auth.signOut')}
          destructive
          onPress={() => {
            setMoreOpen(false);
            void signOut();
          }}
        />
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 50 },
  iconPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 4, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.danger },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.md },
  countPill: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
