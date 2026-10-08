import { useTranslation } from 'react-i18next';

import { localeFor } from '@/i18n/languages';

/** BCP-47 locale for Intl formatting, following the selected app language. */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return localeFor(i18n.language);
}
