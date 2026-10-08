import { useTranslation } from 'react-i18next';

import { AuthError, MIN_PASSWORD_LENGTH } from '@/services/auth';

export function useAuthErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown) => t(`auth.errors.${error instanceof AuthError ? error.code : 'unknown'}`, { min: MIN_PASSWORD_LENGTH });
}
