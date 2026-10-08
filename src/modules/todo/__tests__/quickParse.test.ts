import { parseQuickTask } from '../quickParse';

const ctx = {
  today: '2026-10-07',
  projects: [
    { id: 'p1', name: 'Casa Nueva' },
    { id: 'p2', name: 'Oposición' },
  ],
}; // Wednesday

describe('parseQuickTask', () => {
  it('extracts priority, tags, project and relative dates', () => {
    expect(parseQuickTask('Comprar pañales mañana p1 #casa #bebé', ctx)).toEqual({
      title: 'Comprar pañales',
      priority: 1,
      dueDate: '2026-10-08',
      tagNames: ['casa', 'bebé'],
    });
    expect(parseQuickTask('Estudiar tema 3 @oposicion hoy', ctx)).toMatchObject({
      title: 'Estudiar tema 3',
      projectId: 'p2',
      dueDate: '2026-10-07',
    });
    expect(parseQuickTask('Pintar @casanueva pasado mañana', ctx)).toMatchObject({ projectId: 'p1', dueDate: '2026-10-09' });
  });

  it('understands weekdays (this week or next) and dd/mm dates', () => {
    expect(parseQuickTask('Fútbol viernes', ctx).dueDate).toBe('2026-10-09');
    expect(parseQuickTask('Reunión lunes', ctx).dueDate).toBe('2026-10-12');
    expect(parseQuickTask('Call friday', ctx).dueDate).toBe('2026-10-09');
    expect(parseQuickTask('ITV 15/03', ctx).dueDate).toBe('2027-03-15');
    expect(parseQuickTask('Seguro 20/10/2026', ctx).dueDate).toBe('2026-10-20');
  });

  it('keeps unknown @mentions and words inside the title', () => {
    expect(parseQuickTask('Llamar a @pedro sobre p5 hoyos', ctx)).toEqual({ title: 'Llamar a @pedro sobre p5 hoyos', tagNames: [] });
  });
});
