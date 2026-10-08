import type { Repository } from '@/storage/repository';
import type { EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import { matchScore, type SearchResult } from '@/types/search';
import { addDays, fromDateKey, toDateKey, type DateKey } from '@/utils/date';
import { expandOccurrences } from '@/utils/recurrence';
import type { Area, Project, Section, Tag, Task, TaskPriority, TaskStatus } from './types';

export interface QuickTaskInput {
  title: string;
  dueDate?: DateKey | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  projectId?: string | null;
  sectionId?: string | null;
  parentTaskId?: string | null;
  tagIds?: string[];
  /** Cross-module links set at creation (e.g. a task created from a child's profile). */
  attachments?: EntityRef[];
}

/** Editable fields of a task (detail editor). */
export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'dueDate'
    | 'dueTime'
    | 'deadline'
    | 'areaId'
    | 'projectId'
    | 'sectionId'
    | 'assigneeName'
    | 'tagIds'
    | 'notes'
    | 'links'
    | 'attachments'
    | 'reminders'
    | 'recurrence'
  >
>;

export interface ToggleResult {
  task: Task;
  /** Recurring task completed → moved to its next date. */
  rescheduledTo?: DateKey;
}

/** Next due date of a recurring task after `from` (null when the series ended). */
export function nextDueDate(due: DateKey, rule: RecurrenceRule): DateKey | null {
  const start = fromDateKey(due);
  const from = addDays(start, 1);
  const next = expandOccurrences({ start, durationMs: 0, rule, from, to: addDays(from, 366 * 5), limit: 1 })[0];
  return next ? toDateKey(next) : null;
}

export class TaskService {
  constructor(
    private readonly tasks: Repository<Task>,
    private readonly areas: Repository<Area>,
    private readonly projects: Repository<Project>,
    private readonly sections: Repository<Section>,
    private readonly tags: Repository<Tag>,
  ) {}

  // ---------- Tasks ----------

  list(): Promise<Task[]> {
    return this.tasks.list();
  }

  get(id: string): Promise<Task | null> {
    return this.tasks.get(id);
  }

  async quickAdd(input: QuickTaskInput): Promise<Task> {
    const title = input.title.trim();
    if (!title) throw new Error('Task title is required');
    const existing = await this.tasks.list();
    let areaId: string | null = null;
    if (input.projectId) areaId = (await this.projects.get(input.projectId))?.areaId ?? null;
    return this.tasks.create({
      title,
      status: 'pending',
      priority: input.priority ?? 4,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      deadline: null,
      areaId,
      projectId: input.projectId ?? null,
      sectionId: input.sectionId ?? null,
      parentTaskId: input.parentTaskId ?? null,
      assigneeName: null,
      tagIds: input.tagIds ?? [],
      links: [],
      attachments: input.attachments ?? [],
      reminders: [],
      recurrence: null,
      completedAt: null,
      order: existing.length,
    });
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const next: TaskPatch & { completedAt?: string | null } = { ...patch };
    if (patch.title !== undefined) {
      next.title = patch.title.trim();
      if (!next.title) throw new Error('Task title is required');
    }
    if (patch.status !== undefined) next.completedAt = patch.status === 'completed' ? new Date().toISOString() : null;
    if (patch.projectId !== undefined) {
      next.areaId = patch.projectId ? ((await this.projects.get(patch.projectId))?.areaId ?? null) : (patch.areaId ?? null);
      // A section only makes sense inside its project.
      if (patch.sectionId === undefined) next.sectionId = null;
    }
    const updated = await this.tasks.update(id, next);
    // Moving a parent moves its subtasks with it.
    if (patch.projectId !== undefined) {
      for (const sub of (await this.tasks.list()).filter((t) => t.parentTaskId === id)) {
        await this.tasks.update(sub.id, { projectId: updated.projectId, areaId: updated.areaId, sectionId: updated.sectionId });
      }
    }
    return updated;
  }

  setStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.update(id, { status });
  }

  /**
   * Completes/reopens a task. Completing a recurring task with a due date
   * moves it to its next occurrence instead (it stays open).
   */
  async toggleComplete(task: Task): Promise<ToggleResult> {
    if (task.status === 'completed') return { task: await this.setStatus(task.id, 'pending') };
    if (task.recurrence && task.dueDate) {
      const next = nextDueDate(task.dueDate, task.recurrence);
      if (next) {
        const moved = await this.tasks.update(task.id, { dueDate: next, status: 'pending', completedAt: null });
        // Subtasks of a recurring task start fresh for the next round.
        for (const sub of (await this.tasks.list()).filter((t) => t.parentTaskId === task.id && t.status === 'completed')) {
          await this.tasks.update(sub.id, { status: 'pending', completedAt: null });
        }
        return { task: moved, rescheduledTo: next };
      }
    }
    return { task: await this.setStatus(task.id, 'completed') };
  }

  async remove(id: string): Promise<void> {
    // Removes subtasks together with their parent.
    const children = (await this.tasks.list()).filter((t) => t.parentTaskId === id).map((t) => t.id);
    await this.tasks.removeMany([id, ...children]);
  }

  /** Archives every completed task (keeps history out of the views). */
  async archiveCompleted(): Promise<number> {
    const done = (await this.tasks.list()).filter((t) => t.status === 'completed');
    for (const t of done) await this.tasks.update(t.id, { status: 'archived' });
    return done.length;
  }

  // ---------- Areas / Projects / Sections ----------

  async listStructure(): Promise<{ areas: Area[]; projects: Project[]; sections: Section[] }> {
    const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
    return {
      areas: (await this.areas.list()).sort(byOrder),
      projects: (await this.projects.list()).sort(byOrder),
      sections: (await this.sections.list()).sort(byOrder),
    };
  }

  async createArea(name: string, color: string): Promise<Area> {
    if (!name.trim()) throw new Error('Name is required');
    return this.areas.create({ name: name.trim(), color, order: (await this.areas.list()).length });
  }

  renameArea(id: string, name: string): Promise<Area> {
    return this.areas.update(id, { name: name.trim() });
  }

  /** Deleting an area keeps its projects (they become area-less). */
  async deleteArea(id: string): Promise<void> {
    for (const p of (await this.projects.list()).filter((x) => x.areaId === id)) await this.projects.update(p.id, { areaId: null });
    for (const t of (await this.tasks.list()).filter((x) => x.areaId === id)) await this.tasks.update(t.id, { areaId: null });
    await this.areas.remove(id);
  }

  async createProject(input: { name: string; color: string; areaId: string | null }): Promise<Project> {
    if (!input.name.trim()) throw new Error('Name is required');
    return this.projects.create({
      name: input.name.trim(),
      color: input.color,
      areaId: input.areaId,
      archived: false,
      order: (await this.projects.list()).length,
    });
  }

  async updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'color' | 'areaId' | 'archived'>>): Promise<Project> {
    const updated = await this.projects.update(id, patch);
    if (patch.areaId !== undefined) {
      for (const t of (await this.tasks.list()).filter((x) => x.projectId === id)) await this.tasks.update(t.id, { areaId: patch.areaId });
    }
    return updated;
  }

  /** Deleting a project deletes its tasks (the UI confirms with the count). */
  async deleteProject(id: string): Promise<void> {
    const ids = (await this.tasks.list()).filter((t) => t.projectId === id).map((t) => t.id);
    await this.tasks.removeMany(ids);
    await this.sections.removeMany((await this.sections.list()).filter((s) => s.projectId === id).map((s) => s.id));
    await this.projects.remove(id);
  }

  async createSection(projectId: string, name: string): Promise<Section> {
    if (!name.trim()) throw new Error('Name is required');
    const order = (await this.sections.list()).filter((s) => s.projectId === projectId).length;
    return this.sections.create({ projectId, name: name.trim(), order });
  }

  renameSection(id: string, name: string): Promise<Section> {
    return this.sections.update(id, { name: name.trim() });
  }

  /** Deleting a section keeps its tasks in the project. */
  async deleteSection(id: string): Promise<void> {
    for (const t of (await this.tasks.list()).filter((x) => x.sectionId === id)) await this.tasks.update(t.id, { sectionId: null });
    await this.sections.remove(id);
  }

  // ---------- Tags ----------

  async listTags(): Promise<Tag[]> {
    return (await this.tags.list()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Returns the existing tag with that name (case-insensitive) or creates it. */
  async ensureTag(name: string, color: string): Promise<Tag> {
    const clean = name.trim().replace(/^#/, '');
    if (!clean) throw new Error('Name is required');
    const existing = (await this.tags.list()).find((t) => t.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
    return existing ?? this.tags.create({ name: clean, color });
  }

  renameTag(id: string, name: string): Promise<Tag> {
    return this.tags.update(id, { name: name.trim().replace(/^#/, '') });
  }

  async deleteTag(id: string): Promise<void> {
    for (const t of (await this.tasks.list()).filter((x) => x.tagIds.includes(id))) {
      await this.tasks.update(t.id, { tagIds: t.tagIds.filter((x) => x !== id) });
    }
    await this.tags.remove(id);
  }

  // ---------- Links & search ----------

  async tasksLinkedTo(ref: EntityRef): Promise<Task[]> {
    return (await this.tasks.list()).filter((t) =>
      (t.attachments ?? []).some((a) => a.module === ref.module && a.type === ref.type && a.id === ref.id),
    );
  }

  async search(text: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const t of await this.tasks.list()) {
      const score = Math.max(matchScore(t.title, text), t.description && matchScore(t.description, text) ? 1 : 0);
      if (!score || t.status === 'archived') continue;
      results.push({
        ref: { module: 'todo', type: 'task', id: t.id },
        title: t.title,
        kindKey: t.status === 'completed' ? 'search.kinds.completedTask' : t.parentTaskId ? 'search.kinds.subtask' : 'search.kinds.task',
        date: t.dueDate ?? undefined,
        // Open tasks rank above completed ones.
        score: score + (t.status === 'completed' ? 0 : 1),
        route: `/todo?task=${t.parentTaskId ?? t.id}`,
      });
    }
    return results;
  }
}
