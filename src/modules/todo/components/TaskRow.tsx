import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { hitSize, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { addDays, formatShortDate, fromDateKey, toDateKey } from '@/utils/date';
import { usePriorityColors } from '../priority';
import type { Task } from '../types';
import { useTodoLookup } from '../useTodoLookup';

interface TaskRowProps {
  task: Task;
  today: string;
  onToggle: (task: Task) => void;
  /** Opens the detail editor. Without it, pressing the row toggles the task. */
  onOpen?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Hide the project label (already inside that project). */
  hideProject?: boolean;
}

export function TaskRow({ task, today, onToggle, onOpen, onDelete, hideProject }: TaskRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius } = useTheme();
  const priorityColors = usePriorityColors();
  const lookup = useTodoLookup();
  const done = task.status === 'completed';
  const ring = task.priority < 4 ? priorityColors[task.priority] : colors.borderStrong;

  let due: { label: string; tone: 'danger' | 'primary' | 'neutral' } | null = null;
  if (task.dueDate && !done) {
    const tomorrow = toDateKey(addDays(fromDateKey(today), 1));
    if (task.dueDate < today) due = { label: t('todo.due.overdue'), tone: 'danger' };
    else if (task.dueDate === today) due = { label: t('common.today') + (task.dueTime ? ` · ${task.dueTime}` : ''), tone: 'primary' };
    else if (task.dueDate === tomorrow) due = { label: t('common.tomorrow') + (task.dueTime ? ` · ${task.dueTime}` : ''), tone: 'neutral' };
    else due = { label: formatShortDate(fromDateKey(task.dueDate), locale), tone: 'neutral' };
  }
  const project = task.projectId && !hideProject ? lookup.projects.get(task.projectId) : undefined;
  const tags = task.tagIds.map((id) => lookup.tags.get(id)).filter(Boolean);
  const progress = lookup.progress.get(task.id);
  const deadline = task.deadline && !done ? task.deadline : null;
  const label = [
    task.title,
    task.priority < 4 ? t(`todo.priority.p${task.priority}`) : null,
    due?.label,
    project?.name,
    progress ? t('todo.subtasks.progress', { done: progress.done, total: progress.total }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      <Pressable
        onPress={() => onToggle(task)}
        accessibilityRole="checkbox"
        aria-checked={done}
        accessibilityLabel={done ? t('todo.markPending', { title: task.title }) : t('todo.markDone', { title: task.title })}
        hitSlop={6}
        style={{ width: 32, minHeight: hitSize, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: done ? colors.textSubtle : ring,
            backgroundColor: done ? colors.textSubtle : task.priority < 4 ? withAlpha(ring, 0.1) : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Icon name="check" size={12} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={() => (onOpen ? onOpen(task) : onToggle(task))}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={onOpen ? t('todo.openHint') : undefined}
        style={(s) => ({
          flex: 1,
          minHeight: hitSize,
          justifyContent: 'center',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
        })}
      >
        <AppText
          variant="body"
          tone={done ? 'textSubtle' : 'text'}
          style={done ? { textDecorationLine: 'line-through' } : undefined}
          numberOfLines={2}
        >
          {task.title}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
          {task.status === 'in_progress' ? <Badge label={t('todo.status.in_progress')} tone="info" icon="play" /> : null}
          {due ? <Badge label={due.label} tone={due.tone} icon={task.recurrence ? 'repeat' : 'calendar'} /> : null}
          {deadline ? (
            <Badge
              label={t('todo.deadlineShort', { date: formatShortDate(fromDateKey(deadline), locale) })}
              tone={deadline < today ? 'danger' : 'warning'}
              icon="flag"
            />
          ) : null}
          {progress ? (
            <Badge
              label={`${progress.done}/${progress.total}`}
              icon="check-square"
              tone={progress.done === progress.total ? 'success' : 'neutral'}
            />
          ) : null}
          {task.description || task.notes ? <Icon name="align-left" size={12} color={colors.textSubtle} /> : null}
          {(task.attachments?.length ?? 0) + task.links.length ? <Icon name="paperclip" size={12} color={colors.textSubtle} /> : null}
          {task.assigneeName ? <Badge label={task.assigneeName} icon="user" /> : null}
          {tags.map((tag) => (
            <AppText key={tag!.id} variant="caption" color={tag!.color}>
              #{tag!.name}
            </AppText>
          ))}
          {project ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: project.color }} />
              <AppText variant="caption" tone="textMuted" numberOfLines={1}>
                {project.name}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {onDelete ? (
        <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${task.title}`} onPress={() => onDelete(task)} />
      ) : null}
    </View>
  );
}
