import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { DateField, TimeField } from '@/components/forms/DateTimeFields';
import { RecurrenceEditor } from '@/components/forms/RecurrenceEditor';
import { LinkChips } from '@/components/links/LinkChips';
import { LinkPickerSheet } from '@/components/links/LinkPickerSheet';
import { useLinkSources } from '@/components/links/useLinks';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { useLocale } from '@/hooks/useLocale';
import { useAppPreferences } from '@/state/appPreferences';
import { useTheme } from '@/theme';
import type { EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import { withAlpha } from '@/utils/color';
import { addDays, combine, fromDateKey, timeOf, toDateKey, weekdayNames, type DateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import { describeReminder, REMINDER_PRESETS } from '@/utils/recurrenceText';
import { useCreateEvent, useUpdateEvent } from '../hooks';
import { calendarsMeta } from '../meta';
import { eventLinks } from '../service';
import { DEFAULT_SHIFT_HOURS, detectShift, endOfMonth, SHIFT_IDS, shiftEndDate, type ShiftId } from '../shifts';
import type { Calendar, CalendarEvent } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  calendars: Calendar[];
  /** Edit mode when provided (edits the whole series). */
  event?: CalendarEvent | null;
  /** New event defaults. */
  date: DateKey;
  time?: string | null;
  /** New event pre-linked to these entities (e.g. created from a child's profile). */
  initialLinks?: EntityRef[];
  /** New event in this calendar (e.g. the family member's own calendar). */
  initialCalendarId?: string | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="overline" tone="textMuted">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function initialState(event: CalendarEvent | null | undefined, date: DateKey, time: string | null | undefined) {
  if (event) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return {
      startDate: toDateKey(start),
      startTime: timeOf(start),
      endDate: toDateKey(event.allDay ? addDays(end, -1) : end),
      endTime: timeOf(end),
    };
  }
  const start = combine(date, time ?? '09:00');
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { startDate: date, startTime: timeOf(start), endDate: toDateKey(end), endTime: timeOf(end) };
}

function EventForm({ onClose, calendars, event, date, time, initialLinks, initialCalendarId }: Props) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const linkSources = useLinkSources(calendarsMeta.id);
  const init = initialState(event, date, time);
  const locale = useLocale();
  const dayNames = useMemo(() => weekdayNames(locale), [locale]);
  const savedShiftHours = useAppPreferences((s) => s.shiftHours);
  const setShiftHours = useAppPreferences((s) => s.setShiftHours);
  const shiftHours = useMemo(() => ({ ...DEFAULT_SHIFT_HOURS, ...savedShiftHours }), [savedShiftHours]);

  const [title, setTitle] = useState(event?.title ?? '');
  const [calendarId, setCalendarId] = useState<string | null>(
    event?.calendarId ??
      (initialCalendarId && calendars.some((c) => c.id === initialCalendarId) ? initialCalendarId : null) ??
      calendars[0]?.id ??
      null,
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(init.startDate);
  const [startTime, setStartTime] = useState(init.startTime);
  const [endDate, setEndDate] = useState(init.endDate);
  const [endTime, setEndTime] = useState(init.endTime);
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(event?.recurrence ?? null);
  const [reminders, setReminders] = useState<number[]>(event?.reminders ?? []);
  const [location, setLocation] = useState(event?.location ?? '');
  const [participants, setParticipants] = useState<string[]>(event?.participants ?? []);
  const [participantText, setParticipantText] = useState('');
  const [description, setDescription] = useState(event?.description ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [links, setLinks] = useState<EntityRef[]>(event ? eventLinks(event) : (initialLinks ?? []));
  const [linking, setLinking] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [shift, setShift] = useState<ShiftId | null>(() =>
    event && !event.allDay ? detectShift(init.startTime, init.endTime, shiftHours) : null,
  );
  // Remounts the advanced recurrence editor when the quick weekday picker changes the rule.
  const [recurrenceKey, setRecurrenceKey] = useState(0);

  const chooseShift = (id: ShiftId) => {
    if (shift === id) {
      setShift(null);
      return;
    }
    const hours = shiftHours[id];
    setShift(id);
    setAllDay(false);
    setStartTime(hours.start);
    setEndTime(hours.end);
    setEndDate(shiftEndDate(startDate, hours));
  };

  // "Repeat on these days": a weekly rule on the chosen weekdays, until the end of the month by default.
  const quickDays =
    recurrence?.freq === 'weekly' && recurrence.interval === 1 ? (recurrence.byWeekday ?? [mondayIndex(fromDateKey(startDate))]) : [];
  const toggleQuickDay = (d: number) => {
    const next = quickDays.includes(d) ? quickDays.filter((x) => x !== d) : [...quickDays, d].sort((a, b) => a - b);
    setRecurrence(
      next.length ? { freq: 'weekly', interval: 1, byWeekday: next, until: recurrence?.until ?? endOfMonth(startDate), count: null } : null,
    );
    setRecurrenceKey((k) => k + 1);
  };
  const setQuickUntil = (until: DateKey | null) => {
    if (recurrence) setRecurrence({ ...recurrence, until, count: null });
    setRecurrenceKey((k) => k + 1);
  };
  const shiftTitle = shift ? t('calendars.shifts.title', { shift: t(`calendars.shifts.names.${shift}`).toLowerCase() }) : '';

  const setValidity = (field: string) => (ok: boolean) =>
    setInvalid((prev) => {
      const next = new Set(prev);
      if (ok) next.delete(field);
      else next.add(field);
      return next;
    });

  // Keep the end after the start when the start moves.
  const onStartChange = (nextDate: DateKey, nextTime: string) => {
    const start = combine(nextDate, nextTime);
    const end = combine(endDate < nextDate ? nextDate : endDate, endTime);
    if (end <= start) {
      const shifted = new Date(start.getTime() + 60 * 60 * 1000);
      setEndDate(toDateKey(shifted));
      setEndTime(timeOf(shifted));
    } else if (endDate < nextDate) setEndDate(nextDate);
  };

  const addParticipant = () => {
    const names = participantText
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!names.length) return;
    setParticipants((prev) => [...new Set([...prev, ...names])]);
    setParticipantText('');
  };

  const relevantInvalid = [...invalid].filter((f) => !allDay || !f.endsWith('Time'));
  const canSave = !!(title.trim() || shift) && !!calendarId && relevantInvalid.length === 0;

  const save = () => {
    if (!canSave || !calendarId) return;
    // Adjusted shift hours become the new default for that shift.
    if (shift && !allDay && (shiftHours[shift].start !== startTime || shiftHours[shift].end !== endTime))
      setShiftHours(shift, { start: startTime, end: endTime });
    const input = {
      calendarId,
      title: title.trim() || shiftTitle,
      allDay,
      startDate,
      startTime,
      endDate,
      endTime,
      location,
      description,
      notes,
      participants,
      reminders,
      recurrence,
      links,
    };
    if (event) update.mutate({ id: event.id, input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={event ? t('calendars.editEvent') : t('calendars.newEvent')}
      subtitle={event?.recurrence ? t('calendars.editSeriesHint') : undefined}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <TextField
        label={t('calendars.form.title')}
        placeholder={shiftTitle || t('calendars.form.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        autoFocus={!event}
      />
      <TextField
        label={t('calendars.form.description')}
        placeholder={t('calendars.form.descriptionPlaceholder')}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Section title={t('calendars.form.calendar')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
          {calendars.map((c) => {
            const active = c.id === calendarId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCalendarId(c.id)}
                accessibilityRole="radio"
                aria-checked={active}
                accessibilityLabel={c.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  minHeight: 34,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? c.color : colors.border,
                  backgroundColor: active ? withAlpha(c.color, 0.12) : 'transparent',
                }}
              >
                {c.icon ? (
                  <Icon name={c.icon as never} size={13} color={c.color} />
                ) : (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                )}
                <AppText variant="smallStrong" color={active ? c.color : colors.textMuted}>
                  {c.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={t('calendars.form.when')}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="smallStrong">{t('calendars.shifts.label')}</AppText>
          <ChipGroup<ShiftId>
            accessibilityLabel={t('calendars.shifts.label')}
            selected={shift ?? ('' as ShiftId)}
            onToggle={chooseShift}
            options={SHIFT_IDS.map((id) => ({
              value: id,
              label: `${t(`calendars.shifts.names.${id}`)} · ${shiftHours[id].start}–${shiftHours[id].end}`,
            }))}
          />
          {shift ? (
            <AppText variant="caption" tone="textSubtle">
              {t('calendars.shifts.hint')}
            </AppText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="bodyStrong">{t('calendars.allDay')}</AppText>
          <Toggle value={allDay} onValueChange={setAllDay} label={t('calendars.allDay')} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <View style={{ flexGrow: 2, flexBasis: 200 }}>
            <DateField
              label={t('calendars.form.startDate')}
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                if (shift) setEndDate(shiftEndDate(d, { start: startTime, end: endTime }));
                else onStartChange(d, startTime);
              }}
              onValidityChange={setValidity('startDate')}
            />
          </View>
          {allDay ? null : (
            <View style={{ flexGrow: 1, flexBasis: 110 }}>
              <TimeField
                label={t('calendars.form.start')}
                value={startTime}
                onChange={(tm) => {
                  setStartTime(tm);
                  if (shift) setEndDate(shiftEndDate(startDate, { start: tm, end: endTime }));
                  else onStartChange(startDate, tm);
                }}
                onValidityChange={setValidity('startTime')}
              />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <View style={{ flexGrow: 2, flexBasis: 200 }}>
            <DateField
              label={t('calendars.form.endDate')}
              value={endDate}
              onChange={setEndDate}
              onValidityChange={setValidity('endDate')}
            />
          </View>
          {allDay ? null : (
            <View style={{ flexGrow: 1, flexBasis: 110 }}>
              <TimeField
                label={t('calendars.form.end')}
                value={endTime}
                onChange={(tm) => {
                  setEndTime(tm);
                  if (shift) setEndDate(shiftEndDate(startDate, { start: startTime, end: tm }));
                }}
                onValidityChange={setValidity('endTime')}
              />
            </View>
          )}
        </View>
      </Section>

      <Section title={t('calendars.repeatDays.label')}>
        <ChipGroup<number>
          multi
          compact
          accessibilityLabel={t('calendars.repeatDays.label')}
          selected={quickDays}
          onToggle={toggleQuickDay}
          options={dayNames.map((label, i) => ({ value: i, label }))}
        />
        {quickDays.length ? (
          <View style={{ gap: spacing.sm }}>
            <ChipGroup<'month' | 'never' | 'date'>
              compact
              accessibilityLabel={t('calendars.repeatDays.until')}
              selected={!recurrence?.until ? 'never' : recurrence.until === endOfMonth(startDate) ? 'month' : 'date'}
              onToggle={(v) =>
                setQuickUntil(
                  v === 'never'
                    ? null
                    : v === 'month'
                      ? endOfMonth(startDate)
                      : (recurrence?.until ?? toDateKey(addDays(fromDateKey(endOfMonth(startDate)), 1))),
                )
              }
              options={[
                { value: 'month', label: t('calendars.repeatDays.endOfMonth') },
                { value: 'date', label: t('calendars.repeatDays.untilDate') },
                { value: 'never', label: t('calendars.repeatDays.never') },
              ]}
            />
            {recurrence?.until && recurrence.until !== endOfMonth(startDate) ? (
              <DateField label={t('calendars.repeatDays.until')} value={recurrence.until} onChange={(d) => setQuickUntil(d)} />
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" tone="textSubtle">
            {t('calendars.repeatDays.hint')}
          </AppText>
        )}
      </Section>

      <Section title={t('recurrence.label')}>
        <RecurrenceEditor key={recurrenceKey} value={recurrence} onChange={setRecurrence} startDate={startDate} />
      </Section>

      <Section title={t('reminders.label')}>
        <ChipGroup<number>
          multi
          accessibilityLabel={t('reminders.label')}
          selected={reminders}
          onToggle={(m) => setReminders((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
          options={REMINDER_PRESETS.map((m) => ({ value: m, label: describeReminder(m, t) }))}
        />
        <AppText variant="caption" tone="textSubtle">
          {t('reminders.deliveryNote')}
        </AppText>
      </Section>

      <Section title={t('calendars.form.details')}>
        <TextField
          label={t('calendars.form.location')}
          placeholder={t('common.optional')}
          value={location}
          onChangeText={setLocation}
          leftIcon="map-pin"
        />
        <TextField
          label={t('calendars.form.participants')}
          placeholder={t('calendars.form.participantsPlaceholder')}
          value={participantText}
          onChangeText={setParticipantText}
          onSubmitEditing={addParticipant}
          onBlur={addParticipant}
          leftIcon="user-plus"
          returnKeyType="done"
          submitBehavior="submit"
        />
        {participants.length ? (
          <ChipGroup<string>
            multi
            accessibilityLabel={t('calendars.form.participants')}
            selected={participants}
            onToggle={(p) => setParticipants((prev) => prev.filter((x) => x !== p))}
            options={participants.map((p) => ({ value: p, label: `${p}  ×` }))}
          />
        ) : null}
        <TextField
          label={t('calendars.form.notes')}
          placeholder={t('calendars.form.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          leftIcon="edit-3"
          multiline
        />
      </Section>

      {linkSources.length ? (
        <Section title={t('links.sectionTitle')}>
          <LinkChips
            refs={links}
            onRemove={(ref) => setLinks((prev) => prev.filter((r) => !(r.module === ref.module && r.id === ref.id)))}
          />
          <Button label={t('links.add')} icon="paperclip" variant="secondary" size="sm" onPress={() => setLinking(true)} />
        </Section>
      ) : null}

      <LinkPickerSheet
        visible={linking}
        onClose={() => setLinking(false)}
        ownerModuleId={calendarsMeta.id}
        value={links}
        onChange={setLinks}
      />
    </Sheet>
  );
}

/** Mounted only while open so every opening starts from fresh state. */
export function EventFormSheet(props: Props) {
  return props.visible ? <EventForm {...props} /> : null;
}
