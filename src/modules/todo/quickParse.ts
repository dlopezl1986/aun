import { normalizeSearch } from '@/types/search';
import { addDays, fromDateKey, parseDateInput, toDateKey, type DateKey } from '@/utils/date';
import { mondayIndex } from '@/utils/recurrence';
import type { Project, TaskPriority } from './types';

/**
 * Smart quick capture (section 28): "Comprar pañales mañana p1 #casa @hogar"
 *  - p1…p4 → priority
 *  - #etiqueta → tag (created if new)
 *  - @proyecto → project (by name, accents/case-insensitive, spaces ignored)
 *  - hoy / mañana / pasado mañana / weekday / dd/mm(/aaaa) → due date
 * Spanish and English keywords. Pure function (unit tested).
 */
export interface ParsedTask {
  title: string;
  priority?: TaskPriority;
  dueDate?: DateKey;
  tagNames: string[];
  projectId?: string;
}

const WEEKDAYS: Record<string, number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  domingo: 6,
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function parseQuickTask(input: string, ctx: { today: DateKey; projects: Pick<Project, 'id' | 'name'>[] }): ParsedTask {
  const today = fromDateKey(ctx.today);
  const result: ParsedTask = { title: '', tagNames: [] };
  let text = ` ${input} `;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    text = text.replace(re, (...args) => (fn(args as unknown as RegExpMatchArray) ? ' ' : args[0]));
  };

  take(/\s[pP]([1-4])(?=\s)/g, (m) => {
    result.priority = Number(m[1]) as TaskPriority;
    return true;
  });
  take(/\s#([\p{L}\p{N}_-]+)(?=\s)/gu, (m) => {
    if (!result.tagNames.includes(m[1])) result.tagNames.push(m[1]);
    return true;
  });
  take(/\s@([\p{L}\p{N}_-]+)(?=\s)/gu, (m) => {
    const q = normalizeSearch(m[1]);
    const project = ctx.projects.find((p) => normalizeSearch(p.name).replace(/\s+/g, '').startsWith(q));
    if (!project) return false;
    result.projectId = project.id;
    return true;
  });

  const setDate = (d: Date) => {
    result.dueDate = toDateKey(d);
    return true;
  };
  // Order matters: "pasado mañana" before "mañana".
  take(/\s(pasado\s+mañana|pasado\s+manana|day\s+after\s+tomorrow)(?=\s)/giu, () => setDate(addDays(today, 2)));
  take(/\s(hoy|today)(?=\s)/giu, () => setDate(today));
  take(/\s(mañana|manana|tomorrow)(?=\s)/giu, () => setDate(addDays(today, 1)));
  take(/\s(\p{L}+)(?=\s)/gu, (m) => {
    if (result.dueDate) return false;
    const wd = WEEKDAYS[normalizeSearch(m[1])];
    if (wd === undefined) return false;
    return setDate(addDays(today, (wd - mondayIndex(today) + 7) % 7));
  });
  take(/\s(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?(?=\s)/g, (m) => {
    if (result.dueDate) return false;
    let year = m[3] ? Number(m[3]) : today.getFullYear();
    let key = parseDateInput(`${m[1]}/${m[2]}/${year}`);
    // "dd/mm" already past this year → next year.
    if (key && !m[3] && key < ctx.today) key = parseDateInput(`${m[1]}/${m[2]}/${(year += 1)}`);
    if (!key) return false;
    result.dueDate = key;
    return true;
  });

  result.title = text.replace(/\s+/g, ' ').trim();
  return result;
}
