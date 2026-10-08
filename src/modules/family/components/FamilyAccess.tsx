import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDialog } from '@/components/feedback/DialogProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { ChipGroup } from '@/components/forms/Chips';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { InfoNote } from '@/components/ui/InfoNote';
import { LoadingState } from '@/components/ui/States';
import { RadioRow } from '@/components/ui/RadioRow';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { useLocale } from '@/hooks/useLocale';
import { useNow } from '@/hooks/useNow';
import { useCreateInvite, useDeleteInvite, useMyInvites, useSetAccess, useSharing } from '@/services/sharing/hooks';
import { calendarSpaceId, familySpaceId, peopleOf, type Invite, type ShareRole, type Space } from '@/services/sharing/spaces';
import { useDataQuery } from '@/state/queryClient';
import { useTheme } from '@/theme';
import { formatShortDate } from '@/utils/date';
import { useChildren, useUpdateChild } from '../hooks';
import { familyMeta } from '../meta';
import { SharingSyncStatus } from './SharingSyncStatus';
import type { Member } from '../types';

type Access = 'none' | ShareRole;
type SpaceDef = { kind: Space['kind']; refId: string | null; name: string };
interface Cal {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  isActive: boolean;
}

/** Link to send: opens AUN on the invitation page (works after signing up too). */
export function inviteLink(code: string): string {
  const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://aun.app';
  return `${origin}${base}/join?code=${code}`;
}

function useMyCalendars(me: string): Cal[] {
  const q = useDataQuery('calendars', [], (s) => s.calendars.listCalendars());
  return useMemo(() => (q.data ?? []).filter((c) => c.ownerId === me && c.isActive), [q.data, me]);
}

function AccessChips({ value, onChange, label }: { value: Access; onChange: (v: Access) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <ChipGroup<Access>
      compact
      accessibilityLabel={label}
      selected={value}
      onToggle={onChange}
      options={(['none', 'view', 'edit'] as Access[]).map((v) => ({ value: v, label: t(`sharing.roles.${v}`) }))}
    />
  );
}

function CalendarAccessRow({ cal, value, onChange }: { cal: Cal; value: Access; onChange: (v: Access) => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cal.color }} />
        <AppText variant="bodyStrong">{cal.name}</AppText>
      </View>
      <AccessChips value={value} onChange={onChange} label={cal.name} />
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <AppText variant="overline" tone="textMuted">
      {children}
    </AppText>
  );
}

// ---------------------------------------------------------------------------
// Invite someone
// ---------------------------------------------------------------------------

function InviteSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const { me } = useSharing();
  const calendars = useMyCalendars(me);
  const membersQuery = useChildren();
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const create = useCreateInvite();
  const [member, setMember] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [assign, setAssign] = useState<string | null>(null);
  const [family, setFamily] = useState(true);
  const childCalendars = useMemo(() => new Set(members.filter((m) => m.relation === 'child').map((m) => m.calendarId)), [members]);
  const [access, setAccess] = useState<Record<string, Access>>({});
  const [invite, setInvite] = useState<Invite | null>(null);
  // Children's calendars: shared to view by default, the rest not shared.
  const accessOf = (c: Cal): Access => access[c.id] ?? (childCalendars.has(c.id) ? 'view' : 'none');

  const pickMember = (m: Member | null) => {
    setMember(m);
    if (m) {
      setName(m.name);
      if (m.calendarId && calendars.some((c) => c.id === m.calendarId)) setAssign(m.calendarId);
    }
  };

  const submit = () => {
    const grants: Record<string, ShareRole> = {};
    const spaces: Record<string, SpaceDef> = {};
    if (family) {
      grants[familySpaceId(me)] = 'edit';
      spaces[familySpaceId(me)] = { kind: 'family', refId: null, name: t('sharing.familyAndShopping') };
    }
    for (const c of calendars) {
      const role: Access = c.id === assign ? 'edit' : accessOf(c);
      if (role === 'none') continue;
      grants[calendarSpaceId(me, c.id)] = role;
      spaces[calendarSpaceId(me, c.id)] = { kind: 'calendar', refId: c.id, name: c.name };
    }
    create.mutate(
      {
        grants,
        spaces,
        assign: assign ? calendarSpaceId(me, assign) : null,
        memberRecordId: member?.id ?? null,
        memberName: name.trim() || null,
      },
      { onSuccess: setInvite },
    );
  };

  const link = invite ? inviteLink(invite.code) : '';
  const copy = async () => {
    await Clipboard.setStringAsync(link);
    toast.show(t('sharing.toast.linkCopied'));
  };
  const share = async () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) await nav.share({ title: 'AUN', text: t('sharing.shareText'), url: link }).catch(() => undefined);
    else await copy();
  };

  if (invite) {
    return (
      <Sheet visible onClose={onClose} title={t('sharing.inviteReady')} footer={<Button label={t('common.done')} onPress={onClose} />}>
        <AppText variant="body">{t('sharing.inviteReadyHint', { name: invite.memberName || t('sharing.thatPerson') })}</AppText>
        <TextField label={t('sharing.link')} value={link} editable={false} selectTextOnFocus multiline />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('sharing.copyLink')} icon="copy" variant="secondary" onPress={() => void copy()} />
          <Button label={t('sharing.shareLink')} icon="share-2" onPress={() => void share()} />
        </View>
        <InfoNote icon="lock" title={t('sharing.linkSafetyTitle')} description={t('sharing.linkSafety')} />
      </Sheet>
    );
  }

  const nothing = !family && !assign && calendars.every((c) => accessOf(c) === 'none');
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('sharing.inviteTitle')}
      subtitle={t('sharing.inviteSubtitle')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('sharing.createInvite')} icon="link" onPress={submit} disabled={nothing} loading={create.isPending} />
        </>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Label>{t('sharing.who')}</Label>
        <ChipGroup<string>
          accessibilityLabel={t('sharing.who')}
          selected={member?.id ?? 'other'}
          onToggle={(id) => pickMember(members.find((m) => m.id === id) ?? null)}
          options={[
            ...members.filter((m) => m.relation !== 'child').map((m) => ({ value: m.id, label: m.name })),
            { value: 'other', label: t('sharing.otherPerson') },
          ]}
        />
        {member ? null : (
          <TextField label={t('sharing.name')} value={name} onChangeText={setName} placeholder={t('sharing.namePlaceholder')} />
        )}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Label>{t('sharing.theirCalendar')}</Label>
        <AppText variant="caption" tone="textMuted">
          {t('sharing.theirCalendarHint')}
        </AppText>
        <RadioRow selected={assign === null} onSelect={() => setAssign(null)} label={t('sharing.noCalendar')} />
        {calendars.map((c) => (
          <RadioRow
            key={c.id}
            selected={assign === c.id}
            onSelect={() => setAssign(c.id)}
            label={c.name}
            right={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{t('sharing.familyAndShopping')}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t('sharing.familyHint')}
          </AppText>
        </View>
        <Toggle value={family} onValueChange={setFamily} label={t('sharing.familyAndShopping')} />
      </View>

      {calendars.filter((c) => c.id !== assign).length ? (
        <View style={{ gap: spacing.md }}>
          <Label>{t('sharing.otherCalendars')}</Label>
          {calendars
            .filter((c) => c.id !== assign)
            .map((c) => (
              <CalendarAccessRow key={c.id} cal={c} value={accessOf(c)} onChange={(v) => setAccess((a) => ({ ...a, [c.id]: v }))} />
            ))}
        </View>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Change what a person can see / do
// ---------------------------------------------------------------------------

/**
 * Waits for the calendars and the current permissions before showing the
 * form: it starts from what the person has now, so saving never removes
 * access by accident.
 */
function PersonSheet(props: { person: { uid: string; name: string }; onClose: () => void }) {
  const { query: spacesQuery } = useSharing();
  const calendarsQuery = useDataQuery('calendars', [], (s) => s.calendars.listCalendars());
  const ready = !!calendarsQuery.data && !!spacesQuery.data && !spacesQuery.isFetching;
  if (!ready) {
    return (
      <Sheet visible onClose={props.onClose} title={props.person.name}>
        <LoadingState />
      </Sheet>
    );
  }
  return <PersonEditor {...props} />;
}

function PersonEditor({ person, onClose }: { person: { uid: string; name: string }; onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dialog = useDialog();
  const { me, spaces } = useSharing();
  const calendars = useMyCalendars(me);
  const setAccessM = useSetAccess();
  const roleIn = (id: string): Access => spaces.find((s) => s.id === id)?.roles[person.uid] ?? 'none';
  const [family, setFamily] = useState(roleIn(familySpaceId(me)) !== 'none');
  const [assign, setAssign] = useState<string | null>(
    calendars.find((c) => spaces.find((s) => s.id === calendarSpaceId(me, c.id))?.assignee === person.uid)?.id ?? null,
  );
  const [access, setAccess] = useState<Record<string, Access>>(() =>
    Object.fromEntries(calendars.map((c) => [c.id, roleIn(calendarSpaceId(me, c.id))])),
  );

  const changesFor = (all: Access | null) => [
    {
      spaceId: familySpaceId(me),
      role: (all === 'none' ? null : family ? 'edit' : null) as ShareRole | null,
      def: { kind: 'family' as const, refId: null, name: t('sharing.familyAndShopping') },
    },
    ...calendars.map((c) => {
      const v: Access = all === 'none' ? 'none' : c.id === assign ? 'edit' : (access[c.id] ?? 'none');
      return {
        spaceId: calendarSpaceId(me, c.id),
        role: v === 'none' ? null : v,
        def: { kind: 'calendar' as const, refId: c.id, name: c.name },
      };
    }),
  ];

  const save = () =>
    setAccessM.mutate({ person, changes: changesFor(null), assign: assign ? calendarSpaceId(me, assign) : null }, { onSuccess: onClose });
  const removeAll = async () => {
    const ok = await dialog.confirm({
      title: t('sharing.removeTitle', { name: person.name }),
      message: t('sharing.removeMessage'),
      confirmLabel: t('sharing.remove'),
      destructive: true,
    });
    if (ok) setAccessM.mutate({ person, changes: changesFor('none'), assign: null }, { onSuccess: onClose });
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={person.name}
      subtitle={t('sharing.personSubtitle')}
      footer={
        <>
          <Button label={t('sharing.remove')} icon="user-x" variant="ghost" onPress={() => void removeAll()} />
          <View style={{ flex: 1 }} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} onPress={save} loading={setAccessM.isPending} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{t('sharing.familyAndShopping')}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t('sharing.familyHint')}
          </AppText>
        </View>
        <Toggle value={family} onValueChange={setFamily} label={t('sharing.familyAndShopping')} />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Label>{t('sharing.theirCalendar')}</Label>
        <RadioRow selected={assign === null} onSelect={() => setAssign(null)} label={t('sharing.noCalendar')} />
        {calendars.map((c) => (
          <RadioRow
            key={c.id}
            selected={assign === c.id}
            onSelect={() => setAssign(c.id)}
            label={c.name}
            right={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />}
          />
        ))}
      </View>
      <View style={{ gap: spacing.md }}>
        <Label>{t('sharing.otherCalendars')}</Label>
        {calendars
          .filter((c) => c.id !== assign)
          .map((c) => (
            <CalendarAccessRow
              key={c.id}
              cal={c}
              value={access[c.id] ?? 'none'}
              onChange={(v) => setAccess((a) => ({ ...a, [c.id]: v }))}
            />
          ))}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The card in Familia
// ---------------------------------------------------------------------------

/** Own component: it must read the card's palette (inside Card), not the dark canvas one. */
function SharedWithMe({ spaces, me }: { spaces: Space[]; me: string }) {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const owner = spaces[0];
  return (
    <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
      <AppText variant="bodyStrong">{t('sharing.youAreIn', { name: owner.names[owner.ownerId] || t('sharing.someone') })}</AppText>
      {spaces.map((s) => (
        <AppText key={s.id} variant="small" tone="textMuted">
          {`• ${s.kind === 'family' ? t('sharing.familyAndShopping') : s.name} — ${t(`sharing.roles.${s.roles[me] ?? 'view'}`)}${
            s.assignee === me ? ` · ${t('sharing.yourCalendar')}` : ''
          }`}
        </AppText>
      ))}
    </View>
  );
}

export function FamilyAccess({
  openInvite = false,
  onInviteClosed,
  justJoined = false,
}: {
  openInvite?: boolean;
  onInviteClosed?: () => void;
  justJoined?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const toast = useToast();
  const { me, spaces } = useSharing();
  const invites = useMyInvites();
  const deleteInvite = useDeleteInvite();
  const members = useChildren().data;
  const updateChild = useUpdateChild();
  const [inviting, setInviting] = useState(false);
  const now = useNow(60_000);
  const [person, setPerson] = useState<{ uid: string; name: string } | null>(null);
  const people = peopleOf(spaces, me);
  const pending = (invites.data ?? []).filter((i) => !i.usedBy && new Date(i.expiresAt).getTime() > now);
  // Families / calendars other people share with me.
  const sharedWithMe = spaces.filter((s) => s.ownerId !== me);

  // Once an invitation is accepted, its family profile is linked to that account (and to "their calendar").
  useEffect(() => {
    if (!members) return;
    for (const inv of invites.data ?? []) {
      if (!inv.usedBy || !inv.memberRecordId) continue;
      const m = members.find((x) => x.id === inv.memberRecordId);
      if (!m || m.accountUid === inv.usedBy) continue;
      const assigned = inv.assign?.replace(`cal_${me}_`, '') ?? null;
      updateChild.mutate({
        id: m.id,
        input: { accountUid: inv.usedBy, ...(assigned && assigned !== m.calendarId ? { calendarId: assigned } : {}) },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invites.data, members, me]);

  const summary = (uid: string) => {
    const mine = spaces.filter((s) => s.ownerId === me && s.memberIds.includes(uid));
    const fam = mine.some((s) => s.kind === 'family');
    const cals = mine.filter((s) => s.kind === 'calendar').length;
    return [fam ? t('sharing.familyAndShopping') : null, cals ? t('sharing.calendarsCount', { count: cals }) : null]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <Card>
      <CardHeader
        title={t('sharing.title')}
        icon="users"
        accent={familyMeta.accent}
        right={<Button label={t('sharing.invite')} icon="user-plus" size="sm" variant="soft" onPress={() => setInviting(true)} />}
      />
      {sharedWithMe.length ? <SharedWithMe spaces={sharedWithMe} me={me} /> : null}

      {people.length ? (
        <View style={{ gap: spacing.xs }}>
          {people.map((p) => (
            <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 }}>
              <Avatar name={p.name || '?'} size={36} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{p.name}</AppText>
                <AppText variant="caption" tone="textMuted">
                  {summary(p.uid)}
                </AppText>
              </View>
              <Button label={t('sharing.permissions')} size="sm" variant="secondary" onPress={() => setPerson(p)} />
            </View>
          ))}
        </View>
      ) : sharedWithMe.length ? null : (
        <AppText variant="small" tone="textMuted">
          {t('sharing.empty')}
        </AppText>
      )}

      {pending.length ? (
        <View style={{ gap: spacing.xs }}>
          <Label>{t('sharing.pendingInvites')}</Label>
          {pending.map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppText variant="body">{i.memberName || t('sharing.thatPerson')}</AppText>
                <AppText variant="caption" tone="textMuted">
                  {t('sharing.expires', { date: formatShortDate(new Date(i.expiresAt), locale) })}
                </AppText>
              </View>
              <IconButton
                icon="copy"
                size={16}
                label={t('sharing.copyLink')}
                onPress={() => void Clipboard.setStringAsync(inviteLink(i.code)).then(() => toast.show(t('sharing.toast.linkCopied')))}
              />
              <IconButton icon="trash-2" size={16} label={t('common.delete')} onPress={() => deleteInvite.mutate(i.code)} />
            </View>
          ))}
        </View>
      ) : null}

      {sharedWithMe.length || people.length || justJoined ? (
        <SharingSyncStatus justJoined={justJoined} ownerName={sharedWithMe[0]?.names[sharedWithMe[0].ownerId]} />
      ) : null}
      <InfoNote icon="shield" title={t('sharing.privacyTitle')} description={t('sharing.privacy')} />
      {inviting || openInvite ? (
        <InviteSheet
          onClose={() => {
            setInviting(false);
            onInviteClosed?.();
          }}
        />
      ) : null}
      {person ? <PersonSheet person={person} onClose={() => setPerson(null)} /> : null}
    </Card>
  );
}
