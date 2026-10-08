import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useAddFamilyItem, useClearDone, useFamilyList, useRemoveFamilyItem, useToggleFamilyItem } from '../hooks';
import { familyMeta } from '../meta';
import type { FamilyItem, FamilyListKind, ShoppingGrouping } from '../types';
import { categoryLabel, ItemEditSheet } from './ItemEditSheet';
import { PersonPicker, usePeople, type Person } from './PersonPicker';

interface Props {
  list: FamilyListKind;
  /** Dashboard mode: limits items and hides clean-up actions. */
  compact?: boolean;
  onOpen?: () => void;
  /** Only this person's items (child profile). `undefined` = everyone. */
  childId?: string;
}

const config = {
  tomorrow: {
    icon: 'briefcase',
    titleKey: 'family.tomorrow.title',
    placeholderKey: 'family.tomorrow.placeholder',
    emptyKey: 'family.tomorrow.empty',
  },
  shopping: {
    icon: 'shopping-cart',
    titleKey: 'family.shopping.title',
    placeholderKey: 'family.shopping.placeholder',
    emptyKey: 'family.shopping.empty',
  },
} as const;

/** One-tap suggestions for "Para mañana" (routine = repeats every day). */
const TOMORROW_SUGGESTIONS: { key: string; routine: boolean }[] = [
  { key: 'backpack', routine: true },
  { key: 'clothes', routine: true },
  { key: 'snack', routine: true },
  { key: 'sports', routine: false },
  { key: 'authorization', routine: false },
];

interface Group {
  key: string;
  title: string;
  color: string;
  items: FamilyItem[];
}

/**
 * Checklist grouped by person ("Casa" + each child), or by category/store for
 * shopping. Built for speed: pick a person chip, type, Enter.
 */
export function FamilyChecklist({ list, compact, onOpen, childId }: Props) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const items = useFamilyList(list);
  const add = useAddFamilyItem();
  const toggle = useToggleFamilyItem();
  const remove = useRemoveFamilyItem();
  const clearDone = useClearDone();
  const [title, setTitle] = useState('');
  const [personId, setPersonId] = useState<string | null>(childId ?? null);
  const [routine, setRoutine] = useState(false);
  const [grouping, setGrouping] = useState<ShoppingGrouping>('person');
  const [editing, setEditing] = useState<FamilyItem | null>(null);
  const cfg = config[list];
  const fixedPerson = childId !== undefined;

  const { people, isLoading: peopleLoading } = usePeople();
  const personOf = useMemo(() => new Map<string | null, Person>(people.map((p) => [p.id, p])), [people]);
  const visible = useMemo(
    () => (items.data ?? []).filter((i) => !fixedPerson || i.childId === childId),
    [items.data, fixedPerson, childId],
  );

  const groups: Group[] = useMemo(() => {
    if (fixedPerson)
      return visible.length ? [{ key: 'all', title: '', color: personOf.get(childId)?.color ?? familyMeta.accent, items: visible }] : [];
    if (list === 'shopping' && grouping !== 'person') {
      const map = new Map<string, FamilyItem[]>();
      for (const i of visible) {
        const k = grouping === 'category' ? categoryLabel(t, i.category) : (i.store ?? t('family.shopping.anyStore'));
        map.set(k, [...(map.get(k) ?? []), i]);
      }
      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, groupItems]) => ({ key: k, title: k, color: familyMeta.accent, items: groupItems }));
    }
    return people
      .map((p) => ({ key: p.id ?? 'home', title: p.name, color: p.color, items: visible.filter((i) => i.childId === p.id) }))
      .filter((g) => g.items.length > 0);
  }, [fixedPerson, visible, list, grouping, people, personOf, childId, t]);

  const doneCount = visible.filter((i) => i.done).length;
  const submit = (value = title, asRoutine = routine) => {
    if (!value.trim()) return;
    add.mutate({ list, title: value, childId: personId, routine: list === 'tomorrow' && asRoutine }, { onSuccess: () => setTitle('') });
  };

  const existing = new Set(visible.filter((i) => i.childId === personId).map((i) => i.title.toLowerCase()));
  const suggestions =
    list === 'tomorrow' && !compact
      ? TOMORROW_SUGGESTIONS.map((s) => ({ ...s, label: t(`family.tomorrow.suggestions.${s.key}`) })).filter(
          (s) => !existing.has(s.label.toLowerCase()),
        )
      : [];

  const chip = (label: string, active: boolean, onPress: () => void, icon?: 'repeat' | 'plus') => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole={icon === 'plus' ? 'button' : 'switch'}
      aria-checked={icon === 'plus' ? undefined : active}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 30,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? withAlpha(colors.primary, 0.12) : 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={12} color={active ? colors.primary : colors.textMuted} /> : null}
      <AppText variant="caption" color={active ? colors.primary : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );

  const describe = (i: FamilyItem) => {
    const parts: string[] = [];
    if (i.quantity) parts.push(i.quantity);
    if (list === 'shopping' && grouping !== 'store' && i.store) parts.push(i.store);
    if (list === 'shopping' && grouping !== 'person' && !fixedPerson && i.childId) parts.push(personOf.get(i.childId)?.name ?? '');
    if (i.routine) parts.push(t('family.item.everyDay'));
    return parts.filter(Boolean).join(' · ') || undefined;
  };

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t(cfg.titleKey)}
        icon={cfg.icon}
        accent={familyMeta.accent}
        actionLabel={compact && onOpen ? t('common.open') : !compact && doneCount ? t('family.clearDone', { count: doneCount }) : undefined}
        onAction={compact ? onOpen : doneCount ? () => clearDone.mutate(list) : undefined}
      />

      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        {fixedPerson ? null : <PersonPicker people={people} value={personId} onChange={setPersonId} />}
        <TextField
          compact
          leftIcon="plus"
          placeholder={t(cfg.placeholderKey, { name: personOf.get(personId)?.name ?? '' })}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => submit()}
          submitBehavior="submit"
          returnKeyType="done"
        />
        {list === 'tomorrow' && !compact ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {chip(t('family.item.everyDay'), routine, () => setRoutine(!routine), 'repeat')}
            {suggestions.map((s) => chip(s.label, false, () => submit(s.label, s.routine), 'plus'))}
          </View>
        ) : null}
        {list === 'shopping' && !compact && !fixedPerson && visible.length > 0 ? (
          <SegmentedControl<ShoppingGrouping>
            accessibilityLabel={t('family.shopping.groupBy')}
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: 'person', label: t('family.shopping.byPerson'), icon: 'users' },
              { value: 'category', label: t('family.shopping.byCategory'), icon: 'tag' },
              { value: 'store', label: t('family.shopping.byStore'), icon: 'map-pin' },
            ]}
          />
        ) : null}
      </View>

      {items.isLoading || peopleLoading ? (
        <LoadingState />
      ) : items.isError ? (
        <ErrorState onRetry={() => void items.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState compact icon={cfg.icon} accent={familyMeta.accent} title={t(cfg.emptyKey)} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {groups.map((group) => (
            <View key={group.key}>
              {group.title ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxs }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.color }} />
                  <AppText variant="overline" tone="textMuted">
                    {group.title}
                  </AppText>
                </View>
              ) : null}
              {(compact ? group.items.slice(0, 4) : group.items).map((item) => (
                <Checkbox
                  completedStyle
                  key={item.id}
                  checked={item.done}
                  onChange={() => toggle.mutate(item)}
                  label={item.title}
                  description={compact ? undefined : describe(item)}
                  color={personOf.get(item.childId)?.color ?? group.color}
                  right={
                    compact ? undefined : (
                      <View style={{ flexDirection: 'row' }}>
                        <IconButton icon="edit-2" size={15} label={`${t('common.edit')}: ${item.title}`} onPress={() => setEditing(item)} />
                        <IconButton
                          icon="x"
                          size={16}
                          label={`${t('common.delete')}: ${item.title}`}
                          onPress={() => remove.mutate(item.id)}
                        />
                      </View>
                    )
                  }
                />
              ))}
            </View>
          ))}
        </View>
      )}
      <ItemEditSheet item={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
