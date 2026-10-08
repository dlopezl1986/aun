import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Divider } from '@/components/ui/Divider';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/theme';
import { useDeleteCalendar, useSetCalendarVisible, useShowAllCalendars, useUpdateCalendar } from '../hooks';
import { calendarsMeta } from '../meta';
import type { Calendar } from '../types';

interface Props {
  /** All calendars (active and archived). */
  calendars: Calendar[];
  onEdit: (c: Calendar) => void;
  onCreate: () => void;
}

/** Explains the sharing model and what is still missing (honest, no fake invites). */
function ShareSheet({ calendar, onClose }: { calendar: Calendar | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!calendar) return null;
  return (
    <Sheet visible onClose={onClose} title={t('calendars.share.title', { name: calendar.name })}>
      <ListRow
        icon="shield"
        accent={calendarsMeta.accent}
        title={t('calendars.share.roles.admin')}
        subtitle={t('calendars.share.roles.adminHint')}
      />
      <ListRow
        icon="edit-3"
        accent={calendarsMeta.accent}
        title={t('calendars.share.roles.editor')}
        subtitle={t('calendars.share.roles.editorHint')}
      />
      <ListRow
        icon="eye"
        accent={calendarsMeta.accent}
        title={t('calendars.share.roles.viewer')}
        subtitle={t('calendars.share.roles.viewerHint')}
      />
      <InfoNote title={t('calendars.share.pendingTitle')} description={t('calendars.share.pending')} icon="cloud" tone="warning" />
    </Sheet>
  );
}

/** Visibility filter ("Mostrar todos") + management of the user's calendars (section 10). */
export function CalendarList({ calendars, onEdit, onCreate }: Props) {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const dialog = useDialog();
  const setVisible = useSetCalendarVisible();
  const showAll = useShowAllCalendars();
  const del = useDeleteCalendar();
  const update = useUpdateCalendar();
  const [sharing, setSharing] = useState<Calendar | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = calendars.filter((c) => c.isActive);
  const archived = calendars.filter((c) => !c.isActive);
  const anyHidden = active.some((c) => !c.isVisible);

  const onDelete = async (c: Calendar) => {
    const ok = await dialog.confirm({
      title: t('calendars.deleteTitle', { name: c.name }),
      message: t('calendars.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) del.mutate(c.id);
  };

  return (
    <Card>
      <CardHeader
        title={t('calendars.myCalendars')}
        icon="layers"
        accent={calendarsMeta.accent}
        actionLabel={anyHidden ? t('calendars.showAll') : undefined}
        onAction={anyHidden ? () => showAll.mutate(undefined) : undefined}
        right={<IconButton icon="plus" label={t('calendars.newCalendar')} onPress={onCreate} />}
      />
      <View style={{ gap: spacing.xxs }}>
        {active.map((c) => (
          <Checkbox
            key={c.id}
            checked={c.isVisible}
            onChange={(visible) => setVisible.mutate({ id: c.id, visible })}
            label={c.name}
            description={c.description ?? undefined}
            color={c.color}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {c.icon ? <Icon name={c.icon as IconName} size={14} color={c.color} /> : null}
                <IconButton icon="share-2" size={15} label={`${t('calendars.share.action')}: ${c.name}`} onPress={() => setSharing(c)} />
                <IconButton icon="edit-2" size={15} label={`${t('common.edit')}: ${c.name}`} onPress={() => onEdit(c)} />
              </View>
            }
          />
        ))}
      </View>
      {archived.length ? (
        <View style={{ marginTop: spacing.sm }}>
          <Divider vertical={spacing.xs} />
          <Button
            label={t('calendars.archived', { count: archived.length })}
            variant="ghost"
            size="sm"
            icon={showArchived ? 'chevron-up' : 'chevron-down'}
            onPress={() => setShowArchived((v) => !v)}
          />
          {showArchived
            ? archived.map((c) => (
                <View
                  key={c.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingLeft: spacing.sm }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color, opacity: 0.6 }} />
                  <AppText variant="body" tone="textMuted" style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </AppText>
                  <IconButton
                    icon="rotate-ccw"
                    size={15}
                    color={colors.primary}
                    label={`${t('calendars.restore')}: ${c.name}`}
                    onPress={() => update.mutate({ id: c.id, patch: { isActive: true } })}
                  />
                  <IconButton icon="trash-2" size={15} label={`${t('common.delete')}: ${c.name}`} onPress={() => void onDelete(c)} />
                </View>
              ))
            : null}
        </View>
      ) : null}
      <ShareSheet calendar={sharing} onClose={() => setSharing(null)} />
    </Card>
  );
}
