import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { ChipGroup } from '@/components/forms/Chips';
import { DateField } from '@/components/forms/DateTimeFields';
import { RecurrenceEditor } from '@/components/forms/RecurrenceEditor';
import { LinkChips } from '@/components/links/LinkChips';
import { LinkPickerSheet } from '@/components/links/LinkPickerSheet';
import { useLinkSources } from '@/components/links/useLinks';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/theme';
import type { EntityRef } from '@/types/entity';
import type { RecurrenceRule } from '@/types/recurrence';
import { formatShortDate, fromDateKey, parseTime, todayKey, tomorrowKey, type DateKey } from '@/utils/date';
import { describeReminder, REMINDER_PRESETS } from '@/utils/recurrenceText';
import { useDeleteTask, useEnsureTag, useQuickAddTask, useTags, useTasks, useTodoStructure, useToggleTask, useUpdateTask } from '../hooks';
import { todoMeta } from '../meta';
import { PRIORITIES, usePriorityColors } from '../priority';
import { subtasksOf } from '../selectors';
import type { Task, TaskPriority, TaskStatus } from '../types';

interface Props {
  taskId: string | null;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="overline" tone="textMuted">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'archived'];
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

function Editor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, colors } = useTheme();
  const dialog = useDialog();
  const toast = useToast();
  const priorityColors = usePriorityColors();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const toggle = useToggleTask();
  const addSubtask = useQuickAddTask();
  const ensureTag = useEnsureTag();
  const allTasks = useTasks();
  const structure = useTodoStructure();
  const tags = useTags();
  const linkSources = useLinkSources(todoMeta.id);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? task.notes ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState<DateKey | null>(task.dueDate ?? null);
  const [timeText, setTimeText] = useState(task.dueTime ?? '');
  const [deadline, setDeadline] = useState<DateKey | null>(task.deadline ?? null);
  const [projectId, setProjectId] = useState<string | null>(task.projectId ?? null);
  const [sectionId, setSectionId] = useState<string | null>(task.sectionId ?? null);
  const [tagIds, setTagIds] = useState<string[]>(task.tagIds);
  const [newTag, setNewTag] = useState('');
  const [assignee, setAssignee] = useState(task.assigneeName ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(task.recurrence ?? null);
  const [reminders, setReminders] = useState<number[]>(task.reminders);
  const [urls, setUrls] = useState<string[]>(task.links);
  const [urlText, setUrlText] = useState('');
  const [refs, setRefs] = useState<EntityRef[]>(task.attachments ?? []);
  const [linking, setLinking] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [dateValid, setDateValid] = useState(true);

  const projects = (structure.data?.projects ?? []).filter((p) => !p.archived || p.id === projectId);
  const sections = (structure.data?.sections ?? []).filter((s) => s.projectId === projectId);
  const subtasks = useMemo(() => subtasksOf(allTasks.data ?? [], task.id), [allTasks.data, task.id]);
  const time = timeText.trim() ? parseTime(timeText) : null;
  const timeInvalid = !!timeText.trim() && !time;
  const canSave = !!title.trim() && !timeInvalid && dateValid;

  const dateMode = !dueDate ? 'none' : dueDate === todayKey() ? 'today' : dueDate === tomorrowKey() ? 'tomorrow' : 'pick';

  const save = () => {
    if (!canSave) return;
    update.mutate(
      {
        id: task.id,
        patch: {
          title,
          description: description.trim() || null,
          status,
          priority,
          dueDate,
          dueTime: dueDate ? time : null,
          deadline,
          projectId,
          sectionId: projectId ? sectionId : null,
          tagIds,
          assigneeName: assignee.trim() || null,
          recurrence: dueDate ? recurrence : null,
          reminders: dueDate ? reminders : [],
          links: urls,
          attachments: refs,
        },
      },
      { onSuccess: onClose },
    );
  };

  const remove = async () => {
    const ok = await dialog.confirm({
      title: t('todo.deleteTitle'),
      message: subtasks.length
        ? t('todo.deleteWithSubtasks', { title: task.title, count: subtasks.length })
        : t('todo.deleteMessage', { title: task.title }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) del.mutate(task.id, { onSuccess: onClose });
  };

  const addTag = () => {
    const name = newTag.trim().replace(/^#/, '');
    if (!name) return;
    ensureTag.mutate(name, {
      onSuccess: (tag) => {
        setTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
        setNewTag('');
      },
    });
  };

  const addUrl = () => {
    const v = urlText.trim();
    if (!v) return;
    if (!isUrl(v)) {
      toast.show(t('todo.detail.invalidUrl'), 'error');
      return;
    }
    setUrls((prev) => [...new Set([...prev, v])]);
    setUrlText('');
  };

  const createSubtask = () => {
    if (!subtaskText.trim()) return;
    addSubtask.mutate(
      { title: subtaskText, parentTaskId: task.id, projectId: task.projectId ?? null, sectionId: task.sectionId ?? null },
      { onSuccess: () => setSubtaskText('') },
    );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('todo.detail.title')}
      subtitle={t('todo.detail.createdBy', { date: formatShortDate(new Date(task.createdAt), locale) })}
      footer={
        <>
          <Button label={t('common.delete')} variant="ghost" icon="trash-2" onPress={() => void remove()} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={update.isPending} />
        </>
      }
    >
      <TextField label={t('todo.detail.name')} value={title} onChangeText={setTitle} />
      <TextField
        label={t('todo.detail.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('common.optional')}
        multiline
      />

      <Section title={t('todo.detail.status')}>
        <ChipGroup<TaskStatus>
          accessibilityLabel={t('todo.detail.status')}
          selected={status}
          onToggle={setStatus}
          options={STATUSES.map((s) => ({ value: s, label: t(`todo.status.${s}`) }))}
        />
      </Section>

      <Section title={t('todo.detail.priority')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {PRIORITIES.map((p) => (
            <ChipGroup<TaskPriority>
              key={p}
              accessibilityLabel={t(`todo.priority.p${p}`)}
              selected={priority}
              onToggle={setPriority}
              color={priorityColors[p]}
              options={[{ value: p, label: t(`todo.priority.p${p}`) }]}
            />
          ))}
        </View>
      </Section>

      <Section title={t('todo.detail.date')}>
        <ChipGroup<string>
          accessibilityLabel={t('todo.detail.date')}
          selected={dateMode}
          onToggle={(m) => {
            if (m === 'none') setDueDate(null);
            else if (m === 'today') setDueDate(todayKey());
            else if (m === 'tomorrow') setDueDate(tomorrowKey());
            else setDueDate(dueDate ?? todayKey());
          }}
          options={[
            { value: 'none', label: t('todo.quickAdd.noDate') },
            { value: 'today', label: t('common.today') },
            { value: 'tomorrow', label: t('common.tomorrow') },
            { value: 'pick', label: t('todo.detail.pickDate') },
          ]}
        />
        {dueDate ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <View style={{ flexGrow: 2, flexBasis: 200 }}>
              <DateField label={t('todo.detail.dueDate')} value={dueDate} onChange={setDueDate} onValidityChange={setDateValid} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 120 }}>
              <TextField
                label={t('todo.detail.time')}
                value={timeText}
                onChangeText={setTimeText}
                placeholder={t('todo.detail.noTime')}
                leftIcon="clock"
                inputMode="numeric"
                error={timeInvalid ? t('forms.invalidTime') : null}
              />
            </View>
          </View>
        ) : null}
      </Section>

      {dueDate ? (
        <>
          <Section title={t('recurrence.label')}>
            <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={dueDate} />
            {recurrence ? (
              <AppText variant="caption" tone="textSubtle">
                {t('todo.detail.recurringHint')}
              </AppText>
            ) : null}
          </Section>
          <Section title={t('reminders.label')}>
            <ChipGroup<number>
              multi
              accessibilityLabel={t('reminders.label')}
              selected={reminders}
              onToggle={(m) => setReminders((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
              options={REMINDER_PRESETS.map((m) => ({ value: m, label: describeReminder(m, t) }))}
            />
          </Section>
        </>
      ) : null}

      <Section title={t('todo.detail.deadline')}>
        {deadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <DateField label={t('todo.detail.deadlineLabel')} value={deadline} onChange={setDeadline} />
            </View>
            <IconButton icon="x" label={t('todo.detail.removeDeadline')} onPress={() => setDeadline(null)} />
          </View>
        ) : (
          <Button
            label={t('todo.detail.addDeadline')}
            icon="flag"
            size="sm"
            variant="secondary"
            onPress={() => setDeadline(tomorrowKey(fromDateKey(dueDate ?? todayKey())))}
          />
        )}
      </Section>

      <Section title={t('todo.detail.project')}>
        <ChipGroup<string>
          accessibilityLabel={t('todo.detail.project')}
          selected={projectId ?? 'inbox'}
          onToggle={(id) => {
            setProjectId(id === 'inbox' ? null : id);
            setSectionId(null);
          }}
          options={[{ value: 'inbox', label: t('todo.views.inbox') }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
        {projectId && sections.length ? (
          <ChipGroup<string>
            accessibilityLabel={t('todo.detail.section')}
            selected={sectionId ?? 'none'}
            onToggle={(id) => setSectionId(id === 'none' ? null : id)}
            options={[{ value: 'none', label: t('todo.detail.noSection') }, ...sections.map((s) => ({ value: s.id, label: s.name }))]}
          />
        ) : null}
      </Section>

      <Section title={t('todo.detail.tags')}>
        {tags.data?.length ? (
          <ChipGroup<string>
            multi
            accessibilityLabel={t('todo.detail.tags')}
            selected={tagIds}
            onToggle={(id) => setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
            options={tags.data.map((tag) => ({ value: tag.id, label: `#${tag.name}` }))}
          />
        ) : null}
        <TextField
          compact
          leftIcon="hash"
          placeholder={t('todo.detail.newTag')}
          value={newTag}
          onChangeText={setNewTag}
          onSubmitEditing={addTag}
          submitBehavior="submit"
        />
      </Section>

      <Section title={t('todo.detail.assignee')}>
        <TextField compact leftIcon="user" placeholder={t('todo.detail.assigneePlaceholder')} value={assignee} onChangeText={setAssignee} />
        <AppText variant="caption" tone="textSubtle">
          {t('todo.detail.assigneeNote')}
        </AppText>
      </Section>

      <Section title={t('todo.subtasks.title', { count: subtasks.length })}>
        {subtasks.map((sub) => (
          <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 }}>
            <Pressable
              onPress={() => toggle.mutate(sub)}
              accessibilityRole="checkbox"
              aria-checked={sub.status === 'completed'}
              accessibilityLabel={sub.title}
              hitSlop={8}
            >
              <Icon
                name={sub.status === 'completed' ? 'check-circle' : 'circle'}
                size={20}
                color={sub.status === 'completed' ? colors.success : colors.borderStrong}
              />
            </Pressable>
            <AppText
              variant="body"
              tone={sub.status === 'completed' ? 'textSubtle' : 'text'}
              style={[{ flex: 1 }, sub.status === 'completed' ? { textDecorationLine: 'line-through' } : null]}
            >
              {sub.title}
            </AppText>
            <IconButton icon="x" size={16} label={`${t('common.delete')}: ${sub.title}`} onPress={() => del.mutate(sub.id)} />
          </View>
        ))}
        <TextField
          compact
          leftIcon="corner-down-right"
          placeholder={t('todo.subtasks.add')}
          value={subtaskText}
          onChangeText={setSubtaskText}
          onSubmitEditing={createSubtask}
          submitBehavior="submit"
          returnKeyType="done"
        />
      </Section>

      <Section title={t('todo.detail.links')}>
        {urls.map((u) => (
          <View key={u} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="link" size={14} color={colors.primary} />
            <Pressable onPress={() => void Linking.openURL(u)} accessibilityRole="link" style={{ flex: 1 }}>
              <AppText variant="small" tone="primary" numberOfLines={1}>
                {u}
              </AppText>
            </Pressable>
            <IconButton
              icon="x"
              size={14}
              label={`${t('links.remove')}: ${u}`}
              onPress={() => setUrls((prev) => prev.filter((x) => x !== u))}
            />
          </View>
        ))}
        <TextField
          compact
          leftIcon="link"
          placeholder="https://…"
          value={urlText}
          onChangeText={setUrlText}
          onSubmitEditing={addUrl}
          submitBehavior="submit"
          autoCapitalize="none"
          keyboardType="url"
        />
        {linkSources.length ? (
          <>
            <LinkChips
              refs={refs}
              onRemove={(ref) => setRefs((prev) => prev.filter((r) => !(r.module === ref.module && r.id === ref.id)))}
            />
            <Button label={t('links.add')} icon="paperclip" variant="secondary" size="sm" onPress={() => setLinking(true)} />
          </>
        ) : null}
      </Section>

      <LinkPickerSheet visible={linking} onClose={() => setLinking(false)} ownerModuleId={todoMeta.id} value={refs} onChange={setRefs} />
    </Sheet>
  );
}

/** Task detail editor (mounted only while open). */
export function TaskDetailSheet({ taskId, onClose }: Props) {
  const tasks = useTasks();
  const task = taskId ? tasks.data?.find((x) => x.id === taskId) : undefined;
  if (!taskId || !task) return null;
  return <Editor key={task.id} task={task} onClose={onClose} />;
}
