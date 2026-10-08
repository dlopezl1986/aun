import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n/languages';
import { storageKeys } from '@/storage/keyValueStore';
import { DEFAULT_PALETTE, type PaletteId } from '@/theme/palettes';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Device-level preferences (not tied to a user account). */
interface AppPreferencesState {
  themeMode: ThemeMode;
  /** Colour style (Settings → Appearance). */
  palette: PaletteId;
  language: LanguageCode;
  sidebarCollapsed: boolean;
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setPalette: (palette: PaletteId) => void;
  setLanguage: (language: LanguageCode) => void;
  toggleSidebar: () => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      palette: DEFAULT_PALETTE,
      language: DEFAULT_LANGUAGE,
      sidebarCollapsed: false,
      hydrated: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setPalette: (palette) => set({ palette }),
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: storageKeys.device('preferences'),
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: ({ themeMode, palette, language, sidebarCollapsed }) => ({ themeMode, palette, language, sidebarCollapsed }),
      onRehydrateStorage: () => () => {
        useAppPreferences.setState({ hydrated: true });
      },
    },
  ),
);
