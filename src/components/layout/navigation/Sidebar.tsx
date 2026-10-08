import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useSignOut } from '@/hooks/useSignOut';
import { useAppPreferences } from '@/state/appPreferences';
import { useAuthStore } from '@/state/authStore';
import { lighten, withAlpha } from '@/utils/color';
import { makeStyles, useTheme } from '@/theme';
import { BrandMark } from '../BrandMark';
import type { NavItem } from './useNavItems';
import { useNavItems } from './useNavItems';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (routeName: string) => void;
}

/** Desktop / tablet navigation (section 6). Collapses to an icon rail. */
export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  const styles = useStyles();
  const { colors, layout, spacing } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { breakpoint } = useBreakpoint();
  const collapsedPref = useAppPreferences((s) => s.sidebarCollapsed);
  const toggle = useAppPreferences((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.session?.user);
  const signOut = useSignOut();
  const { main, system } = useNavItems();

  const forcedRail = breakpoint === 'medium';
  const rail = forcedRail || collapsedPref;

  const renderItem = ({ module, badge }: NavItem) => {
    const active = activeRoute === module.routeName;
    const label = t(module.titleKey);
    // Each module keeps its own colour (lightened to read well on the dark menu).
    const tint = lighten(module.accent, 0.35);
    return (
      <Pressable
        key={module.id}
        onPress={() => onNavigate(module.routeName)}
        accessibilityRole="link"
        aria-selected={active}
        accessibilityLabel={badge ? `${label}, ${badge}` : label}
        style={(s) => {
          const { hovered, pressed } = interaction(s);
          return [
            styles.item,
            rail && styles.itemRail,
            { backgroundColor: active ? colors.sidebarActive : hovered || pressed ? colors.sidebarSurface : 'transparent' },
          ];
        }}
      >
        {active ? <View style={[styles.activeIndicator, { backgroundColor: tint }]} /> : null}
        <View style={[styles.itemIcon, { backgroundColor: active ? withAlpha(tint, 0.22) : 'transparent' }]}>
          <Icon name={module.icon} size={18} color={active ? tint : withAlpha(tint, 0.85)} />
        </View>
        {rail ? null : (
          <AppText
            variant="bodyStrong"
            color={active ? colors.sidebarText : withAlpha(colors.sidebarText, 0.78)}
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        )}
        {badge ? (
          <View style={[styles.badge, rail && styles.badgeRail]}>
            <AppText variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 13 }}>
              {badge > 99 ? '99+' : badge}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.root, { width: rail ? layout.sidebarRailWidth : layout.sidebarWidth, paddingTop: insets.top + spacing.xl }]}
      role="navigation"
    >
      <View style={[styles.brandRow, rail && { justifyContent: 'center', paddingHorizontal: 0 }]}>
        <BrandMark compact={rail} onDark />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.nav, rail && { paddingHorizontal: spacing.md }]}>
        {rail ? null : (
          <AppText variant="overline" color={colors.sidebarTextMuted} style={styles.sectionLabel}>
            {t('nav.sections.main')}
          </AppText>
        )}
        {main.map(renderItem)}
        <View style={styles.separator} />
        {system.map(renderItem)}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        {!forcedRail ? (
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={rail ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            style={(s) => [
              styles.item,
              rail && styles.itemRail,
              { backgroundColor: interaction(s).hovered ? colors.sidebarSurface : 'transparent' },
            ]}
          >
            <Icon name={rail ? 'chevrons-right' : 'chevrons-left'} size={18} color={colors.sidebarTextMuted} />
            {rail ? null : (
              <AppText variant="small" color={colors.sidebarTextMuted}>
                {t('nav.collapseSidebar')}
              </AppText>
            )}
          </Pressable>
        ) : null}
        {user ? (
          <View style={[styles.userCard, rail && { justifyContent: 'center', paddingHorizontal: 0 }]}>
            <Avatar name={user.displayName} size={34} />
            {rail ? null : (
              <View style={{ flex: 1 }}>
                <AppText variant="smallStrong" color={colors.sidebarText} numberOfLines={1}>
                  {user.displayName}
                </AppText>
                <AppText variant="caption" color={colors.sidebarTextMuted} numberOfLines={1}>
                  {user.email}
                </AppText>
              </View>
            )}
            {rail ? null : (
              <Pressable
                onPress={signOut}
                accessibilityRole="button"
                accessibilityLabel={t('auth.signOut')}
                hitSlop={10}
                style={styles.signOut}
              >
                <Icon name="log-out" size={17} color={colors.sidebarTextMuted} />
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { backgroundColor: t.colors.sidebar, borderRightWidth: 1, borderRightColor: t.colors.sidebarBorder },
  brandRow: { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.xl, flexDirection: 'row', alignItems: 'center' },
  nav: { paddingHorizontal: t.spacing.md, gap: 2, paddingBottom: t.spacing.lg },
  sectionLabel: { paddingHorizontal: t.spacing.md, marginBottom: t.spacing.sm, marginTop: t.spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 42,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.md,
  },
  itemRail: { justifyContent: 'center', paddingHorizontal: 0, minHeight: 46 },
  itemIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeIndicator: {
    position: 'absolute',
    left: -t.spacing.md,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: t.colors.sidebarAccent,
  },
  separator: { height: 1, backgroundColor: t.colors.sidebarBorder, marginVertical: t.spacing.md, marginHorizontal: t.spacing.sm },
  badge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRail: { position: 'absolute', top: 6, right: 10, minWidth: 16, height: 16 },
  footer: {
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: t.colors.sidebarBorder,
    paddingTop: t.spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.sm,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sidebarSurface,
  },
  signOut: { padding: t.spacing.xs },
}));
