import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';

/** Small lock next to a payment only its owner sees («Solo yo»). */
export function PrivateMark({ visible }: { visible?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!visible) return null;
  return <Icon name="lock" size={12} color={colors.textSubtle} accessibilityLabel={t('payments.privateLabel')} />;
}
