import type { BaseEntity, EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';

/** Central notification record. Any module (or the AI later) can emit one. */
export interface AppNotification extends BaseEntity {
  sourceModule: string;
  title: string;
  body?: string | null;
  at: string;
  readAt?: string | null;
  ref?: EntityRef | null;
}

/** Manual reminder ("Recordarme comprar el regalo", viernes 18:00). */
export interface Reminder extends BaseEntity {
  title: string;
  at: string;
  recurrence?: RecurrenceRule | null;
  done: boolean;
}
