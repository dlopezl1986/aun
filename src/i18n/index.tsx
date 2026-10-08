import { createInstance } from 'i18next';
import { useEffect, type PropsWithChildren } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { useAppPreferences } from '@/state/appPreferences';
import { DEFAULT_LANGUAGE } from './languages';
import { en } from './locales/en';
import { es } from './locales/es';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Keeps i18next in sync with the persisted language preference. */
export function I18nProvider({ children }: PropsWithChildren) {
  const language = useAppPreferences((s) => s.language);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export { i18n };
