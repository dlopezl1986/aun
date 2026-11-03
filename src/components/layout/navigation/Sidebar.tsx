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
import { isLight, lighten, withAlpha } from '@/utils/color';
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
  // Light menus («Aire») use the module colours as they are; dark ones lighten them.
  const darkMenu = !isLight(colors.sidebar);

  const renderItem = ({ module, badge }: NavItem) => {
    const active = activeRoute === module.routeName;
    const label = t(module.titleKey);
    // Each module keeps its own colour (lightened to read well on a dark menu).
    const tint = darkMenu ? lighten(module.accent, 0.35) : module.accent;
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
        <View style={[styles.itemIcon, { backgroundColor: withAlpha(tint, active ? 0.2 : darkMenu ? 0 : 0.1) }]}>
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
    <View style={[styles.outer, { width: rail ? layout.sidebarRailWidth : layout.sidebarWidth, paddingTop: insets.top + spacing.md }]}>
      <View style={[styles.root, { paddingBottom: insets.bottom }]} role="navigation">
        <View style={[styles.brandRow, rail && { justifyContent: 'center', paddingHorizontal: 0 }]}>
          <BrandMark compact={rail} onDark={darkMenu} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.nav, rail && { paddingHorizontal: spacing.sm }]}>
          {rail ? null : (
            <AppText variant="overline" color={colors.sidebarTextMuted} style={styles.sectionLabel}>
              {t('nav.sections.main')}
            </AppText>
          )}
          {main.map(renderItem)}
          <View style={styles.separator} />
          {system.map(renderItem)}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: spacing.md }]}>
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
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // The menu floats as a rounded panel over the page background.
  outer: { backgroundColor: t.colors.background, padding: t.spacing.md, paddingRight: 0 },
  root: {
    flex: 1,
    backgroundColor: t.colors.sidebar,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.colors.sidebarBorder,
    boxShadow: t.shadow.card,
    paddingTop: t.spacing.lg,
    overflow: 'hidden',
  },
  brandRow: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg, flexDirection: 'row', alignItems: 'center' },
  nav: { paddingHorizontal: t.spacing.md, gap: 2, paddingBottom: t.spacing.lg },
  sectionLabel: { paddingHorizontal: t.spacing.md, marginBottom: t.spacing.sm, marginTop: t.spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 44,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.md,
  },
  itemRail: { justifyContent: 'center', paddingHorizontal: 0, minHeight: 46 },
  itemIcon: { width: 32, height: 32, borderRadius: t.radius.sm + 4, alignItems: 'center', justifyContent: 'center' },
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
