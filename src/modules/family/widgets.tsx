import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { StatTile } from '@/modules/dashboard/components/StatTile';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { useTheme } from '@/theme';
import { formatShortDate } from '@/utils/date';
import { ChildAvatar } from './components/ChildAvatar';
import { FamilyChecklist } from './components/FamilyChecklist';
import { PersonPicker, usePeople } from './components/PersonPicker';
import { useAddFamilyItem, useChildren, useFamilyList } from './hooks';
import { familyMeta } from './meta';
import { upcomingBirthdays } from './selectors';

const openFamily = () => router.navigate('/family');

export function TomorrowWidget() {
  return <FamilyChecklist list="tomorrow" compact onOpen={openFamily} />;
}

export function FamilyTodaySummary() {
  const { t } = useTranslation();
  const tomorrow = useFamilyList('tomorrow');
  const pendingTomorrow = (tomorrow.data ?? []).filter((i) => !i.done);
  const total = pendingTomorrow.length;
  return (
    <SummaryTile
      icon={familyMeta.icon}
      accent={familyMeta.accent}
      label={t('modules.family.title')}
      loading={tomorrow.isLoading}
      value={total === 0 ? t('family.summary.none') : t('family.summary.pending', { count: total })}
      details={[
        ...(pendingTomorrow.length ? [t('family.summary.tomorrow', { count: pendingTomorrow.length })] : []),
        ...pendingTomorrow.slice(0, 1).map((i) => i.title),
      ]}
      onPress={openFamily}
    />
  );
}

/** "Cumpleaños": upcoming birthdays of the children (next 90 days). */
export function BirthdaysWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const today = useToday();
  const { data, isLoading } = useChildren();
  const list = useMemo(() => upcomingBirthdays(data ?? [], today), [data, today]);

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader
        title={t('family.birthdays.title')}
        icon="gift"
        accent={familyMeta.accent}
        actionLabel={t('common.open')}
        onAction={openFamily}
      />
      {isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon="gift"
          accent={familyMeta.accent}
          title={t('family.birthdays.empty')}
          description={data?.length ? t('family.birthdays.emptyHint') : t('family.birthdays.noChildren')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {list.slice(0, 4).map((b) => (
            <View key={b.child.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
              <ChildAvatar child={b.child} size={34} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {b.child.name}
                </AppText>
                <AppText variant="small" tone="textMuted">
                  {t('family.birthdays.turns', { count: b.turns })} · {formatShortDate(b.date, locale)}
                </AppText>
              </View>
              <Badge
                label={b.daysUntil === 0 ? t('family.birthdays.today') : t('family.birthdays.inDays', { count: b.daysUntil })}
                tone={b.daysUntil <= 7 ? 'warning' : 'neutral'}
                icon="gift"
              />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function FamilyWeeklyStats() {
  const { t } = useTranslation();
  const tomorrow = useFamilyList('tomorrow');
  return (
    <>
      <StatTile
        icon="briefcase"
        accent={familyMeta.accent}
        value={(tomorrow.data ?? []).filter((i) => !i.done).length}
        label={t('family.stats.tomorrow')}
        loading={tomorrow.isLoading}
      />
    </>
  );
}

/** Quick action: add to "Para mañana" or the shopping list from Inicio. */
function QuickFamilyItemForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { people } = usePeople();
  const add = useAddFamilyItem();
  const [personId, setPersonId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const save = () => {
    if (!title.trim()) return;
    add.mutate({ list: 'tomorrow', title, childId: personId }, { onSuccess: onClose });
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('family.quick.title')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.add')} onPress={save} disabled={!title.trim()} loading={add.isPending} />
        </>
      }
    >
      <PersonPicker people={people} value={personId} onChange={setPersonId} />
      <TextField
        autoFocus
        label={t('family.quick.what')}
        placeholder={t('family.quick.tomorrowPlaceholder')}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={save}
        returnKeyType="done"
      />
    </Sheet>
  );
}

export function QuickFamilyItemSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <QuickFamilyItemForm onClose={onClose} /> : null;
}
