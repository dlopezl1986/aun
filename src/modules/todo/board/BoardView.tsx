import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { SurfaceScope, useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import {
  useCreateSection,
  useDeleteSection,
  useMoveTask,
  useQuickAddTask,
  useRenameSection,
  useReorderSections,
  useTodoStructure,
  useToggleTask,
  useUpdateTask,
} from '../hooks';
import { PRIORITIES, usePriorityColors } from '../priority';
import { parseQuickTask } from '../quickParse';
import type { Section, Task, TaskPriority } from '../types';
import type { ResolvedBackground } from './backgrounds';
import { BoardCard } from './BoardCard';
import { applyMove, boardColumns, GENERAL_BOARD, LOOSE_LIST, moveCard, type BoardColumn } from './model';
import { dragSupported, listDomId, useBoardDrag } from './useBoardDrag';

export type GroupBy = 'lists' | 'priority';

interface Props {
  boardId: string;
  background: ResolvedBackground;
  /** «Listas» (Trello) or «Prioridad» (Planner): dragging between priority columns changes the priority. */
  groupBy: GroupBy;
  /** Cards shown (filter); dragging is off while filtering. */
  filter: ((task: Task) => boolean) | null;
  tasks: Task[];
  sections: Section[];
  today: string;
  onOpen: (task: Task) => void;
}

type PendingMove = { cardId: string; toColumn: string; orderedIds: string[] } | null;

const PRIORITY_COLUMN = 'prio-';

export function BoardView({ boardId, background, groupBy, filter, tasks, sections, today, onOpen }: Props) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const { spacing, radius, mode } = useTheme();
  const { isCompact, width } = useBreakpoint();
  const priorityColors = usePriorityColors();
  const move = useMoveTask();
  const setPriority = useUpdateTask(true);
  const reorder = useReorderSections();
  const createSection = useCreateSection();
  const toggle = useToggleTask();
  const [pending, setPending] = useState<PendingMove>(null);

  const base = useMemo(() => {
    const byList = boardColumns(tasks, boardId, sections);
    if (groupBy === 'lists') return byList;
    // Planner-style: one column per priority, cards keep their board order.
    const all = byList.flatMap((c) => c.cards).sort((a, b) => a.order - b.order);
    const done = byList.flatMap((c) => c.done);
    return PRIORITIES.map((p) => ({
      id: `${PRIORITY_COLUMN}${p}`,
      section: null,
      cards: all.filter((x) => x.priority === p),
      done: done.filter((x) => x.priority === p),
    }));
  }, [tasks, boardId, sections, groupBy]);
  const columns = useMemo(() => {
    const moved = applyMove(base, pending);
    return filter ? moved.map((c) => ({ ...c, cards: c.cards.filter(filter), done: c.done.filter(filter) })) : moved;
  }, [base, pending, filter]);
  const columnPriority = (c: BoardColumn) =>
    c.id.startsWith(PRIORITY_COLUMN) ? (Number(c.id.slice(PRIORITY_COLUMN.length)) as TaskPriority) : null;
  const listName = (c: BoardColumn) => {
    const p = columnPriority(c);
    if (p) return t(`todo.board.priorityColumn${p}`);
    return c.section?.name ?? t('todo.board.defaultLists.todo');
  };
  // New cards in a priority column land in the board's first list.
  const firstList = boardColumns(tasks, boardId, sections)[0];

  const commitMove = (cardId: string, toColumn: string, index: number) => {
    const from = columns.find((c) => c.cards.some((x) => x.id === cardId));
    if (!from) return;
    const fromIndex = from.cards.findIndex((x) => x.id === cardId);
    if (from.id === toColumn && fromIndex === index) return;
    const orderedIds = moveCard(columns, cardId, toColumn, index);
    const next = { cardId, toColumn, orderedIds };
    setPending(next);
    const done = { onSettled: () => setPending((p) => (p === next ? null : p)) };
    if (toColumn.startsWith(PRIORITY_COLUMN)) {
      if (from.id === toColumn) return setPending(null);
      setPriority.mutate({ id: cardId, patch: { priority: Number(toColumn.slice(PRIORITY_COLUMN.length)) as TaskPriority } }, done);
    } else move.mutate({ id: cardId, sectionId: toColumn === LOOSE_LIST ? null : toColumn, orderedIds }, done);
  };

  const { drag, rootRef, scrollerRef, justDragged } = useBoardDrag(commitMove, !filter);

  /** Native apps (no drag): long press → choose the list. */
  const moveMenu = async (task: Task) => {
    const value = await dialog.choose({
      title: groupBy === 'priority' ? t('todo.board.setPriority') : t('todo.board.moveTo'),
      message: task.title,
      choices: columns.map((c) => ({ value: c.id, label: listName(c) })),
    });
    if (value) commitMove(task.id, value, columns.find((c) => c.id === value)?.cards.filter((x) => x.id !== task.id).length ?? 0);
  };

  const listWidth = isCompact ? Math.min(Math.max(width - 72, 240), 320) : 284;
  const lists = columns.filter((c) => c.section).map((c) => c.section!.id);

  const addList = async () => {
    const name = await dialog.prompt({
      title: t('todo.board.addList'),
      label: t('todo.board.listName'),
      placeholder: t('todo.board.listPlaceholder'),
      confirmLabel: t('common.create'),
    });
    if (name) createSection.mutate({ projectId: boardId, name });
  };

  // Text straight on the wallpaper.
  const onBoard = background.dark || mode === 'dark' ? '#FFFFFF' : '#0B1220';
  const glass = background.dark || mode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.6)';

  const draggingCard = drag ? tasks.find((x) => x.id === drag.cardId) : undefined;

  return (
    <View
      ref={rootRef as never}
      style={{
        marginHorizontal: isCompact ? -spacing.lg : 0,
        paddingTop: spacing.md,
        minHeight: 460,
      }}
    >
      {/* Wallpaper */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: isCompact ? 0 : radius.lg, overflow: 'hidden' }}
      >
        <Image source={background.source} style={{ flex: 1 }} contentFit="cover" transition={200} />
        {mode === 'dark' ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 20, 0.35)' }} />
        ) : null}
      </View>
      <ScrollView
        ref={scrollerRef as never}
        horizontal
        showsHorizontalScrollIndicator={!isCompact}
        snapToInterval={isCompact && !drag ? listWidth + spacing.md : undefined}
        decelerationRate={isCompact ? 'fast' : undefined}
        contentContainerStyle={{
          gap: spacing.md,
          alignItems: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
        }}
      >
        {columns.map((column) => (
          <BoardList
            key={column.id}
            boardId={boardId}
            column={column}
            name={listName(column)}
            accent={columnPriority(column) ? priorityColors[columnPriority(column)!] : undefined}
            priority={columnPriority(column) ?? undefined}
            targetList={column.section?.id ?? (columnPriority(column) ? (firstList?.section?.id ?? null) : null)}
            draggable={!filter}
            width={listWidth}
            today={today}
            drag={drag}
            canMoveLeft={!!column.section && lists.indexOf(column.id) > 0}
            canMoveRight={!!column.section && lists.indexOf(column.id) < lists.length - 1}
            onMoveList={(dir) => {
              const ids = [...lists];
              const i = ids.indexOf(column.id);
              ids.splice(i, 1);
              ids.splice(i + dir, 0, column.id);
              reorder.mutate(ids);
            }}
            onOpen={(task) => {
              if (!justDragged()) onOpen(task);
            }}
            onToggle={(task) => toggle.mutate(task)}
            onLongPress={dragSupported ? undefined : moveMenu}
          />
        ))}
        {groupBy === 'lists' ? (
          <Pressable
            onPress={addList}
            accessibilityRole="button"
            accessibilityLabel={t('todo.board.addList')}
            style={(s) => ({
              width: listWidth,
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: interaction(s).hovered ? withAlpha('#FFFFFF', 0.75) : glass,
              ...(webGlass as object),
            })}
          >
            <Icon name="plus" size={16} color={onBoard} />
            <AppText variant="smallStrong" color={onBoard}>
              {t('todo.board.addAnotherList')}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
      {drag && draggingCard ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: drag.x - drag.offsetX - drag.rootX,
            top: drag.y - drag.offsetY - drag.rootY,
            width: drag.width,
            zIndex: 1000,
          }}
        >
          <SurfaceScope>
            <BoardCard task={draggingCard} today={today} ghost />
          </SurfaceScope>
        </View>
      ) : null}
    </View>
  );
}

interface ListProps {
  boardId: string;
  column: BoardColumn;
  name: string;
  /** Priority columns: their colour, and the priority new cards get. */
  accent?: string;
  priority?: TaskPriority;
  /** List new cards go to. */
  targetList: string | null;
  draggable: boolean;
  width: number;
  today: string;
  drag: ReturnType<typeof useBoardDrag>['drag'];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveList: (dir: -1 | 1) => void;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
  onLongPress?: (task: Task) => void;
}

function BoardList({
  boardId,
  column,
  name,
  accent,
  priority,
  targetList,
  draggable,
  width,
  today,
  drag,
  canMoveLeft,
  canMoveRight,
  onMoveList,
  onOpen,
  onToggle,
  onLongPress,
}: ListProps) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const rename = useRenameSection();
  const remove = useDeleteSection();
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const menu = async () => {
    const section = column.section;
    if (!section) return;
    const choices = [
      ...(canMoveLeft ? [{ value: 'left', label: t('todo.board.moveLeft') }] : []),
      ...(canMoveRight ? [{ value: 'right', label: t('todo.board.moveRight') }] : []),
      { value: 'delete', label: t('todo.board.deleteList') },
      { value: 'rename', label: t('todo.board.renameList') },
    ];
    const choice = await dialog.choose({ title: section.name, choices });
    if (choice === 'left') onMoveList(-1);
    if (choice === 'right') onMoveList(1);
    if (choice === 'rename') {
      const value = await dialog.prompt({
        title: t('todo.board.renameList'),
        label: t('todo.board.listName'),
        initialValue: section.name,
        confirmLabel: t('common.save'),
      });
      if (value && value !== section.name) rename.mutate({ id: section.id, name: value });
    }
    if (choice === 'delete') {
      const ok = await dialog.confirm({
        title: t('todo.board.deleteListTitle', { name: section.name }),
        message: t('todo.board.deleteListMessage'),
        confirmLabel: t('common.delete'),
        destructive: true,
      });
      if (ok) remove.mutate(section.id);
    }
  };

  const { spacing, radius, colors } = useTheme();
  const isOver = drag?.overList === column.id;
  // Where the drop placeholder goes, among the cards other than the dragged one.
  const visible = column.cards.filter((c) => c.id !== drag?.cardId);
  const placeholderBefore = isOver ? (visible[drag!.overIndex]?.id ?? 'end') : null;

  const placeholder = (
    <View
      key="placeholder"
      style={{
        height: Math.max(drag?.height ?? 40, 36),
        borderRadius: radius.md,
        backgroundColor: colors.surfacePressed,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
      }}
    />
  );

  return (
    <SurfaceScope>
      <View
        id={listDomId(column.id)}
        accessibilityLabel={name}
        style={{
          width,
          backgroundColor: withAlpha(colors.surfaceMuted, 0.94),
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isOver ? colors.primary : colors.border,
          boxShadow: '0 6px 18px rgba(11, 18, 32, 0.12)',
          ...(webGlass as object),
          padding: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm, minHeight: 36 }}>
          {accent ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} /> : null}
          <AppText variant="subheading" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
            {name}
            <AppText variant="caption" tone="textSubtle">
              {'  '}
              {column.cards.length}
            </AppText>
          </AppText>
          {column.section ? (
            <IconButton icon="more-horizontal" size={18} label={t('todo.board.listActions', { name })} onPress={menu} />
          ) : null}
        </View>

        {column.cards.map((task) => (
          <View key={task.id} style={{ gap: spacing.sm }}>
            {placeholderBefore === task.id ? placeholder : null}
            <BoardCard
              task={task}
              today={today}
              onOpen={onOpen}
              onToggle={onToggle}
              onLongPress={draggable ? onLongPress : undefined}
              hidden={drag?.cardId === task.id}
            />
          </View>
        ))}
        {placeholderBefore === 'end' ? placeholder : null}

        {adding ? (
          <Composer boardId={boardId} sectionId={targetList} defaultPriority={priority} today={today} onClose={() => setAdding(false)} />
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t('todo.board.addCardIn', { name })}
            style={(s) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              minHeight: 40,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: interaction(s).hovered ? colors.surfacePressed : 'transparent',
            })}
          >
            <Icon name="plus" size={16} color={colors.textMuted} />
            <AppText variant="smallStrong" tone="textMuted">
              {t('todo.board.addACard')}
            </AppText>
          </Pressable>
        )}

        {column.done.length ? (
          <>
            <Pressable
              onPress={() => setShowDone((v) => !v)}
              accessibilityRole="button"
              aria-expanded={showDone}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 28 }}
            >
              <Icon name={showDone ? 'chevron-down' : 'chevron-right'} size={14} color={colors.textSubtle} />
              <AppText variant="caption" tone="textSubtle">
                {t('todo.board.completed', { count: column.done.length })}
              </AppText>
            </Pressable>
            {showDone
              ? column.done.map((task) => <BoardCard key={task.id} task={task} today={today} onOpen={onOpen} onToggle={onToggle} />)
              : null}
          </>
        ) : null}
      </View>
    </SurfaceScope>
  );
}

/** Inline "add a card" box: Enter adds and keeps it open for the next one. */
function Composer({
  boardId,
  sectionId,
  defaultPriority,
  today,
  onClose,
}: {
  boardId: string;
  sectionId: string | null;
  defaultPriority?: TaskPriority;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, radius, colors, typography } = useTheme();
  const priorityColors = usePriorityColors();
  const add = useQuickAddTask();
  const structure = useTodoStructure();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(defaultPriority ?? 4);

  const submit = () => {
    const parsed = parseQuickTask(text, { today, projects: structure.data?.projects ?? [] });
    if (!parsed.title) return;
    add.mutate({
      title: parsed.title,
      dueDate: parsed.dueDate ?? null,
      priority: parsed.priority ?? priority,
      tagNames: parsed.tagNames,
      projectId: boardId === GENERAL_BOARD ? null : boardId,
      sectionId,
    });
    setText('');
  };

  return (
    <View style={{ gap: spacing.sm }} {...{ dataSet: { nodrag: '' } }}>
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        // Enter adds the card and keeps the box open for the next one.
        {...(Platform.OS === 'web' ? { blurOnSubmit: false } : { submitBehavior: 'submit' as const })}
        onSubmitEditing={submit}
        onKeyPress={(e) => {
          if (Platform.OS === 'web' && e.nativeEvent.key === 'Escape') onClose();
        }}
        placeholder={t('todo.board.cardPlaceholder')}
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel={t('todo.board.cardPlaceholder')}
        style={
          {
            minHeight: 44,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.primary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
            fontSize: typography.body.fontSize,
            outlineStyle: 'none',
          } as object
        }
      />
      {/* Priority in one tap (Planner-style flags). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} accessibilityRole="radiogroup">
        {PRIORITIES.map((p) => {
          const on = p === priority;
          const c = priorityColors[p];
          return (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={t(`todo.priority.p${p}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: spacing.sm,
                minHeight: 30,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? c : colors.border,
                backgroundColor: on ? withAlpha(c, 0.14) : colors.surface,
              }}
            >
              <Icon name={p === 4 ? 'minus' : 'flag'} size={12} color={on ? c : colors.textSubtle} />
              {on ? (
                <AppText variant="caption" color={c}>
                  {t(`todo.board.priorityShort${p}`)}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Button label={t('todo.board.addCard')} size="sm" onPress={submit} disabled={!text.trim()} loading={add.isPending} />
        <IconButton icon="x" label={t('common.cancel')} onPress={onClose} />
      </View>
    </View>
  );
}

/** Frosted glass on the web, so lists read well on any wallpaper. */
const webGlass = Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {};
