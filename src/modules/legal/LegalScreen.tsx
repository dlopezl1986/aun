import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { InfoNote } from '@/components/ui/InfoNote';
import { appConfig } from '@/config/featureFlags';
import { useTheme } from '@/theme';
import { legalText, type LegalDoc } from './content';

function Body({ doc }: { doc: LegalDoc }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const text = legalText(doc, i18n.language, {
    owner: appConfig.legalOwner || t('legal.ownerPending'),
    contact: appConfig.contactEmail || t('legal.contactPending'),
  });
  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="caption" tone="textMuted">
        {text.updated}
      </AppText>
      {text.sections.map((s) => (
        <View key={s.heading} style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong" accessibilityRole="header">
            {s.heading}
          </AppText>
          {s.paragraphs?.map((p) => (
            <AppText key={p} variant="body" tone="textMuted">
              {p}
            </AppText>
          ))}
          {s.bullets?.map((b) => (
            <View key={b} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <AppText variant="body" tone="textMuted">
                •
              </AppText>
              <AppText variant="body" tone="textMuted" style={{ flex: 1 }}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** /legal/privacy and /legal/terms — readable signed in or out. */
export function LegalScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc: LegalDoc = params.doc === 'terms' ? 'terms' : 'privacy';
  const title = legalText(doc, i18n.language, { owner: '', contact: '' }).title;
  return (
    <Screen maxWidth={760}>
      <PageHeader title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {!appConfig.legalOwner || !appConfig.contactEmail ? (
        <InfoNote icon="edit-3" tone="warning" title={t('legal.draftTitle')} description={t('legal.draft')} />
      ) : null}
      <Card>
        <Body doc={doc} />
      </Card>
    </Screen>
  );
}
