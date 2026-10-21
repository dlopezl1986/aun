import type { BaseEntity } from '@/types/entity';
import type { DateKey } from '@/utils/date';

/** A topic of the syllabus ("Tema 5 · Derecho administrativo"). */
export interface OpTopic extends BaseEntity {
  number: number;
  title: string;
  /** Marked as studied. */
  studied: boolean;
}

/** One study day: what is planned, what got done, hours and notes. */
export interface OpSession extends BaseEntity {
  date: DateKey;
  /** Topics planned for the day. */
  topicIds: string[];
  /** Of those, the ones done. */
  doneTopicIds: string[];
  /** Hours studied (typed by hand). */
  hours: number | null;
  /** What was left behind (shown on the next study day). */
  behind: string;
  /** Notes for the next day (shown on the next study day). */
  tomorrow: string;
  notes: string;
  /** Its event in the "Oposición" calendar (so the plan shows in Calendarios). */
  eventId: string | null;
}
