import { LocalRepository } from '@/storage/repository';
import { memoryStore } from '@/test/memoryStore';
import { nextDueDate, TaskService } from '../service';
import type { Area, Project, Section, Tag, Task } from '../types';

// jest.mock factories run lazily and must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/utils/id', () => {
  let i = 0;
  return { createId: () => `id-${++i}` };
});

function setup() {
  const kv = memoryStore();
  const repo = <T extends { id: string }>(c: string) => new LocalRepository<T & never>(kv, 'u', c);
  return new TaskService(repo<Task>('tasks'), repo<Area>('areas'), repo<Project>('projects'), repo<Section>('sections'), repo<Tag>('tags'));
}

describe('TaskService', () => {
  it('board: new boards get default lists; cards move between lists with their subtasks', async () => {
    const s = setup();
    const board = await s.createProject({ name: 'Casa', color: '#000000', areaId: null, lists: ['Por hacer', 'Hecho'] });
    const [todo, done] = (await s.listStructure()).sections;
    expect([todo.name, done.name]).toEqual(['Por hacer', 'Hecho']);
    const a = await s.quickAdd({ title: 'A', projectId: board.id, sectionId: todo.id });
    const b = await s.quickAdd({ title: 'B', projectId: board.id, sectionId: done.id });
    const sub = await s.quickAdd({ title: 'A.1', projectId: board.id, sectionId: todo.id, parentTaskId: a.id });
    await s.moveTask(a.id, done.id, [a.id, b.id]);
    expect((await s.get(a.id))?.sectionId).toBe(done.id);
    expect((await s.get(sub.id))?.sectionId).toBe(done.id);
    expect((await s.get(a.id))?.order).toBe(0);
    expect((await s.get(b.id))?.order).toBe(1);
    // Moving into «En curso» starts the clock; moving out stops it.
    const doing = await s.createSection(board.id, 'En curso');
    await s.moveTask(b.id, doing.id, [b.id]);
    expect((await s.get(b.id))?.startedAt).toBeTruthy();
    await s.moveTask(b.id, todo.id, [b.id]);
    expect((await s.get(b.id))?.startedAt).toBeNull();
    await s.reorderSections([done.id, todo.id]);
    expect((await s.listStructure()).sections.map((x) => x.name)).toEqual(['Hecho', 'Por hacer', 'En curso']);
  });

  it('assigns a task created from a profile to that person', async () => {
    const s = setup();
    const task = await s.quickAdd({
      title: 'Comprar zapatillas',
      assigneeName: ' Elisa ',
      attachments: [{ module: 'family', type: 'child', id: 'c1' }],
    });
    expect(task.assigneeName).toBe('Elisa');
    expect((await s.quickAdd({ title: 'Otra' })).assigneeName).toBeNull();
  });

  it('moves a recurring task to its next date instead of completing it', async () => {
    const s = setup();
    const task = await s.quickAdd({ title: 'Sacar basura', dueDate: '2026-10-07' });
    const sub = await s.quickAdd({ title: 'Reciclaje', parentTaskId: task.id });
    await s.toggleComplete(sub);
    const recurring = await s.update(task.id, { recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 3] } });
    const r = await s.toggleComplete(recurring);
    expect(r.rescheduledTo).toBe('2026-10-08');
    expect(r.task.status).toBe('pending');
    expect((await s.get(sub.id))?.status).toBe('pending'); // subtasks reset for the next round
  });

  it('completes a recurring task once its series has ended', async () => {
    expect(nextDueDate('2026-10-07', { freq: 'daily', interval: 1, until: '2026-10-07' })).toBeNull();
    const s = setup();
    const t = await s.quickAdd({ title: 'Última', dueDate: '2026-10-07' });
    await s.update(t.id, { recurrence: { freq: 'daily', interval: 1, count: 1 } });
    const r = await s.toggleComplete((await s.get(t.id))!);
    expect(r.task.status).toBe('completed');
  });

  it('keeps tasks when deleting a section, area or tag, and inherits the area from the project', async () => {
    const s = setup();
    const area = await s.createArea('Casa', '#000');
    const project = await s.createProject({ name: 'Reparaciones', color: '#111', areaId: area.id });
    const section = await s.createSection(project.id, 'Urgente');
    const tag = await s.ensureTag('#luz', '#222');
    expect((await s.ensureTag('LUZ', '#333')).id).toBe(tag.id);
    const task = await s.quickAdd({ title: 'Cambiar bombilla', projectId: project.id, sectionId: section.id, tagIds: [tag.id] });
    expect(task.areaId).toBe(area.id);

    await s.deleteSection(section.id);
    await s.deleteTag(tag.id);
    await s.deleteArea(area.id);
    const after = (await s.get(task.id))!;
    expect(after).toMatchObject({ projectId: project.id, sectionId: null, tagIds: [], areaId: null });
  });

  it('deleting a project deletes its tasks and subtasks', async () => {
    const s = setup();
    const project = await s.createProject({ name: 'Viaje', color: '#000', areaId: null });
    const t = await s.quickAdd({ title: 'Reservar', projectId: project.id });
    await s.quickAdd({ title: 'Hotel', parentTaskId: t.id, projectId: project.id });
    await s.quickAdd({ title: 'Otra cosa' });
    await s.deleteProject(project.id);
    expect((await s.list()).map((x) => x.title)).toEqual(['Otra cosa']);
  });

  it('moving a task to another project moves its subtasks too', async () => {
    const s = setup();
    const a = await s.createProject({ name: 'A', color: '#000', areaId: null });
    const b = await s.createProject({ name: 'B', color: '#000', areaId: null });
    const t = await s.quickAdd({ title: 'Padre', projectId: a.id });
    const sub = await s.quickAdd({ title: 'Hija', parentTaskId: t.id, projectId: a.id });
    await s.update(t.id, { projectId: b.id });
    expect((await s.get(sub.id))?.projectId).toBe(b.id);
  });
});
