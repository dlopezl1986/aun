import { useQueries } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/States';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useServices } from '@/services/ServicesProvider';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import type { EntityRef } from '@/types/entity';
import type { AppModule, RelatedContext, RelatedItem, RelatedSource } from '@/types/module';
import { formatShortDate, formatTime, fromDateKey, toDateKey } from '@/utils/date';

/** Related sources of ENABLED modules (a disabled module simply disappears). */
export function useRelatedSources(): { module: AppModule; source: RelatedSource }[] {
  const modules = useEnabledModules();
  return useMemo(() => modules.flatMap((module) => (module.related ?? []).map((source) => ({ module, source }))), [modules]);
}

function whenLabel(item: RelatedItem, today: string, locale: string, t: (k: string) => string): string | undefined {
  if (!item.date) return undefined;
  const isDateKey = item.date.length === 10;
  const d = isDateKey ? fromDateKey(item.date) : new Date(item.date);
  const key = toDateKey(d);
  const day = key === today ? t('common.today') : key < today ? t('todo.due.overdue') : formatShortDate(d, locale);
  return item.allDay || isDateKey ? day : `${day} · ${formatTime(d, locale)}`;
}

/**
 * "Relacionado con X": one card per module that links to `target`
 * (upcoming events, pending tasks…), each with a "create linked" action.
 */
export function RelatedPanel({ target, accent, context }: { target: EntityRef; accent?: string; context?: RelatedContext }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const services = useServices();
  const { spacing } = useTheme();
  const sources = useRelatedSources();
  const [creating, setCreating] = useState<string | null>(null);

  const results = useQueries({
    queries: sources.map(({ source }) => ({
      queryKey: [
        'u',
        services.userId,
        source.scope,
        'related',
        source.id,
        target.module,
        target.type,
        target.id,
        today,
        context?.calendarId ?? null,
      ],
      queryFn: () => source.list(services, target, today, context),
    })),
  });

  return (
    <>
      {sources.map(({ module, source }, i) => {
        const q = results[i];
        const Create = source.Create;
        return (
          <Card key={source.id}>
            <CardHeader
              title={t(source.titleKey)}
              icon={source.icon}
              accent={module.accent}
              actionLabel={Create ? t(source.createLabelKey ?? 'common.add') : undefined}
              onAction={Create ? () => setCreating(source.id) : undefined}
            />
            {q?.isLoading ? (
              <LoadingState />
            ) : !q?.data?.length ? (
              <AppText variant="small" tone="textMuted">
                {t('related.empty')}
              </AppText>
            ) : (
              <View style={{ gap: spacing.xxs, marginHorizontal: -spacing.md }}>
                {q.data.map((item) => {
                  const when = whenLabel(item, today, locale, t);
                  return (
                    <ListRow
                      key={`${item.ref.type}:${item.ref.id}:${item.date ?? ''}`}
                      icon={source.icon}
                      accent={item.color ?? accent ?? module.accent}
                      title={item.title}
                      subtitle={[when, item.subtitle].filter(Boolean).join(' · ') || undefined}
                      chevron={!!item.route}
                      onPress={item.route ? () => router.navigate(item.route as Href) : undefined}
                    />
                  );
                })}
              </View>
            )}
            {Create ? <Create visible={creating === source.id} onClose={() => setCreating(null)} link={target} context={context} /> : null}
          </Card>
        );
      })}
    </>
  );
}
