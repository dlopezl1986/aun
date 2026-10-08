import type { TFunction } from 'i18next';

import type { RecurrenceRule } from '@/types/recurrence';
import { formatShortDate, fromDateKey, weekdayNames } from './date';

/** Human summary: "Cada 2 semanas: lun, mié · hasta 20 dic". */
export function describeRecurrence(rule: RecurrenceRule | null | undefined, t: TFunction, locale: string): string {
  if (!rule) return t('recurrence.presets.none');
  const parts: string[] = [];
  parts.push(rule.interval > 1 ? t(`recurrence.everyN.${rule.freq}`, { count: rule.interval }) : t(`recurrence.presets.${rule.freq}`));
  if (rule.freq === 'weekly' && rule.byWeekday?.length) {
    const names = weekdayNames(locale);
    parts[0] += `: ${rule.byWeekday.map((d) => names[d]).join(', ')}`;
  }
  if (rule.until) parts.push(t('recurrence.untilShort', { date: formatShortDate(fromDateKey(rule.until.slice(0, 10)), locale) }));
  if (rule.count) parts.push(t('recurrence.countShort', { count: rule.count }));
  return parts.join(' · ');
}

/** "15 min antes", "1 día antes", "Al empezar". */
export function describeReminder(minutes: number, t: TFunction): string {
  if (minutes === 0) return t('reminders.atStart');
  if (minutes % 1440 === 0) return t('reminders.daysBefore', { count: minutes / 1440 });
  if (minutes % 60 === 0) return t('reminders.hoursBefore', { count: minutes / 60 });
  return t('reminders.minutesBefore', { count: minutes });
}

export const REMINDER_PRESETS = [0, 5, 15, 30, 60, 1440];
