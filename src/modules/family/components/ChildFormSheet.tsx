import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import type { UploadSource } from '@/storage/providers/types';
import { accentPalette, useTheme } from '@/theme';
import { formatDateInput, parseDateInput } from '@/utils/date';
import { useCreateChild, useSetChildPhoto, useUpdateChild } from '../hooks';
import { pickProfilePhoto } from '../photo';
import { SIZE_PRESETS, type Member, type MemberField, type MemberRelation, type MemberSize } from '../types';
import { ChildAvatar } from './ChildAvatar';

export const RELATIONS: MemberRelation[] = ['child', 'partner', 'parent', 'grandparent', 'sibling', 'other'];

interface Props {
  visible: boolean;
  onClose: () => void;
  child?: Member | null;
  onCreated?: (member: Member) => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="overline" tone="textMuted">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="textSubtle">
          {hint}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

/** Editable label/value rows (custom sizes, "más datos"). */
function PairRows({
  rows,
  onChange,
  labelPlaceholder,
  valuePlaceholder,
  addLabel,
}: {
  rows: { label: string; value: string }[];
  onChange: (rows: { label: string; value: string }[]) => void;
  labelPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField
              compact
              value={r.label}
              placeholder={labelPlaceholder}
              onChangeText={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, label: v } : x)))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              compact
              value={r.value}
              placeholder={valuePlaceholder}
              onChangeText={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, value: v } : x)))}
            />
          </View>
          <IconButton icon="x" size={16} label={t('common.delete')} onPress={() => onChange(rows.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button
        label={addLabel}
        icon="plus"
        variant="ghost"
        size="sm"
        onPress={() => onChange([...rows, { label: '', value: '' }])}
        style={{ alignSelf: 'flex-start' }}
      />
    </View>
  );
}

function MemberForm({ onClose, child, onCreated }: Props) {
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const toast = useToast();
  const create = useCreateChild();
  const update = useUpdateChild();
  const setPhoto = useSetChildPhoto();
  const [relation, setRelation] = useState<MemberRelation>(child?.relation ?? 'child');
  const [name, setName] = useState(child?.name ?? '');
  const [color, setColor] = useState<string>(child?.color ?? accentPalette[8]);
  const [birth, setBirth] = useState(child?.birthDate ? formatDateInput(child.birthDate) : '');
  const [phone, setPhone] = useState(child?.phone ?? '');
  const [email, setEmail] = useState(child?.email ?? '');
  const [school, setSchool] = useState(child?.school ?? '');
  const [schoolClass, setSchoolClass] = useState(child?.schoolClass ?? '');
  const [occupation, setOccupation] = useState(child?.occupation ?? '');
  const presetSizes = new Set<string>(SIZE_PRESETS);
  const [sizes, setSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries((child?.sizes ?? []).filter((s) => presetSizes.has(s.key)).map((s) => [s.key, s.value])),
  );
  const [customSizes, setCustomSizes] = useState(() =>
    (child?.sizes ?? []).filter((s) => !presetSizes.has(s.key)).map((s) => ({ label: s.key, value: s.value })),
  );
  const [health, setHealth] = useState({
    allergies: child?.health?.allergies ?? '',
    bloodType: child?.health?.bloodType ?? '',
    doctor: child?.health?.doctor ?? '',
    medication: child?.health?.medication ?? '',
    notes: child?.health?.notes ?? '',
  });
  const [extra, setExtra] = useState<MemberField[]>(child?.extraFields ?? []);
  const [info, setInfo] = useState(child?.importantInfo ?? '');
  const [notes, setNotes] = useState(child?.notes ?? '');
  const [pendingPhoto, setPendingPhoto] = useState<UploadSource | null>(null);

  const birthKey = birth.trim() ? parseDateInput(birth) : null;
  const birthError = birth.trim() && !birthKey ? t('forms.invalidDate') : null;
  const canSave = !!name.trim() && !birthError;
  const isChild = relation === 'child';

  const save = () => {
    if (!canSave) return;
    const allSizes: MemberSize[] = [
      ...SIZE_PRESETS.filter((k) => sizes[k]?.trim()).map((k) => ({ key: k, value: sizes[k] })),
      ...customSizes.filter((s) => s.label.trim() && s.value.trim()).map((s) => ({ key: s.label.trim(), value: s.value })),
    ];
    const input = {
      name,
      color,
      relation,
      birthDate: birthKey,
      phone,
      email,
      school: isChild ? school : '',
      schoolClass: isChild ? schoolClass : '',
      occupation: isChild ? '' : occupation,
      sizes: allSizes,
      health: Object.values(health).some((v) => v.trim()) ? health : null,
      extraFields: extra.filter((f) => f.label.trim() && f.value.trim()),
      importantInfo: info,
      notes,
    };
    if (child) update.mutate({ id: child.id, input }, { onSuccess: onClose });
    else
      create.mutate(
        { ...input, photoSource: pendingPhoto },
        {
          onSuccess: (m) => {
            onCreated?.(m);
            onClose();
          },
        },
      );
  };

  const pick = async () => {
    const source = await pickProfilePhoto();
    if (source === 'denied') toast.show(t('family.photo.denied'), 'error');
    else if (source && child) setPhoto.mutate({ child, source });
    else if (source) setPendingPhoto(source);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={child ? t('family.editChild') : t('family.addMember')}
      subtitle={child ? undefined : t('family.calendarNote')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={create.isPending || update.isPending} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        {pendingPhoto ? (
          <Image
            source={{ uri: pendingPhoto.uri }}
            style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: color }}
            contentFit="cover"
          />
        ) : (
          <ChildAvatar child={{ name: name || '?', color, photo: child?.photo }} size={80} />
        )}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button
              label={child?.photo || pendingPhoto ? t('family.photo.change') : t('family.photo.add')}
              icon="camera"
              variant="secondary"
              size="sm"
              loading={setPhoto.isPending}
              onPress={() => void pick()}
            />
            {child?.photo ? (
              <Button label={t('family.photo.remove')} variant="ghost" size="sm" onPress={() => setPhoto.mutate({ child, source: null })} />
            ) : pendingPhoto ? (
              <Button label={t('family.photo.remove')} variant="ghost" size="sm" onPress={() => setPendingPhoto(null)} />
            ) : null}
          </View>
          <AppText variant="caption" tone="textSubtle">
            {t('family.photo.privacy')}
          </AppText>
        </View>
      </View>

      <Section title={t('family.form.relation')}>
        <ChipGroup<MemberRelation>
          accessibilityLabel={t('family.form.relation')}
          selected={relation}
          onToggle={setRelation}
          options={RELATIONS.map((r) => ({ value: r, label: t(`family.relations.${r}`) }))}
        />
      </Section>

      <TextField
        label={t('family.form.name')}
        value={name}
        onChangeText={setName}
        autoFocus={!child}
        placeholder={t('family.form.namePlaceholder')}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('family.form.birthDate')}
            value={birth}
            onChangeText={setBirth}
            placeholder={t('forms.datePlaceholder')}
            error={birthError}
            leftIcon="gift"
            inputMode="numeric"
          />
        </View>
      </View>
      <ColorPicker value={color} onChange={setColor} />

      <Section title={t('family.form.contact')}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              compact
              value={phone}
              onChangeText={setPhone}
              placeholder={t('family.form.phone')}
              leftIcon="phone"
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              compact
              value={email}
              onChangeText={setEmail}
              placeholder={t('family.form.email')}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      </Section>

      {isChild ? (
        <Section title={t('family.form.schoolSection')}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 2 }}>
              <TextField compact value={school} onChangeText={setSchool} placeholder={t('family.form.school')} leftIcon="book" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField compact value={schoolClass} onChangeText={setSchoolClass} placeholder={t('family.form.schoolClassPlaceholder')} />
            </View>
          </View>
        </Section>
      ) : (
        <TextField
          label={t('family.form.occupation')}
          value={occupation}
          onChangeText={setOccupation}
          leftIcon="briefcase"
          placeholder={t('family.form.occupationPlaceholder')}
        />
      )}

      <Section title={t('family.form.sizes')} hint={t('family.form.sizesHint')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SIZE_PRESETS.map((k) => (
            <View key={k} style={{ flexBasis: 140, flexGrow: 1 }}>
              <TextField
                compact
                label={t(`family.sizes.${k}`)}
                value={sizes[k] ?? ''}
                onChangeText={(v) => setSizes({ ...sizes, [k]: v })}
                placeholder="—"
              />
            </View>
          ))}
        </View>
        <PairRows
          rows={customSizes}
          onChange={setCustomSizes}
          labelPlaceholder={t('family.form.sizeLabel')}
          valuePlaceholder={t('family.form.sizeValue')}
          addLabel={t('family.form.addSize')}
        />
      </Section>

      <Section title={t('family.form.health')}>
        <TextField
          compact
          value={health.allergies}
          onChangeText={(v) => setHealth({ ...health, allergies: v })}
          placeholder={t('family.form.allergies')}
          leftIcon="alert-triangle"
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              compact
              value={health.bloodType}
              onChangeText={(v) => setHealth({ ...health, bloodType: v })}
              placeholder={t('family.form.bloodType')}
              leftIcon="droplet"
            />
          </View>
          <View style={{ flex: 2 }}>
            <TextField
              compact
              value={health.doctor}
              onChangeText={(v) => setHealth({ ...health, doctor: v })}
              placeholder={isChild ? t('family.form.pediatrician') : t('family.form.doctor')}
              leftIcon="activity"
            />
          </View>
        </View>
        <TextField
          compact
          value={health.medication}
          onChangeText={(v) => setHealth({ ...health, medication: v })}
          placeholder={t('family.form.medication')}
          leftIcon="plus-square"
        />
        <TextField
          compact
          value={health.notes}
          onChangeText={(v) => setHealth({ ...health, notes: v })}
          placeholder={t('family.form.healthNotes')}
          multiline
        />
      </Section>

      <Section title={t('family.form.extra')} hint={t('family.form.extraHint')}>
        <View style={{ borderRadius: radius.md }}>
          <PairRows
            rows={extra}
            onChange={setExtra}
            labelPlaceholder={t('family.form.extraLabel')}
            valuePlaceholder={t('family.form.extraValue')}
            addLabel={t('family.form.addExtra')}
          />
        </View>
      </Section>

      <TextField
        label={t('family.form.importantInfo')}
        value={info}
        onChangeText={setInfo}
        placeholder={t('family.form.importantInfoPlaceholder')}
        multiline
      />
      <TextField label={t('family.form.notes')} value={notes} onChangeText={setNotes} placeholder={t('common.optional')} multiline />
    </Sheet>
  );
}

/** The form mounts only while open, so its state starts fresh every time. */
export function ChildFormSheet(props: Props) {
  return props.visible ? <MemberForm {...props} /> : null;
}
