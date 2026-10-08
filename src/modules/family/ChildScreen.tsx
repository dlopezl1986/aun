import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { RelatedPanel } from '@/components/links/RelatedPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import type { IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatLongDate, fromDateKey, weekdayNames } from '@/utils/date';
import { ActivitiesSheet } from './components/ActivitiesSheet';
import { ChildAvatar } from './components/ChildAvatar';
import { ChildFormSheet } from './components/ChildFormSheet';
import { FamilyChecklist } from './components/FamilyChecklist';
import { useChild, useRemoveChild } from './hooks';
import { familyMeta } from './meta';
import { ageFrom, nextBirthday } from './selectors';
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

function SectionCard({
  title,
  icon,
  accent,
  action,
  children,
}: {
  title: string;
  icon: IconName;
  accent: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} accent={accent} actionLabel={action?.label} onAction={action?.onPress} />
      {children}
    </Card>
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
  const [editing, setEditing] = useState(false);
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
  const birthday = nextBirthday(c, today);
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
  const health = c.health;

  const info = (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <ChildAvatar child={c} size={84} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          {birthday ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
              <Badge
                icon="gift"
                tone={birthday.daysUntil <= 7 ? 'warning' : 'neutral'}
                label={birthday.daysUntil === 0 ? t('family.birthdays.today') : t('family.birthdays.inDays', { count: birthday.daysUntil })}
              />
              <AppText variant="small" tone="textMuted">
                {t('family.birthdays.turns', { count: birthday.turns })} · {formatLongDate(birthday.date, locale)}
              </AppText>
            </View>
          ) : (
            <AppText variant="small" tone="textMuted">
              {t('family.noBirthDate')}
            </AppText>
          )}
          {c.calendarId ? (
            <Button
              label={t('family.profile.openCalendar')}
              icon="calendar"
              size="sm"
              variant="secondary"
              onPress={() => router.navigate('/calendars')}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </View>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
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
      {c.importantInfo ? (
        <View style={{ marginTop: spacing.md }}>
          <InfoNote tone="warning" icon="alert-triangle" title={t('family.form.importantInfo')} description={c.importantInfo} />
        </View>
      ) : null}
    </Card>
  );

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

  const healthCard =
    health && Object.values(health).some(Boolean) ? (
      <SectionCard
        title={t('family.form.health')}
        icon="heart"
        accent="#E11D48"
        action={{ label: t('common.edit'), onPress: () => setEditing(true) }}
      >
        <View style={{ gap: spacing.sm }}>
          {health.allergies ? (
            <InfoNote tone="warning" icon="alert-triangle" title={t('family.form.allergies')} description={health.allergies} />
          ) : null}
          <Row icon="🩸" label={t('family.form.bloodType')} value={health.bloodType} />
          <Row icon="🩺" label={c.relation === 'child' ? t('family.form.pediatrician') : t('family.form.doctor')} value={health.doctor} />
          <Row icon="💊" label={t('family.form.medication')} value={health.medication} />
          <Row icon="📝" label={t('family.form.healthNotes')} value={health.notes} />
        </View>
      </SectionCard>
    ) : null;

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
    <RelatedPanel target={{ module: familyMeta.id, type: 'child', id: c.id }} accent={c.color} context={{ calendarId: c.calendarId }} />
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
            {info}
            {activities}
            {sizes}
            {healthCard}
            {extra}
          </View>
          <View style={{ width: 380, gap: spacing.xl }}>
            {related}
            {tomorrow}
          </View>
        </View>
      ) : (
        <>
          {info}
          {activities}
          {related}
          {tomorrow}
          {sizes}
          {healthCard}
          {extra}
        </>
      )}
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
