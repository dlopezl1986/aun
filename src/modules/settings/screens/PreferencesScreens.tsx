import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { RadioRow } from '@/components/ui/RadioRow';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { useAppPreferences, type ThemeMode } from '@/state/appPreferences';
import { useModules } from '@/state/userSettingsStore';
import { palettes, SurfaceScope, useTheme, type Palette } from '@/theme';
import { withAlpha } from '@/utils/color';
import { SettingsPage } from '../components/SettingsPage';

export function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const language = useAppPreferences((s) => s.language);
  const setLanguage = useAppPreferences((s) => s.setLanguage);
  return (
    <SettingsPage title={t('settings.language.title')} subtitle={t('settings.language.subtitle')}>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((l) => (
          <RadioRow
            key={l.code}
            label={l.nativeName}
            description={l.code === 'es' ? t('settings.language.default') : undefined}
            selected={language === l.code}
            onSelect={() => setLanguage(l.code)}
            icon="globe"
          />
        ))}
      </View>
    </SettingsPage>
  );
}

const themeOptions: { mode: ThemeMode; icon: 'sun' | 'moon' | 'smartphone' }[] = [
  { mode: 'light', icon: 'sun' },
  { mode: 'dark', icon: 'moon' },
  { mode: 'system', icon: 'smartphone' },
];

export function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const mode = useAppPreferences((s) => s.themeMode);
  const setMode = useAppPreferences((s) => s.setThemeMode);
  const palette = useAppPreferences((s) => s.palette);
  const setPalette = useAppPreferences((s) => s.setPalette);
  const accents = useModules()
    .filter((m) => m.kind === 'feature')
    .map((m) => m.accent)
    .slice(0, 4);
  return (
    <SettingsPage title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
      <AppText variant="overline" tone="textMuted">
        {t('settings.appearance.palette')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} accessibilityRole="radiogroup">
        {palettes.map((p) => (
          <PaletteCard key={p.id} palette={p} accents={accents} selected={palette === p.id} onSelect={() => setPalette(p.id)} />
        ))}
      </View>
      <AppText variant="small" tone="textMuted">
        {t('settings.appearance.paletteHint')}
      </AppText>

      <AppText variant="overline" tone="textMuted" style={{ marginTop: spacing.md }}>
        {t('settings.appearance.mode')}
      </AppText>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {themeOptions.map((o) => (
          <RadioRow
            key={o.mode}
            label={t(`settings.appearance.${o.mode}`)}
            icon={o.icon}
            selected={mode === o.mode}
            onSelect={() => setMode(o.mode)}
          />
        ))}
      </View>
    </SettingsPage>
  );
}

/** Mini preview of a colour style: dark canvas + menu, light card, module-coloured tiles. */
function PaletteCard({
  palette,
  accents,
  selected,
  onSelect,
}: {
  palette: Palette;
  accents: string[];
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { outer, menu, card, accent } = palette.preview;
  return (
    <SurfaceScope>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        aria-checked={selected}
        accessibilityLabel={`${t(`settings.appearance.palettes.${palette.id}.name`)}. ${t(`settings.appearance.palettes.${palette.id}.description`)}`}
        style={(s) => ({
          flexGrow: 1,
          flexBasis: 160,
          maxWidth: 260,
          padding: spacing.sm,
          gap: spacing.sm,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: selected ? colors.primary : interaction(s).hovered ? colors.borderStrong : colors.border,
          backgroundColor: colors.surface,
        })}
      >
        <View style={{ height: 92, borderRadius: radius.md, overflow: 'hidden', flexDirection: 'row', backgroundColor: outer }}>
          <View style={{ width: 20, backgroundColor: menu, paddingTop: 8, alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: accent }} />
            <View style={{ width: 9, height: 3, borderRadius: 2, backgroundColor: withAlpha('#FFFFFF', 0.3) }} />
            <View style={{ width: 9, height: 3, borderRadius: 2, backgroundColor: withAlpha('#FFFFFF', 0.3) }} />
          </View>
          <View style={{ flex: 1, padding: 8, gap: 5 }}>
            <View style={{ width: '55%', height: 5, borderRadius: 3, backgroundColor: withAlpha('#FFFFFF', 0.85) }} />
            <View style={{ flex: 1, borderRadius: 6, backgroundColor: card, padding: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {accents.map((a) => (
                <View
                  key={a}
                  style={{
                    width: '46%',
                    flexGrow: 1,
                    height: 22,
                    borderRadius: 4,
                    backgroundColor: withAlpha(a, 0.16),
                    borderTopWidth: 3,
                    borderTopColor: a,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="smallStrong" style={{ flex: 1 }}>
            {t(`settings.appearance.palettes.${palette.id}.name`)}
          </AppText>
          {selected ? <Icon name="check-circle" size={16} color={colors.primary} /> : null}
        </View>
        <AppText variant="caption" tone="textMuted" numberOfLines={2}>
          {t(`settings.appearance.palettes.${palette.id}.description`)}
        </AppText>
      </Pressable>
    </SurfaceScope>
  );
}
