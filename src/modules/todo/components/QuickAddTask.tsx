import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import type { EntityRef } from '@/types/entity';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatShortDate, fromDateKey, tomorrowKey } from '@/utils/date';
import { useQuickAddTask, useTodoStructure } from '../hooks';
import { PRIORITIES, usePriorityColors } from '../priority';
import { parseQuickTask } from '../quickParse';
import type { TaskPriority } from '../types';

type When = 'none' | 'today' | 'tomorrow';

interface QuickAddTaskProps {
  today: string;
  defaultWhen?: When;
  /** Context: tasks added inside a project/section/tag land there. */
  projectId?: string | null;
  sectionId?: string | null;
  tagId?: string | null;
  /** Links the new task to another entity (e.g. a child). */
  attachments?: EntityRef[];
  autoFocus?: boolean;
  /** Called after a task is saved (e.g. to close a sheet). */
  onAdded?: () => void;
  compact?: boolean;
}

/**
 * Fast capture (section 28). Understands "mañana p1 #casa @proyecto viernes 15/03";
 * the chips are shortcuts for people who prefer tapping.
 */
export function QuickAddTask({
  today,
  defaultWhen = 'today',
  projectId,
  sectionId,
  tagId,
  attachments,
  autoFocus,
  onAdded,
  compact,
}: QuickAddTaskProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, radius, colors } = useTheme();
  const priorityColors = usePriorityColors();
  const add = useQuickAddTask();
  const structure = useTodoStructure();
  const [text, setText] = useState('');
  const [when, setWhen] = useState<When>(defaultWhen);
  const [priority, setPriority] = useState<TaskPriority>(4);

  const projects = useMemo(() => (structure.data?.projects ?? []).filter((p) => !p.archived), [structure.data]);
  const parsed = useMemo(() => parseQuickTask(text, { today, projects }), [text, today, projects]);
  const parsedProject = parsed.projectId ? projects.find((p) => p.id === parsed.projectId) : undefined;
  const hasTokens = !!(parsed.dueDate || parsed.priority || parsed.tagNames.length || parsed.projectId);

  const submit = () => {
    if (!parsed.title) return;
    const chipDate = when === 'today' ? today : when === 'tomorrow' ? tomorrowKey(fromDateKey(today)) : null;
    add.mutate(
      {
        title: parsed.title,
        dueDate: parsed.dueDate ?? chipDate,
        priority: parsed.priority ?? priority,
        projectId: parsed.projectId ?? projectId ?? null,
        sectionId: parsed.projectId && parsed.projectId !== projectId ? null : (sectionId ?? null),
        tagIds: tagId ? [tagId] : [],
        tagNames: parsed.tagNames,
        attachments,
      },
      {
        onSuccess: () => {
          setText('');
          onAdded?.();
        },
      },
    );
  };

  const chip = (key: string, label: string, active: boolean, onPress: () => void, color?: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={active}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 32,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? (color ?? colors.primary) : colors.border,
        backgroundColor: active ? withAlpha(color ?? colors.primary, 0.12) : 'transparent',
      }}
    >
      {color ? <Icon name="flag" size={12} color={color} /> : null}
      <AppText variant="caption" color={active ? (color ?? colors.primary) : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField
            autoFocus={autoFocus}
            leftIcon="plus"
            placeholder={t('todo.quickAdd.placeholder')}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            returnKeyType="done"
            submitBehavior="submit"
          />
        </View>
        <Button label={t('common.add')} onPress={submit} loading={add.isPending} disabled={!parsed.title} />
      </View>
      {hasTokens ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }} accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="textSubtle">
            {t('todo.quickAdd.detected')}
          </AppText>
          {parsed.dueDate ? <Badge label={formatShortDate(fromDateKey(parsed.dueDate), locale)} icon="calendar" tone="primary" /> : null}
          {parsed.priority ? <Badge label={`P${parsed.priority}`} icon="flag" color={priorityColors[parsed.priority]} /> : null}
          {parsedProject ? <Badge label={parsedProject.name} color={parsedProject.color} icon="folder" /> : null}
          {parsed.tagNames.map((n) => (
            <Badge key={n} label={`#${n}`} />
          ))}
        </View>
      ) : compact ? null : (
        <AppText variant="caption" tone="textSubtle">
          {t('todo.quickAdd.hint')}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
        {chip('none', t('todo.quickAdd.noDate'), when === 'none' && !parsed.dueDate, () => setWhen('none'))}
        {chip('today', t('common.today'), when === 'today' && !parsed.dueDate, () => setWhen('today'))}
        {chip('tomorrow', t('common.tomorrow'), when === 'tomorrow' && !parsed.dueDate, () => setWhen('tomorrow'))}
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.xs }} />
        {PRIORITIES.map((p) =>
          chip(`p${p}`, t(`todo.priority.short${p}`), (parsed.priority ?? priority) === p, () => setPriority(p), priorityColors[p]),
        )}
      </View>
    </View>
  );
}
