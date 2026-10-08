import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { useTheme } from '@/theme';
import { useCreateArea, useDeleteArea, useRenameArea, useTasks, useTodoStructure } from '../hooks';
import { openCounts } from '../selectors';
import type { Project, TaskView, TodoTarget } from '../types';

export const SMART_VIEWS: { view: TaskView; icon: IconName }[] = [
  { view: 'today', icon: 'sun' },
  { view: 'inbox', icon: 'inbox' },
  { view: 'upcoming', icon: 'calendar' },
  { view: 'all', icon: 'list' },
  { view: 'priorities', icon: 'flag' },
  { view: 'completed', icon: 'check-circle' },
];

interface Props {
  target: TodoTarget;
  counts: Record<string, number>;
  onSelect: (target: TodoTarget) => void;
  onNewProject: (areaId: string | null) => void;
  /** Phone mode: only the projects tree (views are in the tab bar). */
  projectsOnly?: boolean;
}

function NavItem({
  icon,
  label,
  count,
  active,
  color,
  onPress,
  indent = 0,
}: {
  icon: IconName;
  label: string;
  count?: number;
  active: boolean;
  color?: string;
  onPress: () => void;
  indent?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      aria-selected={active}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 40,
        paddingLeft: spacing.sm + indent * 14,
        paddingRight: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: active ? colors.primarySoft : interaction(s).hovered ? colors.surfaceMuted : 'transparent',
      })}
    >
      {color ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginHorizontal: 3 }} />
      ) : (
        <Icon name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
      )}
      <AppText variant={active ? 'bodyStrong' : 'body'} tone={active ? 'primary' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </AppText>
      {count ? (
        <AppText variant="caption" tone="textSubtle">
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** ToDo navigation: smart views + Areas → Projects tree (section 25/27). */
export function TodoNav({ target, counts, onSelect, onNewProject, projectsOnly }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const structure = useTodoStructure();
  const tasks = useTasks();
  const createArea = useCreateArea();
  const renameArea = useRenameArea();
  const deleteArea = useDeleteArea();
  const { byProject } = openCounts(tasks.data ?? []);
  const areas = structure.data?.areas ?? [];
  const projects = (structure.data?.projects ?? []).filter((p) => !p.archived);
  const loose = projects.filter((p) => !p.areaId || !areas.some((a) => a.id === p.areaId));

  const isActive = (tg: TodoTarget) => JSON.stringify(tg) === JSON.stringify(target);
  const projectItem = (p: Project, indent: number) => (
    <NavItem
      key={p.id}
      icon="folder"
      color={p.color}
      label={p.name}
      count={byProject.get(p.id)}
      indent={indent}
      active={isActive({ kind: 'project', projectId: p.id })}
      onPress={() => onSelect({ kind: 'project', projectId: p.id })}
    />
  );

  const newArea = async () => {
    const name = await dialog.prompt({
      title: t('todo.areas.new'),
      label: t('todo.areas.name'),
      placeholder: t('todo.areas.placeholder'),
      confirmLabel: t('common.create'),
    });
    if (name) createArea.mutate(name);
  };
  const editArea = async (id: string, current: string) => {
    const name = await dialog.prompt({
      title: t('todo.areas.rename'),
      label: t('todo.areas.name'),
      initialValue: current,
      confirmLabel: t('common.save'),
    });
    if (name && name !== current) renameArea.mutate({ id, name });
  };
  const removeArea = async (id: string, name: string) => {
    const ok = await dialog.confirm({
      title: t('todo.areas.deleteTitle', { name }),
      message: t('todo.areas.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) deleteArea.mutate(id);
  };

  return (
    <View style={{ gap: spacing.xxs }}>
      {projectsOnly
        ? null
        : SMART_VIEWS.map(({ view, icon }) => (
            <NavItem
              key={view}
              icon={icon}
              label={t(`todo.views.${view}`)}
              count={view === 'completed' ? undefined : counts[view]}
              active={isActive({ kind: 'view', view })}
              onPress={() => onSelect({ kind: 'view', view })}
            />
          ))}
      {projectsOnly ? null : (
        <NavItem
          icon="hash"
          label={t('todo.views.tags')}
          active={target.kind === 'tags' || target.kind === 'tag'}
          onPress={() => onSelect({ kind: 'tags' })}
        />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: projectsOnly ? 0 : spacing.md, paddingLeft: spacing.sm }}>
        <AppText variant="overline" tone="textMuted" style={{ flex: 1 }}>
          {t('todo.views.projects')}
        </AppText>
        <IconButton icon="folder-plus" size={16} label={t('todo.projects.new')} onPress={() => onNewProject(null)} />
        <IconButton icon="layers" size={16} label={t('todo.areas.new')} onPress={() => void newArea()} />
      </View>
      {areas.map((area) => (
        <View key={area.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.sm, minHeight: 36 }}>
            <Icon name="layers" size={14} color={area.color} />
            <AppText variant="smallStrong" style={{ flex: 1, marginLeft: spacing.sm }} numberOfLines={1}>
              {area.name}
            </AppText>
            <IconButton icon="plus" size={14} label={`${t('todo.projects.new')}: ${area.name}`} onPress={() => onNewProject(area.id)} />
            <IconButton
              icon="edit-2"
              size={14}
              label={`${t('todo.areas.rename')}: ${area.name}`}
              onPress={() => void editArea(area.id, area.name)}
            />
            <IconButton
              icon="trash-2"
              size={14}
              label={`${t('common.delete')}: ${area.name}`}
              onPress={() => void removeArea(area.id, area.name)}
            />
          </View>
          {projects.filter((p) => p.areaId === area.id).map((p) => projectItem(p, 1))}
          {!projects.some((p) => p.areaId === area.id) ? (
            <AppText variant="caption" tone="textSubtle" style={{ paddingLeft: spacing.xxl, paddingBottom: spacing.xs }}>
              {t('todo.areas.empty')}
            </AppText>
          ) : null}
        </View>
      ))}
      {loose.map((p) => projectItem(p, 0))}
      {!projects.length && !areas.length ? (
        <AppText variant="small" tone="textSubtle" style={{ paddingLeft: spacing.sm }}>
          {t('todo.projects.none')}
        </AppText>
      ) : null}
    </View>
  );
}
