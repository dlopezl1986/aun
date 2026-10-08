import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';

interface Props {
  title: string;
  subtitle?: string;
}

/** Sub-page of Settings with a back affordance and a readable max width. */
export function SettingsPage({ title, subtitle, children }: PropsWithChildren<Props>) {
  return (
    <Screen maxWidth={760}>
      <PageHeader title={title} subtitle={subtitle} onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      {children}
    </Screen>
  );
}
