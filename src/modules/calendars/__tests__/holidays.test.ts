import { holidayOccurrences, holidayOn, holidaysBetween, isHoliday } from '../holidays';

describe('public holidays (Spain + Comunidad de Madrid)', () => {
  it('has the 12 holidays of each decree year', () => {
    expect(holidaysBetween(new Date('2026-01-01T00:00:00'), 365).size).toBe(12);
    expect(holidaysBetween(new Date('2027-01-01T00:00:00'), 365).size).toBe(12);
  });

  it('includes the region’s own days and moved holidays', () => {
    expect(holidayOn('2026-05-02')).toBe('Fiesta de la Comunidad de Madrid');
    expect(holidayOn('2026-12-07')).toMatch(/Constitución/);
    expect(holidayOn('2027-03-19')).toBe('San José');
    expect(holidayOn('2027-08-15')).toBeNull(); // moved to the 16th
    expect(holidayOn('2027-08-16')).toMatch(/Asunción/);
  });

  it('become read-only all-day occurrences of the "Festivos" calendar', () => {
    const [o] = holidayOccurrences(holidaysBetween(new Date('2026-10-01T00:00:00'), 31), 'Festivos');
    expect(o.event.title).toBe('Fiesta Nacional de España');
    expect(o.event.allDay).toBe(true);
    expect(o.start.getDate()).toBe(12);
    expect(isHoliday(o)).toBe(true);
  });
});
