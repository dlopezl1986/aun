import type { AlertItem, AlertSource } from '@/types/module';
import { addDays, combine, startOfDay, toDateKey } from '@/utils/date';
import { familyMeta } from './meta';
import { nextBirthday } from './selectors';

/** Evening "Para mañana" checklist reminder (only when there is something to prepare). */
export const tomorrowAlertSource: AlertSource = {
  id: 'family.tomorrow',
  labelKey: 'notifications.sources.tomorrow',
  descriptionKey: 'notifications.sources.tomorrowHint',
  icon: 'briefcase',
  async list(services, ctx) {
    const items = await services.family.listItems('tomorrow', toDateKey(ctx.from));
    const children = new Map((await services.family.listChildren()).map((c) => [c.id, c.name]));
    const today = toDateKey(new Date());
    const out: AlertItem[] = [];
    for (let d = startOfDay(ctx.from); d <= ctx.to; d = addDays(d, 1)) {
      const at = combine(toDateKey(d), ctx.tomorrowTime);
      if (at < ctx.from || at > ctx.to) continue;
      // Future evenings: routines will be pending again, one-offs stay as they are.
      const pending = items.filter((i) => !i.done || (toDateKey(d) > today && i.routine));
      if (!pending.length) continue;
      const names = pending.slice(0, 3).map((i) => (i.childId ? `${i.title} (${children.get(i.childId) ?? ''})` : i.title));
      out.push({
        key: `family:tomorrow:${toDateKey(d)}`,
        moduleId: familyMeta.id,
        sourceId: 'family.tomorrow',
        title: ctx.t('notifications.alerts.tomorrowTitle'),
        body: names.join(', ') + (pending.length > 3 ? ` ${ctx.t('notifications.alerts.andMore', { count: pending.length - 3 })}` : ''),
        at: at.toISOString(),
        route: '/family',
        icon: 'briefcase',
      });
    }
    return out;
  },
};

/** Children's birthdays: the evening before and the morning of the day. */
export const birthdayAlertSource: AlertSource = {
  id: 'family.birthdays',
  labelKey: 'notifications.sources.birthdays',
  descriptionKey: 'notifications.sources.birthdaysHint',
  icon: 'gift',
  async list(services, ctx) {
    const out: AlertItem[] = [];
    for (const child of await services.family.listChildren()) {
      const next = nextBirthday(child, toDateKey(addDays(ctx.from, -1)));
      if (!next) continue;
      const day = toDateKey(next.date);
      const candidates = [
        {
          at: combine(toDateKey(addDays(next.date, -1)), ctx.tomorrowTime),
          title: ctx.t('notifications.alerts.birthdayTomorrow', { name: child.name }),
          kind: 'eve',
        },
        {
          at: combine(day, '09:00'),
          title: ctx.t('notifications.alerts.birthdayToday', { name: child.name, count: next.turns }),
          kind: 'day',
        },
      ];
      for (const c of candidates) {
        if (c.at < ctx.from || c.at > ctx.to) continue;
        out.push({
          key: `family:birthday:${child.id}:${day}:${c.kind}`,
          moduleId: familyMeta.id,
          sourceId: 'family.birthdays',
          title: c.title,
          at: c.at.toISOString(),
          route: `/family/child/${child.id}`,
          icon: 'gift',
          color: child.color,
        });
      }
    }
    return out;
  },
};
