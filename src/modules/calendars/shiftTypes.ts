import type { Repository } from '@/storage/repository';
import {
  DEFAULT_SHIFT_COLORS,
  DEFAULT_SHIFT_COUNTED_HOURS,
  DEFAULT_SHIFT_HOURS,
  LEGACY_SHIFT_COUNTED_HOURS,
  SHIFT_HOURS_REV,
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
   * Brings labels up to date with the counted-hours defaults (once each):
   * labels made before hours existed get them (usual ones their usual hours,
   * the rest their length), and usual ones still on the first defaults are
   * corrected. Returns the corrections, so shifts already painted with the
   * old hours can be corrected too.
   */
  async fixHours(names: Record<ShiftId | 'off', string>): Promise<{ typeId: string; from: number; to: number }[]> {
    const corrections: { typeId: string; from: number; to: number }[] = [];
    for (const s of await this.list()) {
      if ((s.hoursRev ?? 0) >= SHIFT_HOURS_REV) continue;
      const usual = SHIFT_IDS.find((id) => names[id] === s.name);
      let hours = s.hours;
      if (typeof hours !== 'number')
        hours = s.allDay || s.name === names.off ? 0 : usual ? DEFAULT_SHIFT_COUNTED_HOURS[usual] : shiftDuration(s);
      else if (usual && hours === LEGACY_SHIFT_COUNTED_HOURS[usual] && hours !== DEFAULT_SHIFT_COUNTED_HOURS[usual]) {
        corrections.push({ typeId: s.id, from: hours, to: DEFAULT_SHIFT_COUNTED_HOURS[usual] });
        hours = DEFAULT_SHIFT_COUNTED_HOURS[usual];
      }
      await this.repo.update(s.id, { hours, hoursRev: SHIFT_HOURS_REV });
    }
    return corrections;
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
      await this.fixHours(names);
      return this.list();
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
        hoursRev: SHIFT_HOURS_REV,
        order: order++,
      });
    }
    await this.repo.create({
      name: names.off,
      color: DAY_OFF_COLOR,
      allDay: true,
      start: '00:00',
      end: '00:00',
      hours: 0,
      hoursRev: SHIFT_HOURS_REV,
      order: order++,
    });
    return this.list();
  }

  async create(input: ShiftTypeInput): Promise<ShiftType> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    const order = (await this.repo.list()).reduce((max, s) => Math.max(max, s.order + 1), 0);
    return this.repo.create({ ...input, name, order, hoursRev: SHIFT_HOURS_REV });
  }

  async update(id: string, input: ShiftTypeInput): Promise<ShiftType> {
    const name = input.name.trim();
    if (!name) throw new Error('Name is required');
    return this.repo.update(id, { ...input, name, hoursRev: SHIFT_HOURS_REV });
  }

  /** Removes the label; shifts already on the calendar stay as normal events. */
  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
