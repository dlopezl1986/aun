import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import { readableOn, withAlpha } from '@/utils/color';
import { addDays, formatShortDate, fromDateKey, toDateKey } from '@/utils/date';
import { usePriorityColors } from '../priority';
import type { Task } from '../types';
import { useTodoLookup } from '../useTodoLookup';
import { cardDomId } from './useBoardDrag';

interface Props {
  task: Task;
  today: string;
  onOpen?: (task: Task) => void;
  onToggle?: (task: Task) => void;
  /** Native apps: long press offers "Mover a…" (web drags instead). */
  onLongPress?: (task: Task) => void;
  /** The floating copy that follows the finger/mouse. */
  ghost?: boolean;
  /** The card being dragged keeps its place in the DOM but takes no space. */
  hidden?: boolean;
}

/** Trello-style card: labels on top, title, then small badges. */
export function BoardCard({ task, today, onOpen, onToggle, onLongPress, ghost, hidden }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors, radius, mode } = useTheme();
  const priorityColors = usePriorityColors();
  const lookup = useTodoLookup();
  const done = task.status === 'completed';

  let due: { label: string; color: string } | null = null;
  if (task.dueDate) {
    const tomorrow = toDateKey(addDays(fromDateKey(today), 1));
    const label =
      task.dueDate === today
        ? t('common.today')
        : task.dueDate === tomorrow
          ? t('common.tomorrow')
          : formatShortDate(fromDateKey(task.dueDate), locale);
    const color = done ? colors.success : task.dueDate < today ? colors.danger : task.dueDate === today ? colors.warning : colors.textMuted;
    due = { label: task.dueTime ? `${label} · ${task.dueTime}` : label, color };
  }
  const tags = task.tagIds.map((id) => lookup.tags.get(id)).filter((x) => !!x);
  const progress = lookup.progress.get(task.id);
  const hasNotes = !!(task.description || task.notes);
  const linkCount = (task.attachments?.length ?? 0) + task.links.length;
  const initials = task.assigneeName
    ?.split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const label = [
    task.title,
    task.priority < 4 ? t(`todo.priority.p${task.priority}`) : null,
    due?.label,
    ...tags.map((tag) => tag.name),
    progress ? t('todo.subtasks.progress', { done: progress.done, total: progress.total }) : null,
    task.assigneeName,
  ]
    .filter(Boolean)
    .join(', ');

  const labelBg = (c: string) => withAlpha(c, mode === 'dark' ? 0.28 : 0.16);

  const body = (
    <>
      {tags.length ? (
        // Trello-style labels: short colour bars (names are in the accessible label).
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
          {tags.map((tag) => (
            <View
              key={tag.id}
              accessibilityLabel={tag.name}
              style={{ width: 40, height: 8, borderRadius: radius.pill, backgroundColor: tag.color }}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        {onToggle || ghost ? (
          <Pressable
            onPress={() => onToggle?.(task)}
            accessibilityRole="checkbox"
            aria-checked={done}
            accessibilityLabel={done ? t('todo.markPending', { title: task.title }) : t('todo.markDone', { title: task.title })}
            hitSlop={8}
            style={{ paddingTop: 2 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: done ? colors.success : colors.borderStrong,
                backgroundColor: done ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? <Icon name="check" size={11} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
        ) : null}
        <AppText
          variant="body"
          tone={done ? 'textSubtle' : 'text'}
          style={[{ flex: 1 }, done ? { textDecorationLine: 'line-through' } : null]}
          numberOfLines={4}
        >
          {task.title}
        </AppText>
      </View>
      {task.priority < 4 || due || hasNotes || progress || linkCount || task.recurrence || initials || task.status === 'in_progress' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
          {task.priority < 4 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: radius.xs,
                backgroundColor: labelBg(priorityColors[task.priority]),
              }}
            >
              <Icon name="flag" size={11} color={priorityColors[task.priority]} />
              <AppText variant="caption" color={priorityColors[task.priority]}>
                {t(`todo.board.priority${task.priority}`)}
              </AppText>
            </View>
          ) : null}
          {due ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: due.color === colors.textMuted ? 0 : 6,
                paddingVertical: 1,
                borderRadius: radius.xs,
                backgroundColor: due.color === colors.textMuted ? 'transparent' : labelBg(due.color),
              }}
            >
              <Icon name={task.recurrence ? 'repeat' : 'clock'} size={12} color={due.color} />
              <AppText variant="caption" color={due.color}>
                {due.label}
              </AppText>
            </View>
          ) : null}
          {task.status === 'in_progress' ? <Icon name="play-circle" size={13} color={colors.info} /> : null}
          {hasNotes ? <Icon name="align-left" size={13} color={colors.textSubtle} /> : null}
          {progress ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="check-square" size={12} color={progress.done === progress.total ? colors.success : colors.textSubtle} />
              <AppText variant="caption" color={progress.done === progress.total ? colors.success : colors.textSubtle}>
                {progress.done}/{progress.total}
              </AppText>
            </View>
          ) : null}
          {linkCount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="paperclip" size={12} color={colors.textSubtle} />
              <AppText variant="caption" tone="textSubtle">
                {linkCount}
              </AppText>
            </View>
          ) : null}
          {initials ? (
            <View
              style={{
                marginLeft: 'auto',
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: withAlpha(colors.primary, 0.18),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" color={readableOn(colors.primary, colors.surface)} style={{ fontSize: 10 }}>
                {initials}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      {progress && progress.total > 0 ? (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, marginTop: spacing.sm, overflow: 'hidden' }}>
          <View
            style={{
              width: `${Math.round((progress.done / progress.total) * 100)}%`,
              height: 4,
              backgroundColor: progress.done === progress.total ? colors.success : colors.primary,
            }}
          />
        </View>
      ) : null}
    </>
  );

  const frame = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    boxShadow: '0 1px 1px rgba(11, 18, 32, 0.08), 0 2px 8px rgba(11, 18, 32, 0.06)',
    // Priority at a glance: a coloured edge (Planner-like).
    borderLeftWidth: task.priority < 4 && !done ? 4 : 1,
    borderLeftColor: task.priority < 4 && !done ? priorityColors[task.priority] : colors.border,
  } as const;

  if (ghost) {
    return (
      <View
        pointerEvents="none"
        style={[frame, { transform: [{ rotate: '3deg' }], boxShadow: '0 12px 28px rgba(11, 18, 32, 0.28)', opacity: 0.96 }]}
      >
        {body}
      </View>
    );
  }

  return (
    <View
      id={cardDomId(task.id)}
      style={[
        hidden ? { height: 0, overflow: 'hidden', opacity: 0, marginTop: -spacing.sm } : null,
        Platform.OS === 'web' ? webNoSelect : null,
      ]}
    >
      <Pressable
        onPress={() => onOpen?.(task)}
        onLongPress={onLongPress ? () => onLongPress(task) : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('todo.openHint')}
        style={(s) => [
          frame,
          {
            opacity: done ? 0.75 : 1,
            borderColor: interaction(s).hovered ? colors.borderStrong : colors.border,
            cursor: Platform.OS === 'web' ? 'grab' : undefined,
          } as object,
        ]}
      >
        {body}
      </Pressable>
    </View>
  );
}

const webNoSelect = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object;
