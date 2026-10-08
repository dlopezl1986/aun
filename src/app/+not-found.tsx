import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/States';
import { CanvasScope, useTheme } from '@/theme';

export default function NotFound() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
      <CanvasScope>
        <EmptyState
          icon="compass"
          title={t('notFound.title')}
          description={t('notFound.description')}
          actionLabel={t('modules.goHome')}
          onAction={() => router.replace('/')}
        />
      </CanvasScope>
    </View>
  );
}
