import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { MIN_QUERY_LENGTH, runGlobalSearch } from '@/services/search/globalSearch';
import { useServices } from '@/services/ServicesProvider';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';
import { formatShortDate } from '@/utils/date';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Inicio search box: searches every enabled module at once (section 49).
 * Hidden behind the magnifier until opened. Web: press "/" anywhere to open, Esc to close.
 */
export function GlobalSearch({ open: shown, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const services = useServices();
  const modules = useEnabledModules();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 200);
  const active = query.length >= MIN_QUERY_LENGTH;

  const search = useQuery({
    queryKey: ['u', services.userId, 'search', modules.map((m) => m.id).join(','), query],
    queryFn: () => runGlobalSearch(query, modules, services),
    enabled: active,
    staleTime: 0,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        onOpenChange(true);
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === (inputRef.current as unknown as Element)) {
        setText('');
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  const open = (route?: string) => {
    if (!route) return;
    setText('');
    onOpenChange(false);
    router.navigate(route as Href);
  };

  if (!shown) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        ref={inputRef}
        leftIcon="search"
        pill
        placeholder={Platform.OS === 'web' ? t('search.placeholderWeb') : t('search.placeholder')}
        accessibilityLabel={t('search.placeholder')}
        value={text}
        onChangeText={setText}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus
      />
      {active ? (
        <Card padded={false} style={{ padding: spacing.sm }}>
          {search.isLoading ? (
            <LoadingState />
          ) : !search.data?.length ? (
            <EmptyState compact icon="search" title={t('search.noResults', { query })} description={t('search.noResultsHint')} />
          ) : (
            search.data.map((group) => (
              <View key={group.module.id} style={{ marginBottom: spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingTop: spacing.sm,
                  }}
                >
                  <Icon name={group.module.icon} size={14} color={group.module.accent} />
                  <AppText variant="overline" tone="textMuted" style={{ flex: 1 }}>
                    {t(group.module.titleKey)}
                  </AppText>
                  {group.total > group.results.length ? (
                    <AppText variant="caption" tone="textSubtle">
                      {t('search.more', { count: group.total - group.results.length })}
                    </AppText>
                  ) : null}
                </View>
                {group.results.map((r) => (
                  <ListRow
                    key={`${r.ref.type}:${r.ref.id}`}
                    icon={group.module.icon}
                    accent={group.module.accent}
                    title={r.title}
                    subtitle={[
                      r.kindKey ? t(r.kindKey) : null,
                      r.subtitle,
                      r.date ? formatShortDate(new Date(r.date.length === 10 ? `${r.date}T00:00:00` : r.date), locale) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    chevron
                    onPress={() => open(r.route)}
                  />
                ))}
              </View>
            ))
          )}
        </Card>
      ) : null}
    </View>
  );
}
