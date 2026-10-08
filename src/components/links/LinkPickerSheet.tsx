import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useServices } from '@/services/ServicesProvider';
import { useTheme } from '@/theme';
import type { EntityRef } from '@/types/entity';
import { sameRef, useLinkSources } from './useLinks';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Module doing the linking (its own sources are not offered). */
  ownerModuleId: string;
  value: EntityRef[];
  onChange: (refs: EntityRef[]) => void;
}

function PickerForm({ onClose, ownerModuleId, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const services = useServices();
  const sources = useLinkSources(ownerModuleId);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const current = sources[tab];

  const items = useQuery({
    queryKey: ['u', services.userId, 'links', 'pick', current?.module.id, current?.source.type, query.trim()],
    queryFn: () => current!.source.list(services, query.trim()),
    enabled: !!current,
  });

  const toggle = (ref: EntityRef) => onChange(value.some((r) => sameRef(r, ref)) ? value.filter((r) => !sameRef(r, ref)) : [...value, ref]);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('links.title')}
      subtitle={t('links.subtitle')}
      footer={<Button label={t('links.done', { count: value.length })} icon="check" onPress={onClose} />}
    >
      {!sources.length ? (
        <EmptyState compact icon="link" title={t('links.noSources')} />
      ) : (
        <>
          {sources.length > 1 ? (
            <SegmentedControl<string>
              accessibilityLabel={t('links.title')}
              value={String(tab)}
              onChange={(v) => {
                setTab(Number(v));
                setQuery('');
              }}
              options={sources.map((s, i) => ({ value: String(i), label: t(s.source.labelKey), icon: s.source.icon }))}
            />
          ) : null}
          <TextField leftIcon="search" placeholder={t('links.search')} value={query} onChangeText={setQuery} compact />
          {items.isLoading ? (
            <LoadingState />
          ) : !items.data?.length ? (
            <EmptyState compact icon={current?.source.icon ?? 'link'} title={query ? t('links.noResults') : t('links.empty')} />
          ) : (
            <View>
              {items.data.map((item) => {
                const selected = value.some((r) => sameRef(r, item.ref));
                return (
                  <ListRow
                    key={item.ref.id}
                    icon={current.source.icon}
                    accent={item.color ?? current.module.accent}
                    title={item.title}
                    subtitle={item.subtitle}
                    onPress={() => toggle(item.ref)}
                    right={
                      <Icon name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? colors.primary : colors.borderStrong} />
                    }
                  />
                );
              })}
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Picks entities from other modules to link (documents, children…). */
export function LinkPickerSheet(props: Props) {
  return props.visible ? <PickerForm {...props} /> : null;
}
