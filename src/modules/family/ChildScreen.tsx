import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { RelatedPanel } from '@/components/links/RelatedPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { fromDateKey, weekdayNames } from '@/utils/date';
import { ActivitiesSheet } from './components/ActivitiesSheet';
import { ChildAvatar } from './components/ChildAvatar';
import { ChildFormSheet } from './components/ChildFormSheet';
import { EditablePhoto } from './components/EditablePhoto';
import { FamilyChecklist } from './components/FamilyChecklist';
import {
  EmergencyCard,
  FavoritesCard,
  GiftIdeasCard,
  GrowthCard,
  HealthCard,
  KeyAlerts,
  MeasurementSheet,
  ProfileHero,
  SectionCard,
  StatTiles,
} from './components/ProfileSections';
import { useChild, useRemoveChild } from './hooks';
import { photoKey, usePersonPhoto, useSetPersonPhoto } from './personPhotos';
import { familyMeta } from './meta';
import { ageFrom } from './selectors';
import { SIZE_PRESETS, type Member } from './types';

function Row({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  const { spacing } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
      <AppText variant="body" style={{ width: 24 }}>
        {icon}
      </AppText>
      <AppText variant="small" tone="textMuted" style={{ width: 110, paddingTop: 2 }}>
        {label}
      </AppText>
      <AppText variant="body" style={{ flex: 1 }} selectable>
        {value}
      </AppText>
    </View>
  );
}

/** Member profile: everything about one person + their calendar, tasks and shopping. */
export function ChildScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const { spacing } = useTheme();
  const { breakpoint } = useBreakpoint();
  const dialog = useDialog();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const child = useChild(id);
  const removeChild = useRemoveChild();
  const setPhoto = useSetPersonPhoto();
  const syncedPhoto = usePersonPhoto(id ? photoKey.child(id) : null);
  const [editing, setEditing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [activitiesFor, setActivitiesFor] = useState<Member | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/family'));

  if (child.isLoading) return <LoadingState />;
  const c = child.data;
  if (!c) {
    return (
      <Screen>
        <PageHeader title={t('modules.family.title')} onBack={back} />
        <EmptyState icon="user-x" title={t('family.profile.notFound')} actionLabel={t('common.back')} onAction={back} />
      </Screen>
    );
  }

  const days = weekdayNames(locale);
  const subtitle = [
    t(`family.relations.${c.relation}`),
    c.birthDate ? t('family.age', { count: ageFrom(c.birthDate, today) }) : null,
    c.relation === 'child' ? [c.school, c.schoolClass].filter(Boolean).join(' · ') || null : c.occupation,
  ]
    .filter(Boolean)
    .join(' · ');

  const onRemove = async () => {
    const ok = await dialog.confirm({
      title: t('family.removeChildTitle', { name: c.name }),
      message: t('family.removeMemberMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) removeChild.mutate(c.id, { onSuccess: () => router.navigate('/family') });
  };

  const sizeLabel = (key: string) => ((SIZE_PRESETS as readonly string[]).includes(key) ? t(`family.sizes.${key}`) : key);

  const photo = (
    <EditablePhoto size={96} hasPhoto={!!syncedPhoto || !!c.photo} onPick={(source) => void setPhoto(photoKey.child(c.id), source)}>
      <ChildAvatar child={c} size={96} />
    </EditablePhoto>
  );
  const hero = (
    <ProfileHero
      member={c}
      photo={photo}
      actions={
        c.calendarId ? (
          <Button
            label={t('family.profile.openCalendar')}
            icon="calendar"
            size="sm"
            variant="secondary"
            onPress={() => router.navigate('/calendars')}
          />
        ) : null
      }
    />
  );
  const contact =
    c.phone || c.email || c.school || c.occupation || c.birthDate ? (
      <SectionCard
        title={t('family.profile.about')}
        icon="user"
        accent={c.color}
        action={{ label: t('common.edit'), onPress: () => setEditing(true) }}
      >
        <View style={{ gap: spacing.sm }}>
          <Row
            icon="🎂"
            label={t('family.form.birthDate')}
            value={
              c.birthDate ? fromDateKey(c.birthDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null
            }
          />
          <Row icon="📞" label={t('family.form.phone')} value={c.phone} />
          <Row icon="✉️" label={t('family.form.email')} value={c.email} />
          {c.relation === 'child' ? (
            <Row icon="🏫" label={t('family.profile.school')} value={[c.school, c.schoolClass].filter(Boolean).join(' · ')} />
          ) : (
            <Row icon="💼" label={t('family.form.occupation')} value={c.occupation} />
          )}
        </View>
      </SectionCard>
    ) : null;

  const activities = (
    <SectionCard
      title={t('family.activities.title')}
      icon="activity"
      accent={c.color}
      action={{ label: t('common.edit'), onPress: () => setActivitiesFor(c) }}
    >
      {c.activities.length ? (
        <ActivityList member={c} days={days} />
      ) : (
        <EmptyState
          compact
          icon="activity"
          accent={c.color}
          title={t('family.activities.empty')}
          actionLabel={t('family.activities.add')}
          onAction={() => setActivitiesFor(c)}
        />
      )}
    </SectionCard>
  );

  const sizes = (
    <SectionCard
      title={t('family.form.sizes')}
      icon="tag"
      accent={c.color}
      action={{ label: t('common.edit'), onPress: () => setEditing(true) }}
    >
      {c.sizes?.length ? (
        <SizeGrid sizes={c.sizes} label={sizeLabel} />
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('family.profile.noSizes')}
        </AppText>
      )}
    </SectionCard>
  );

  const healthCard = <HealthCard member={c} />;

  const extra =
    c.extraFields?.length || c.notes ? (
      <SectionCard
        title={t('family.form.extra')}
        icon="list"
        accent={c.color}
        action={{ label: t('common.edit'), onPress: () => setEditing(true) }}
      >
        <View style={{ gap: spacing.sm }}>
          {(c.extraFields ?? []).map((f, i) => (
            <Row key={`${f.label}-${i}`} icon="•" label={f.label} value={f.value} />
          ))}
          {c.notes ? (
            <AppText variant="body" selectable>
              {c.notes}
            </AppText>
          ) : null}
        </View>
      </SectionCard>
    ) : null;

  const related = (
    <RelatedPanel
      target={{ module: familyMeta.id, type: 'child', id: c.id }}
      accent={c.color}
      context={{ calendarId: c.calendarId, personName: c.name }}
    />
  );
  const tomorrow = <FamilyChecklist list="tomorrow" childId={c.id} />;
  const wide = breakpoint === 'expanded' || breakpoint === 'wide';

  return (
    <Screen>
      <PageHeader
        title={c.name}
        subtitle={subtitle || undefined}
        icon="user"
        accent={c.color}
        onBack={back}
        actions={
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button label={t('common.edit')} icon="edit-2" variant="secondary" size="sm" onPress={() => setEditing(true)} />
            <IconButton icon="trash-2" label={t('family.profile.delete')} onPress={() => void onRemove()} />
          </View>
        }
      />
      {wide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: spacing.xl, minWidth: 0 }}>
            {hero}
            <KeyAlerts member={c} />
            <StatTiles member={c} onMeasure={() => setMeasuring(true)} />
            {healthCard}
            <FavoritesCard member={c} />
            {activities}
            {sizes}
            {extra}
          </View>
          <View style={{ width: 380, gap: spacing.xl }}>
            <GrowthCard member={c} onAdd={() => setMeasuring(true)} />
            <EmergencyCard member={c} />
            <GiftIdeasCard member={c} />
            {contact}
            {related}
            {tomorrow}
          </View>
        </View>
      ) : (
        <>
          {hero}
          <KeyAlerts member={c} />
          <StatTiles member={c} onMeasure={() => setMeasuring(true)} />
          {healthCard}
          <FavoritesCard member={c} />
          <GrowthCard member={c} onAdd={() => setMeasuring(true)} />
          {activities}
          <EmergencyCard member={c} />
          <GiftIdeasCard member={c} />
          {contact}
          {related}
          {tomorrow}
          {sizes}
          {extra}
        </>
      )}
      <MeasurementSheet member={c} visible={measuring} onClose={() => setMeasuring(false)} />
      <ChildFormSheet visible={editing} child={c} onClose={() => setEditing(false)} />
      <ActivitiesSheet member={activitiesFor} onClose={() => setActivitiesFor(null)} />
    </Screen>
  );
}

/** Rendered inside the card (normal palette). */
function ActivityList({ member, days }: { member: Member; days: string[] }) {
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {member.activities.map((a) => (
        <View
          key={a.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: withAlpha(member.color, 0.12),
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{a.name}</AppText>
            <AppText variant="small" tone="textMuted">
              {[
                a.weekdays.length ? a.weekdays.map((d) => days[d]).join(', ') : t('family.activities.noSchedule'),
                a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ''}` : null,
                a.place,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          {a.eventId ? <Badge label={t('family.activities.inCalendar')} icon="calendar" tone="info" /> : null}
        </View>
      ))}
    </View>
  );
}

function SizeGrid({ sizes, label }: { sizes: { key: string; value: string }[]; label: (k: string) => string }) {
  const { spacing, radius, colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {sizes.map((s) => (
        <View
          key={s.key}
          style={{ minWidth: 110, flexGrow: 1, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
        >
          <AppText variant="caption" tone="textMuted">
            {label(s.key)}
          </AppText>
          <AppText variant="heading">{s.value}</AppText>
        </View>
      ))}
    </View>
  );
}
