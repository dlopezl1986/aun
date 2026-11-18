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
import { isLight, withAlpha } from '@/utils/color';
import {
  useCreateSection,
  useDeleteSection,
  useMoveTask,
  useQuickAddTask,
  useRenameSection,
  useReorderSections,
  useTodoStructure,
  useToggleTask,
} from '../hooks';
import { parseQuickTask } from '../quickParse';
import type { Section, Task } from '../types';
import { BoardCard } from './BoardCard';
import { applyMove, boardColumns, GENERAL_BOARD, LOOSE_LIST, moveCard, type BoardColumn } from './model';
import { dragSupported, listDomId, useBoardDrag } from './useBoardDrag';

interface Props {
  boardId: string;
  /** Board colour: the canvas behind the lists, as in Trello. */
  color: string;
  tasks: Task[];
  sections: Section[];
  today: string;
  onOpen: (task: Task) => void;
}

type PendingMove = { cardId: string; toColumn: string; orderedIds: string[] } | null;

export function BoardView({ boardId, color, tasks, sections, today, onOpen }: Props) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const { spacing, radius, mode } = useTheme();
  const { isCompact, width } = useBreakpoint();
  const move = useMoveTask();
  const reorder = useReorderSections();
  const createSection = useCreateSection();
  const toggle = useToggleTask();
  const [pending, setPending] = useState<PendingMove>(null);

  const base = useMemo(() => boardColumns(tasks, boardId, sections), [tasks, boardId, sections]);
  const columns = useMemo(() => applyMove(base, pending), [base, pending]);
  const listName = (c: BoardColumn) => c.section?.name ?? t('todo.board.defaultLists.todo');

  const commitMove = (cardId: string, toColumn: string, index: number) => {
    const from = columns.find((c) => c.cards.some((x) => x.id === cardId));
    if (!from) return;
    const fromIndex = from.cards.findIndex((x) => x.id === cardId);
    if (from.id === toColumn && fromIndex === index) return;
    const orderedIds = moveCard(columns, cardId, toColumn, index);
    const next = { cardId, toColumn, orderedIds };
    setPending(next);
    move.mutate(
      { id: cardId, sectionId: toColumn === LOOSE_LIST ? null : toColumn, orderedIds },
      { onSettled: () => setPending((p) => (p === next ? null : p)) },
    );
  };

  const { drag, rootRef, scrollerRef, justDragged } = useBoardDrag(commitMove);

  /** Native apps (no drag): long press → choose the list. */
  const moveMenu = async (task: Task) => {
    const value = await dialog.choose({
      title: t('todo.board.moveTo'),
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

  // Text straight on the board colour (light boards get dark text).
  const onBoard = mode !== 'dark' && isLight(color) ? '#0B1220' : '#FFFFFF';

  const draggingCard = drag ? tasks.find((x) => x.id === drag.cardId) : undefined;

  return (
    <View
      ref={rootRef as never}
      style={{
        marginHorizontal: isCompact ? -spacing.lg : 0,
        paddingTop: spacing.md,
        minHeight: 440,
        borderRadius: isCompact ? 0 : radius.lg,
        // Same colour in dark mode, dimmed so the lists stand out.
        backgroundColor: mode === 'dark' ? withAlpha(color, 0.45) : color,
      }}
    >
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
            backgroundColor: interaction(s).hovered ? 'rgba(255, 255, 255, 0.34)' : 'rgba(255, 255, 255, 0.24)',
          })}
        >
          <Icon name="plus" size={16} color={onBoard} />
          <AppText variant="smallStrong" color={onBoard}>
            {t('todo.board.addAnotherList')}
          </AppText>
        </Pressable>
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
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isOver ? colors.primary : colors.border,
          padding: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.sm, minHeight: 36 }}>
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
              onLongPress={onLongPress}
              hidden={drag?.cardId === task.id}
            />
          </View>
        ))}
        {placeholderBefore === 'end' ? placeholder : null}

        {adding ? (
          <Composer boardId={boardId} column={column} today={today} onClose={() => setAdding(false)} />
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
function Composer({ boardId, column, today, onClose }: { boardId: string; column: BoardColumn; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors, typography } = useTheme();
  const add = useQuickAddTask();
  const structure = useTodoStructure();
  const [text, setText] = useState('');

  const submit = () => {
    const parsed = parseQuickTask(text, { today, projects: structure.data?.projects ?? [] });
    if (!parsed.title) return;
    add.mutate({
      title: parsed.title,
      dueDate: parsed.dueDate ?? null,
      priority: parsed.priority,
      tagNames: parsed.tagNames,
      projectId: boardId === GENERAL_BOARD ? null : boardId,
      sectionId: column.section?.id ?? null,
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Button label={t('todo.board.addCard')} size="sm" onPress={submit} disabled={!text.trim()} loading={add.isPending} />
        <IconButton icon="x" label={t('common.cancel')} onPress={onClose} />
      </View>
    </View>
  );
}
