import type { BaseEntity, EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import type { DateKey } from '@/utils/date';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

/** 1 = urgent … 4 = none. */
export type TaskPriority = 1 | 2 | 3 | 4;

/** Hierarchy: Area → Project → Section → Task → Subtask (section 25). */
export interface Area extends BaseEntity {
  name: string;
  color: string;
  order: number;
}

export interface Project extends BaseEntity {
  areaId: string | null;
  name: string;
  color: string;
  order: number;
  archived: boolean;
}

export interface Section extends BaseEntity {
  projectId: string;
  name: string;
  order: number;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: DateKey | null;
  dueTime?: string | null;
  deadline?: DateKey | null;
  areaId?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  /** Subtasks reference their parent task. */
  parentTaskId?: string | null;
  /** Collaboration: creator is `ownerId`; assignee may be another AUN user (Phase 9). */
  assigneeId?: string | null;
  /** Responsible person while accounts are local ("Yo", "Pareja"…). */
  assigneeName?: string | null;
  tagIds: string[];
  notes?: string | null;
  /** Web links (URLs). */
  links: string[];
  /** Cross-module links: documents, events, children… (section 48). */
  attachments: EntityRef[];
  /** Minutes before due date/time. */
  reminders: number[];
  recurrence?: RecurrenceRule | null;
  completedAt?: string | null;
  order: number;
}

export type TaskView = 'today' | 'inbox' | 'upcoming' | 'all' | 'priorities' | 'completed';

/** Navigation target of the ToDo screen. */
export type TodoTarget =
  | { kind: 'view'; view: TaskView }
  | { kind: 'project'; projectId: string }
  | { kind: 'tag'; tagId: string }
  | { kind: 'projects' }
  | { kind: 'tags' };
