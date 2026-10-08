/**
 * Shared recurrence rule (events, tasks, reminders). Modelled after RFC 5545
 * RRULE so it can be mapped to iCal / Google / Outlook later.
 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  interval: number;
  /** 0 = Monday … 6 = Sunday (weekly rules). */
  byWeekday?: number[];
  until?: string | null;
  count?: number | null;
}
