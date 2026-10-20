import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/ui/Sheet';
import { useLocale } from '@/hooks/useLocale';
import { formatLongDate, fromDateKey, toDateKey } from '@/utils/date';
import { lastDayKey } from '../monthLayout';
import type { DayNote, EventOccurrence } from '../types';
import { DayAgenda } from './DayAgenda';

interface Props {
  /** Day shown (YYYY-MM-DD), or null when closed. */
  date: string | null;
  occurrences: EventOccurrence[];
  notes: DayNote[];
  onClose: () => void;
  onEvent: (o: EventOccurrence) => void;
  onNote: (date: string, n: DayNote | null) => void;
  onNewEvent: (date: string) => void;
}

/** Everything on one day, in detail (double click / "+N más" on the month grid). */
export function DaySheet({ date, occurrences, notes, onClose, onEvent, onNote, onNewEvent }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (!date) return null;
  // Events touching the day (several-day ones too), and its notes.
  const dayEvents = occurrences.filter((o) => toDateKey(o.start) <= date && lastDayKey(o) >= date);
  const dayNotes = notes.filter((n) => n.date === date);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={formatLongDate(fromDateKey(date), locale)}
      subtitle={[
        t('calendars.dayEvents', { count: dayEvents.length }),
        dayNotes.length ? t('calendars.daySheet.notes', { count: dayNotes.length }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <DayAgenda
        extended
        occurrences={dayEvents}
        notes={dayNotes}
        onEvent={(o) => {
          onClose();
          onEvent(o);
        }}
        onNote={(n) => {
          onClose();
          onNote(date, n);
        }}
        onNewEvent={() => {
          onClose();
          onNewEvent(date);
        }}
      />
    </Sheet>
  );
}
