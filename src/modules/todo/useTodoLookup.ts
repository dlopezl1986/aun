import { useMemo } from 'react';

import { useTags, useTasks, useTodoStructure } from './hooks';
import { subtaskProgress } from './selectors';
import type { Project, Section, Tag } from './types';

/** Id → entity lookups shared by every task row (all cached queries). */
export function useTodoLookup() {
  const tasks = useTasks();
  const structure = useTodoStructure();
  const tags = useTags();
  return useMemo(
    () => ({
      projects: new Map<string, Project>((structure.data?.projects ?? []).map((p) => [p.id, p])),
      sections: new Map<string, Section>((structure.data?.sections ?? []).map((s) => [s.id, s])),
      tags: new Map<string, Tag>((tags.data ?? []).map((t) => [t.id, t])),
      progress: subtaskProgress(tasks.data ?? []),
    }),
    [structure.data, tags.data, tasks.data],
  );
}
