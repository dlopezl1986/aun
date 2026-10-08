import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { RadioRow } from '@/components/ui/RadioRow';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';
import { useAddMember, useMembers, useRemoveMember, useUpdateMember } from '../hooks';
import { familyMeta } from '../meta';
import type { FamilyMember, FamilyRelation, FamilyRole } from '../types';

const RELATIONS: FamilyRelation[] = ['partner', 'grandparent', 'caregiver', 'relative', 'other'];
const ROLES: FamilyRole[] = ['admin', 'editor', 'viewer'];

function MemberForm({ member, onClose }: { member: FamilyMember | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const add = useAddMember();
  const update = useUpdateMember();
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [relation, setRelation] = useState<FamilyRelation>(member?.relation ?? 'partner');
  const [role, setRole] = useState<FamilyRole>(member?.role ?? 'editor');
  const emailError = email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) ? t('family.sharing.invalidEmail') : null;

  const save = () => {
    if (!name.trim() || emailError) return;
    const input = { name, email, relation, role };
    if (member) update.mutate({ id: member.id, input }, { onSuccess: onClose });
    else add.mutate(input, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={member ? t('family.sharing.edit') : t('family.sharing.add')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button
            label={t('common.save')}
            onPress={save}
            disabled={!name.trim() || !!emailError}
            loading={add.isPending || update.isPending}
          />
        </>
      }
    >
      <TextField
        label={t('family.sharing.name')}
        value={name}
        onChangeText={setName}
        autoFocus
        placeholder={t('family.sharing.namePlaceholder')}
      />
      <TextField
        label={t('family.sharing.email')}
        value={email}
        onChangeText={setEmail}
        placeholder="nombre@email.com"
        hint={t('family.sharing.emailHint')}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        leftIcon="mail"
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('family.sharing.relation')}
        </AppText>
        <ChipGroup<FamilyRelation>
          accessibilityLabel={t('family.sharing.relation')}
          selected={relation}
          onToggle={setRelation}
          options={RELATIONS.map((r) => ({ value: r, label: t(`family.sharing.relations.${r}`) }))}
        />
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="smallStrong" tone="textMuted">
          {t('family.sharing.role')}
        </AppText>
        {ROLES.map((r) => (
          <RadioRow
            key={r}
            selected={role === r}
            onSelect={() => setRole(r)}
            label={t(`family.sharing.roles.${r}`)}
            description={t(`family.sharing.roles.${r}Hint`)}
          />
        ))}
      </View>
    </Sheet>
  );
}

/** "Compartir familia" (section 35): who will see/edit the family and with which role. */
export function FamilySharing() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const members = useMembers();
  const remove = useRemoveMember();
  const [editing, setEditing] = useState<{ open: boolean; member: FamilyMember | null }>({ open: false, member: null });

  const onRemove = async (m: FamilyMember) => {
    const ok = await dialog.confirm({
      title: t('family.sharing.removeTitle', { name: m.name }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) remove.mutate(m.id);
  };

  return (
    <Card>
      <CardHeader
        title={t('family.sharing.title')}
        icon="users"
        accent={familyMeta.accent}
        actionLabel={t('family.sharing.add')}
        onAction={() => setEditing({ open: true, member: null })}
      />
      <View style={{ gap: spacing.sm }}>
        {(members.data ?? []).map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
            <Avatar name={m.name} size={34} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {m.name}
              </AppText>
              <AppText variant="small" tone="textMuted" numberOfLines={1}>
                {[t(`family.sharing.relations.${m.relation}`), t(`family.sharing.roles.${m.role}`), m.email].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <Badge label={t(`family.sharing.status.${m.status}`)} tone={m.status === 'active' ? 'success' : 'neutral'} icon="clock" />
            <IconButton
              icon="edit-2"
              size={16}
              label={`${t('common.edit')}: ${m.name}`}
              onPress={() => setEditing({ open: true, member: m })}
            />
            <IconButton icon="trash-2" size={16} label={`${t('common.delete')}: ${m.name}`} onPress={() => void onRemove(m)} />
          </View>
        ))}
        {!members.data?.length ? (
          <AppText variant="small" tone="textMuted">
            {t('family.sharing.empty')}
          </AppText>
        ) : null}
        <InfoNote title={t('family.sharing.noteTitle')} description={t('family.sharing.note')} />
      </View>
      {editing.open ? <MemberForm member={editing.member} onClose={() => setEditing({ open: false, member: null })} /> : null}
    </Card>
  );
}
