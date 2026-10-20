import type { Repository } from '@/storage/repository';
import {
  DEFAULT_SHIFT_COLORS,
  DEFAULT_SHIFT_COUNTED_HOURS,
  DEFAULT_SHIFT_HOURS,
  SHIFT_IDS,
  shiftDuration,
  type ShiftHours,
  type ShiftId,
} from './shifts';
import type { ShiftType } from './types';

export type ShiftTypeInput = Pick<ShiftType, 'name' | 'color' | 'allDay' | 'start' | 'end' | 'hours'>;

/** Colour of the "Libre" (day off) label. */
export const DAY_OFF_COLOR = '#10B981';

/** The user's shift labels for shift mode (Mañana, Tarde, Noche, Libre… or their own). */
export class ShiftTypeService {
  constructor(private readonly repo: Repository<ShiftType>) {}

  async list(): Promise<ShiftType[]> {
    return (await this.repo.list()).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * First time in shift mode: start from the usual shifts (with the hours and
   * colours already used in the event form) and a day off.
   */
  async ensureDefaults(
    names: Record<ShiftId | 'off', string>,
    saved: { hours?: Partial<Record<ShiftId, ShiftHours>>; colors?: Partial<Record<ShiftId, string>> } = {},
  ): Promise<ShiftType[]> {
    const current = await this.list();
    if (current.length) {
      // Labels made before shifts counted hours: the usual ones get their usual hours, the rest their duration.
      const missing = current.filter((s) => typeof s.hours !== 'number');
      for (const s of missing) {
        const usual = SHIFT_IDS.find((id) => names[id] === s.name);
        const hours = s.allDay || s.name === names.off ? 0 : usual ? DEFAULT_SHIFT_COUNTED_HOURS[usual] : shiftDuration(s);
        await this.repo.update(s.id, { hours });
      }
      return missing.length ? this.list() : current;
    }
    let order = 0;
    for (const id of SHIFT_IDS) {
      const hours = { ...DEFAULT_SHIFT_HOURS[id], ...saved.hours?.[id] };
      await this.repo.create({
        name: names[id],
        color: saved.colors?.[id] ?? DEFAULT_SHIFT_COLORS[id],
        allDay: false,
        ...hours,
        hours: DEFAULT_SHIFT_COUNTED_HOURS[id],
        order: order++,
      });
    }
    await this.repo.create({ name: names.off, color: DAY_OFF_COLOR, allDay: true, start: '00:00', end: '00:00', hours: 0, order: order++ });
    return this.list();
  }

  async create(input: ShiftTypeInput): Promise<ShiftType> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    const order = (await this.repo.list()).reduce((max, s) => Math.max(max, s.order + 1), 0);
    return this.repo.create({ ...input, name, order });
  }

  async update(id: string, input: ShiftTypeInput): Promise<ShiftType> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    return this.repo.update(id, { ...input, name });
  }

  /** Removes the label; shifts already on the calendar stay as normal events. */
  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
