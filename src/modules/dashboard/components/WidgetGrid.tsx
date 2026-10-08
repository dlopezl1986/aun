import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppPreferences } from '@/state/appPreferences';
import type { DashboardWidgetState } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import type { WidgetSize } from '@/types/module';
import { WidgetFrame } from './WidgetFrame';

function columnsFor(width: number): number {
  if (width < 680) return 1;
  if (width < 1080) return 2;
  return 3;
}

function spanFor(size: WidgetSize, columns: number): number {
  if (size === 'full') return columns;
  if (size === 'lg') return Math.min(2, columns);
  return 1;
}

interface Props {
  widgets: DashboardWidgetState[];
  editing?: boolean;
  onMove?: (id: string, direction: -1 | 1) => void;
  onResize?: (id: string, size: WidgetSize) => void;
  onHide?: (id: string) => void;
}

/**
 * Responsive widget grid driven by the measured container width (not the
 * window), so it adapts correctly next to the sidebar. Honours each widget's
 * (user-chosen) size; in edit mode widgets get reorder/resize/hide controls.
 */
export function WidgetGrid({ widgets, editing, onMove, onResize, onHide }: Props) {
  const { spacing, layout } = useTheme();
  // A measurement is only trusted for the window size it was taken at.
  const [measured, setMeasured] = useState({ width: 0, viewport: 0 });
  const viewport = useWindowDimensions();
  const { hasSidebar, breakpoint } = useBreakpoint();
  const collapsed = useAppPreferences((s) => s.sidebarCollapsed);
  // Until the container is measured, estimate it from the window so the grid
  // renders on the first frame (no blank flash, works in background tabs).
  const sidebar = !hasSidebar ? 0 : breakpoint === 'medium' || collapsed ? layout.sidebarRailWidth : layout.sidebarWidth;
  const gutter = !hasSidebar ? spacing.lg : breakpoint === 'medium' ? spacing.xxl : spacing.xxxl;
  const estimate = Math.min(viewport.width - sidebar - gutter * 2, layout.contentMaxWidth);
  const width = measured.width && measured.viewport === viewport.width ? measured.width : estimate;
  const gap = spacing.xl;
  const columns = columnsFor(width);
  const colWidth = columns > 0 ? (width - gap * (columns - 1)) / columns : width;

  return (
    <View
      onLayout={(e) => setMeasured({ width: e.nativeEvent.layout.width, viewport: viewport.width })}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}
    >
      {width > 0
        ? widgets.map((w, i) => {
            const span = spanFor(w.size, columns);
            const Component = w.definition.component;
            return (
              <View key={w.definition.id} style={{ width: colWidth * span + gap * (span - 1) }}>
                {editing ? (
                  <WidgetFrame
                    definition={w.definition}
                    size={w.size}
                    isFirst={i === 0}
                    isLast={i === widgets.length - 1}
                    onMove={(d) => onMove?.(w.definition.id, d)}
                    onResize={(s) => onResize?.(w.definition.id, s)}
                    onHide={() => onHide?.(w.definition.id)}
                  >
                    <Component />
                  </WidgetFrame>
                ) : (
                  <Component />
                )}
              </View>
            );
          })
        : null}
    </View>
  );
}
