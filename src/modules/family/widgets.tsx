import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { StatTile } from '@/modules/dashboard/components/StatTile';
import { SummaryTile } from '@/modules/dashboard/components/SummaryTile';
import { PersonPicker, usePeople } from './components/PersonPicker';
import { useAddFamilyItem, useFamilyList } from './hooks';
import { familyMeta } from './meta';

const openFamily = () => router.navigate('/family');

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
