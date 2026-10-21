import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { interaction } from '@/components/ui/interaction';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { opMeta } from '../meta';

/**
 * How a topic number looks: studied (filled), chosen (outlined: on the day
 * shown / picked), planned (on some other day), idle, or off (left out).
 */
export type TileState = 'studied' | 'chosen' | 'planned' | 'idle' | 'off';

export interface Tile {
  key: string;
  number: number;
  state: TileState;
  /** Spoken label ("Tema 5 · La Constitución, estudiado"). */
  label: string;
}

/** The syllabus as a grid of numbered tiles. */
export function TopicGrid({ tiles, onPress, size = 44 }: { tiles: Tile[]; onPress: (tile: Tile) => void; size?: number }) {
  const { colors, radius } = useTheme();
  const accent = opMeta.accent;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {tiles.map((tile) => {
        const { state } = tile;
        const bg =
          state === 'studied'
            ? accent
            : state === 'chosen'
              ? withAlpha(accent, 0.14)
              : state === 'planned'
                ? withAlpha(accent, 0.06)
                : state === 'off'
                  ? 'transparent'
                  : colors.surfaceMuted;
        const fg = state === 'studied' ? '#FFFFFF' : state === 'idle' || state === 'off' ? colors.textMuted : accent;
        return (
          <Pressable
            key={tile.key}
            onPress={() => onPress(tile)}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            aria-pressed={state === 'chosen' || state === 'studied'}
            style={(s) => ({
              width: size,
              height: size,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bg,
              borderWidth: state === 'chosen' ? 2 : state === 'planned' || state === 'off' ? 1 : 0,
              borderStyle: state === 'off' ? 'dashed' : 'solid',
              borderColor: state === 'off' ? colors.borderStrong : accent,
              opacity: state === 'off' ? 0.6 : interaction(s).pressed ? 0.7 : 1,
              transform: [{ scale: interaction(s).hovered ? 1.06 : 1 }],
            })}
          >
            <AppText variant="smallStrong" color={fg} style={state === 'off' ? { textDecorationLine: 'line-through' } : undefined}>
              {tile.number}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What the colours mean (only the states in use; labels can be changed). */
export function TileLegend({ states, labels = {} }: { states: TileState[]; labels?: Partial<Record<TileState, string>> }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const accent = opMeta.accent;
  const swatch: Record<TileState, object> = {
    studied: { backgroundColor: accent },
    chosen: { backgroundColor: withAlpha(accent, 0.14), borderWidth: 2, borderColor: accent },
    planned: { backgroundColor: withAlpha(accent, 0.06), borderWidth: 1, borderColor: accent },
    idle: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    off: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {states.map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[{ width: 12, height: 12, borderRadius: 3 }, swatch[s]]} />
          <AppText variant="caption" tone="textMuted">
            {labels[s] ?? t(`op.legend.${s}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
}
