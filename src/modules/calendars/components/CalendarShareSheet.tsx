import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { InfoNote } from '@/components/ui/InfoNote';
import { LoadingState } from '@/components/ui/States';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useFamily, useSetAccess, useShareCalendarWithFamily, useSharing } from '@/services/sharing/hooks';
import {
  accessViaFamily,
  calendarSpaceId,
  familyAccessFor,
  peopleOf,
  personCalendarAccess,
  type CalendarAccess,
  type ShareRole,
} from '@/services/sharing/spaces';
import { SurfaceScope, useTheme } from '@/theme';
import type { Calendar } from '../types';

type Access = CalendarAccess;
type FamilyAccess = CalendarAccess;

/** Who can see / edit one of my calendars, and whose calendar it is. */
function Editor({ calendar, onClose }: { calendar: Calendar; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { me, spaces } = useSharing();
  const setAccess = useSetAccess();
  const family = useFamily();
  const shareFamily = useShareCalendarWithFamily();
  const spaceId = calendarSpaceId(calendar.ownerId, calendar.id);
  const space = spaces.find((s) => s.id === spaceId);
  const people = peopleOf(spaces, me);
  const familyNow: FamilyAccess = space?.family && space.family === family.family?.id ? (space.familyRole ?? 'view') : 'none';
  const [familyAccess, setFamilyAccess] = useState<FamilyAccess>(familyNow);
  const [assignee, setAssignee] = useState<string | null>(space?.assignee ?? null);
  // What each person can really do now (their own permission or the family's).
  const [access, setAccessState] = useState<Record<string, Access>>(() =>
    Object.fromEntries(people.map((p) => [p.uid, personCalendarAccess(spaces, spaceId, p.uid)])),
  );
  // The family never gives anyone more than what was chosen for them.
  const familyFinal = familyAccessFor(family.family, familyAccess, access);
  const pickFamily = (v: FamilyAccess) => {
    setFamilyAccess(v);
    // "Toda la familia" sets everyone in it at once; each person can then be changed.
    setAccessState((a) => {
      const next = { ...a };
      for (const p of people) {
        const via = accessViaFamily(family.family, p.uid, v);
        if (family.family?.memberIds.includes(p.uid)) next[p.uid] = via;
      }
      return next;
    });
    if (assignee && family.family?.memberIds.includes(assignee) && accessViaFamily(family.family, assignee, v) !== 'edit')
      setAssignee(null);
  };

  const save = async () => {
    if (familyFinal !== familyNow) await shareFamily.mutateAsync({ calendar, role: familyFinal === 'none' ? null : familyFinal });
    for (const p of people) {
      const role = access[p.uid] === 'none' ? null : (access[p.uid] as ShareRole);
      const wasAssignee = space?.assignee === p.uid;
      const isAssignee = assignee === p.uid;
      if (role === (space?.roles[p.uid] ?? null) && wasAssignee === isAssignee) continue;
      await setAccess.mutateAsync({
        person: p,
        changes: [{ spaceId, role, def: { kind: 'calendar', refId: calendar.id, name: calendar.name } }],
        assign: isAssignee ? spaceId : wasAssignee ? null : undefined,
      });
    }
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('sharing.calendar.title', { name: calendar.name })}
      footer={
        people.length || family.withOthers ? (
          <>
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
            <Button label={t('common.save')} onPress={() => void save()} loading={setAccess.isPending || shareFamily.isPending} />
          </>
        ) : undefined
      }
    >
      {family.withOthers ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
          <AppText variant="bodyStrong">{t('sharing.family.wholeFamily')}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t('sharing.family.wholeFamilyHint')}
          </AppText>
          <ChipGroup<FamilyAccess>
            accessibilityLabel={t('sharing.family.wholeFamily')}
            selected={familyAccess}
            onToggle={pickFamily}
            options={(['none', 'view', 'edit'] as FamilyAccess[]).map((v) => ({ value: v, label: t(`sharing.roles.${v}`) }))}
          />
          {familyFinal !== familyAccess ? (
            <AppText variant="caption" tone="textMuted">
              {t('sharing.familyLowered', { role: t(`sharing.roles.${familyFinal}`) })}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {people.length ? (
        <>
          <AppText variant="small" tone="textMuted">
            {t('sharing.calendar.hint')}
          </AppText>
          {people.map((p) => (
            <View
              key={p.uid}
              style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar name={p.name || '?'} size={32} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {p.name}
                </AppText>
              </View>
              <ChipGroup<Access>
                accessibilityLabel={t('sharing.accessFor', { name: p.name })}
                selected={access[p.uid] ?? 'none'}
                onToggle={(v) => {
                  setAccessState((a) => ({ ...a, [p.uid]: v }));
                  if (v !== 'edit' && assignee === p.uid) setAssignee(null);
                }}
                options={(['none', 'view', 'edit'] as Access[]).map((v) => ({ value: v, label: t(`sharing.roles.${v}`) }))}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="smallStrong">{t('sharing.calendar.theirs', { name: p.name })}</AppText>
                  <AppText variant="caption" tone="textMuted">
                    {t('sharing.calendar.theirsHint')}
                  </AppText>
                </View>
                <Toggle
                  value={assignee === p.uid}
                  label={t('sharing.calendar.theirs', { name: p.name })}
                  onValueChange={(on) => {
                    setAssignee(on ? p.uid : null);
                    if (on) setAccessState((a) => ({ ...a, [p.uid]: 'edit' }));
                  }}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        <InfoNote icon="users" title={t('sharing.calendar.nobodyTitle')} description={t('sharing.calendar.nobody')} />
      )}
      <Button
        label={t('sharing.invite')}
        icon="user-plus"
        variant="secondary"
        onPress={() => {
          onClose();
          router.navigate({ pathname: '/family', params: { invite: '1' } });
        }}
      />
    </Sheet>
  );
}

/** Opens once the current permissions are loaded, so saving starts from them (never from "nothing"). */
export function CalendarShareSheet({ calendar, onClose }: { calendar: Calendar | null; onClose: () => void }) {
  const { query } = useSharing();
  if (!calendar) return null;
  if (!query.data || query.isFetching) {
    return (
      <Sheet visible onClose={onClose} title={calendar.name}>
        <LoadingState />
      </Sheet>
    );
  }
  // Its colours are the sheet's (not the page canvas'), like everything inside a Sheet.
  return (
    <SurfaceScope>
      <Editor key={calendar.id} calendar={calendar} onClose={onClose} />
    </SurfaceScope>
  );
}
