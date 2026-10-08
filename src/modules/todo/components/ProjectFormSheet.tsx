import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/forms/Chips';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { accentPalette } from '@/theme';
import { useCreateProject, useTodoStructure, useUpdateProject } from '../hooks';
import type { Project } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  project?: Project | null;
  defaultAreaId?: string | null;
  onCreated?: (project: Project) => void;
}

function ProjectForm({ onClose, project, defaultAreaId, onCreated }: Props) {
  const { t } = useTranslation();
  const structure = useTodoStructure();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState<string>(project?.color ?? accentPalette[3]);
  const [areaId, setAreaId] = useState<string | null>(project?.areaId ?? defaultAreaId ?? null);
  const areas = structure.data?.areas ?? [];

  const save = () => {
    if (!name.trim()) return;
    if (project) update.mutate({ id: project.id, patch: { name, color, areaId } }, { onSuccess: onClose });
    else
      create.mutate(
        { name, color, areaId },
        {
          onSuccess: (p) => {
            onCreated?.(p);
            onClose();
          },
        },
      );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={project ? t('todo.projects.edit') : t('todo.projects.new')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!name.trim()} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <TextField
        label={t('todo.projects.name')}
        placeholder={t('todo.projects.namePlaceholder')}
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={save}
      />
      <ChipGroup<string>
        accessibilityLabel={t('todo.projects.area')}
        selected={areaId ?? 'none'}
        onToggle={(id) => setAreaId(id === 'none' ? null : id)}
        options={[{ value: 'none', label: t('todo.projects.noArea') }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
      />
      <ColorPicker value={color} onChange={setColor} />
    </Sheet>
  );
}

export function ProjectFormSheet(props: Props) {
  return props.visible ? <ProjectForm {...props} /> : null;
}
