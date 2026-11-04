import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Image } from 'expo-image';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { interaction } from '@/components/ui/interaction';
import { ChildAvatar } from '@/modules/family/components/ChildAvatar';
import { ChildFormSheet } from '@/modules/family/components/ChildFormSheet';
import { EditablePhoto } from '@/modules/family/components/EditablePhoto';
import { useChildren, useMembers } from '@/modules/family/hooks';
import { photoKey, usePersonPhoto, useSetPersonPhoto, useUploadDevicePhotos } from '@/modules/family/personPhotos';
import { useFamily } from '@/services/sharing/hooks';
import { useAuthStore } from '@/state/authStore';
import { useEnabledModules } from '@/state/userSettingsStore';
import { useTheme } from '@/theme';

/** Inicio: a row with every family member (tap a face → their profile or photo). Only with Familia on. Adding people is done in Familia. */
export function FamilyStrip({ size = 56 }: { size?: number }) {
  const enabled = useEnabledModules().some((m) => m.id === 'family');
  if (!enabled) return null;
  return <FamilyStripRow size={size} />;
}

function FamilyStripRow({ size: SIZE }: { size: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const children = useChildren();
  const members = children.data ?? [];
  const adults = useAdults(members);
  const [creating, setCreating] = useState<Adult | null>(null);
  const [open, setOpen] = useState<Adult | null>(null);
  useUploadDevicePhotos(members, !children.isLoading);
  if (children.isLoading) return null;

  const person = (key: string, label: string, onPress: () => void, avatar: ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s) => ({ alignItems: 'center', gap: spacing.xs, width: SIZE + 16, opacity: interaction(s).pressed ? 0.7 : 1 })}
    >
      {avatar}
      <AppText variant="smallStrong" tone="textMuted" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View accessibilityLabel={t('dashboard.family.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {adults.map((a) =>
          person(
            a.key,
            a.name.split(' ')[0],
            // You and the people of the family get a full profile, like the children's.
            () => (a.uid ? setCreating(a) : setOpen(a)),
            <View
              style={{ padding: 3, borderRadius: SIZE, backgroundColor: colors.surface, boxShadow: `0px 4px 14px ${colors.primary}22` }}
            >
              <AdultAvatar adult={a} size={SIZE - 6} />
            </View>,
          ),
        )}
        {members.map((m) =>
          person(
            m.id,
            m.name.split(' ')[0],
            () => router.navigate(`/family/child/${m.id}` as Href),
            <View style={{ padding: 3, borderRadius: SIZE, backgroundColor: colors.surface, boxShadow: `0px 4px 14px ${m.color}33` }}>
              <ChildAvatar child={m} size={SIZE - 6} />
            </View>,
          ),
        )}
      </ScrollView>
      {open ? <AdultSheet adult={open} onClose={() => setOpen(null)} /> : null}
      <ChildFormSheet
        visible={!!creating}
        initial={creating?.uid ? { name: creating.name, relation: 'parent', accountUid: creating.uid } : undefined}
        onClose={() => setCreating(null)}
        onCreated={(m) => router.navigate(`/family/child/${m.id}` as Href)}
      />
    </View>
  );
}

function AdultAvatar({ adult, size }: { adult: Adult; size: number }) {
  const synced = usePersonPhoto(adult.photoKey);
  const uri = synced ?? adult.photo ?? null;
  if (!uri) return <Avatar name={adult.name} size={size} />;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={adult.name}
      contentFit="cover"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );
}

/** Tapping an adult: their photo (tap to change, stays on this device) and a link to their page. */
function AdultSheet({ adult, onClose }: { adult: Adult; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const hasPhoto = !!usePersonPhoto(adult.photoKey);
  const setPhoto = useSetPersonPhoto();
  return (
    <Sheet visible onClose={onClose} title={adult.name}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <EditablePhoto size={112} hasPhoto={hasPhoto} onPick={(source) => void setPhoto(adult.photoKey, source)}>
          <AdultAvatar adult={adult} size={112} />
        </EditablePhoto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          {hasPhoto ? (
            <Button label={t('family.photo.remove')} variant="ghost" size="sm" onPress={() => void setPhoto(adult.photoKey, null)} />
          ) : null}
          <Button
            label={adult.key === 'me' ? t('dashboard.family.openProfile') : t('dashboard.family.openFamily')}
            variant="secondary"
            size="sm"
            icon="chevron-right"
            onPress={() => {
              onClose();
              adult.onPress();
            }}
          />
        </View>
        <AppText variant="small" tone="textMuted" style={{ textAlign: 'center' }}>
          {t('dashboard.family.photoHint')}
        </AppText>
      </View>
    </Sheet>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.toLocaleLowerCase() ?? '';

interface Adult {
  key: string;
  /** Their AUN account (you, people of the shared family): a profile can be created for them. */
  uid?: string;
  /** Where their photo is kept (synced with the family). */
  photoKey: string;
  name: string;
  photo?: string | null;
  onPress: () => void;
}

/**
 * Me + the other adults of the family (people in the shared family and the ones
 * added in «Compartir familia»), skipping anyone who already has a profile in
 * Familia (that profile, with its photo, is shown instead).
 */
function useAdults(profiles: { name: string; accountUid?: string | null }[]): Adult[] {
  const user = useAuthStore((s) => s.session?.user);
  const { family, me } = useFamily();
  const shared = useMembers().data ?? [];
  const taken = new Set(profiles.map((p) => firstName(p.name)));
  const accounts = new Set(profiles.map((p) => p.accountUid).filter(Boolean));
  const out: Adult[] = [];
  const add = (a: Adult) => {
    const k = firstName(a.name);
    if (!k || taken.has(k) || (a.uid && accounts.has(a.uid))) return;
    taken.add(k);
    out.push(a);
  };
  if (user)
    add({
      key: 'me',
      uid: user.id,
      photoKey: photoKey.user(user.id),
      name: user.displayName,
      photo: user.avatarUrl,
      onPress: () => router.navigate('/settings/profile'),
    });
  for (const id of family?.memberIds ?? []) {
    if (id === me) continue;
    const name = family?.names[id];
    if (name) add({ key: `space:${id}`, uid: id, photoKey: photoKey.user(id), name, onPress: () => router.navigate('/family') });
  }
  for (const m of shared)
    add({ key: `member:${m.id}`, photoKey: photoKey.member(m.id), name: m.name, onPress: () => router.navigate('/family') });
  return out;
}
