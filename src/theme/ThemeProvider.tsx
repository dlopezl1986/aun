import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { useAppPreferences } from '@/state/appPreferences';
import { buildTheme, lightTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);
/** The app's normal theme, so nested scopes can always return to it. */
const BaseThemeContext = createContext<Theme>(lightTheme);

/** Normal + canvas theme for the active mode and colour style. */
const CanvasThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useAppPreferences((s) => s.themeMode);
  const system = useColorScheme();
  const palette = useAppPreferences((s) => s.palette);
  const mode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => buildTheme(mode, palette), [mode, palette]);
  // In dark mode the canvas and the cards are both dark: no separate canvas palette.
  const canvas = useMemo(() => (mode === 'dark' ? theme : buildTheme(mode, palette, true)), [mode, palette, theme]);
  return (
    <BaseThemeContext.Provider value={theme}>
      <CanvasThemeContext.Provider value={canvas}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </CanvasThemeContext.Provider>
    </BaseThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Content drawn directly on the dark page canvas: text, borders and icons
 * switch to light colours (no-op in dark mode, where everything is dark).
 */
export function CanvasScope({ children }: PropsWithChildren) {
  const canvas = useContext(CanvasThemeContext);
  return <ThemeContext.Provider value={canvas}>{children}</ThemeContext.Provider>;
}

/** Anything with its own background (card, field, button, sheet) uses the normal palette again. */
export function SurfaceScope({ children }: PropsWithChildren) {
  const base = useContext(BaseThemeContext);
  return <ThemeContext.Provider value={base}>{children}</ThemeContext.Provider>;
}

/**
 * Creates a hook returning memoised, theme-aware styles.
 * Usage: `const useStyles = makeStyles((t) => ({ root: { padding: t.spacing.lg } }));`
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
