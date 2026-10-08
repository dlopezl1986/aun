export const SUPPORTED_LANGUAGES = [
  { code: 'es', nativeName: 'Español', locale: 'es-ES' },
  { code: 'en', nativeName: 'English', locale: 'en-GB' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'es';

export function localeFor(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.locale ?? 'es-ES';
}
