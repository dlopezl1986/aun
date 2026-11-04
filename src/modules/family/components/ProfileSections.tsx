import { useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import type { IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { interaction } from '@/components/ui/interaction';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useLocale } from '@/hooks/useLocale';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { formatDateInput, fromDateKey, parseDateInput } from '@/utils/date';
import { createId } from '@/utils/id';
import { useUpdateChild } from '../hooks';
import type { ChildInput } from '../service';
import { ageParts, nextBirthday, zodiacOf } from '../selectors';
import { FAVORITE_EMOJI, FAVORITE_PRESETS, type Member, type MemberHealth, type MemberMeasurement } from '../types';

// ---------- Shared bits ----------

export function SectionCard({
  title,
  icon,
  accent,
  action,
  children,
}: {
  title: string;
  icon: IconName;
  accent: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} accent={accent} actionLabel={action?.label} onAction={action?.onPress} />
      {children}
    </Card>
  );
}

function InfoRow({ emoji, label, value, right }: { emoji: string; label: string; value?: string | null; right?: ReactNode }) {
  const { spacing } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <AppText variant="body" style={{ width: 26 }}>
        {emoji}
      </AppText>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="caption" tone="textMuted">
          {label}
        </AppText>
        <AppText variant="body" selectable>
          {value}
        </AppText>
      </View>
      {right}
    </View>
  );
}

/** Saves part of the profile (each card edits only its own piece). */
function useSavePart(member: Member) {
  const update = useUpdateChild();
  return {
    save: (input: Partial<ChildInput>, onDone?: () => void) => update.mutate({ id: member.id, input }, { onSuccess: onDone }),
    saving: update.isPending,
  };
}

const num = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number, locale: string) => n.toLocaleString(locale, { maximumFractionDigits: 1 });

/** Latest measurement with that value, and the one before it (for "+3 cm"). */
function latest(list: MemberMeasurement[] | undefined, field: 'heightCm' | 'weightKg') {
  const withValue = [...(list ?? [])].filter((m) => m[field]).sort((a, b) => a.date.localeCompare(b.date));
  return { last: withValue[withValue.length - 1] ?? null, prev: withValue[withValue.length - 2] ?? null };
}

// ---------- Fields sheet (generic small editor) ----------

export interface FieldDef {
  key: string;
  label: string;
  emoji?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'default' | 'phone-pad' | 'decimal-pad';
}

function FieldsForm({
  title,
  subtitle,
  fields,
  values,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  subtitle?: string;
  fields: FieldDef[];
  values: Record<string, string | null | undefined>;
  saving?: boolean;
  onSave: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ''])));
  return (
    <Sheet
      visible
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={t('common.save')} loading={saving} onPress={() => onSave(state)} />
        </>
      }
    >
      {fields.map((f, i) => (
        <TextField
          key={f.key}
          label={f.emoji ? `${f.emoji}  ${f.label}` : f.label}
          value={state[f.key]}
          onChangeText={(v) => setState((s) => ({ ...s, [f.key]: v }))}
          placeholder={f.placeholder ?? '—'}
          multiline={f.multiline}
          keyboardType={f.keyboard ?? 'default'}
          autoFocus={i === 0}
        />
      ))}
    </Sheet>
  );
}

export function FieldsSheet(props: Parameters<typeof FieldsForm>[0] & { visible: boolean }) {
  return props.visible ? <FieldsForm {...props} /> : null;
}

// ---------- Hero ----------

/** Big header: photo, name, age, zodiac and the birthday countdown. */
export function ProfileHero({ member, photo, actions }: { member: Member; photo: ReactNode; actions?: ReactNode }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const { spacing, radius, colors } = useTheme();
  const birthday = nextBirthday(member, today);
  const age = member.birthDate ? ageParts(member.birthDate, today) : null;
  const zodiac = member.birthDate ? zodiacOf(member.birthDate) : null;
  const ageText = age
    ? age.years < 3
      ? t('family.profile.ageMonths', { years: age.years, months: age.months, count: age.years })
      : t('family.age', { count: age.years })
    : null;
  const subtitle = [
    t(`family.relations.${member.relation}`),
    member.relation === 'child' ? [member.school, member.schoolClass].filter(Boolean).join(' · ') || null : member.occupation,
  ]
    .filter(Boolean)
    .join(' · ');

  const pill = (text: string, tint = member.color) => (
    <View
      key={text}
      style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: withAlpha(tint, 0.14) }}
    >
      <AppText variant="smallStrong">{text}</AppText>
    </View>
  );

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ height: 76, backgroundColor: withAlpha(member.color, 0.28) }} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginTop: -52, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
          <View style={{ padding: 4, borderRadius: 999, backgroundColor: colors.surface }}>{photo}</View>
          <View style={{ flex: 1 }} />
          {actions}
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">
            {member.name}
          </AppText>
          {subtitle ? (
            <AppText variant="body" tone="textMuted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {ageText ? pill(`🎂 ${ageText}`) : null}
          {zodiac ? pill(`${zodiac.emoji} ${t(`family.zodiac.${zodiac.sign}`)}`) : null}
          {birthday
            ? pill(
                birthday.daysUntil === 0
                  ? `🎉 ${t('family.birthdays.today')}`
                  : `🎁 ${t('family.profile.birthdayIn', { count: birthday.daysUntil, turns: birthday.turns })}`,
                birthday.daysUntil <= 14 ? '#F59E0B' : member.color,
              )
            : null}
          {member.birthDate ? null : pill(`🎂 ${t('family.noBirthDate')}`, colors.textSubtle)}
        </View>
        {birthday && birthday.daysUntil > 0 ? (
          <AppText variant="caption" tone="textSubtle">
            {fromDateKey(member.birthDate!).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

// ---------- The important things first ----------

/** Allergies, intolerances, conditions and "important info", always on top when set. */
export function KeyAlerts({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const h = member.health ?? {};
  const items = [
    { emoji: '⚠️', label: t('family.form.allergies'), value: h.allergies },
    { emoji: '🥛', label: t('family.health.intolerances'), value: h.intolerances },
    { emoji: '🫁', label: t('family.health.conditions'), value: h.conditions },
    { emoji: '💊', label: t('family.form.medication'), value: h.medication },
    { emoji: '📌', label: t('family.form.importantInfo'), value: member.importantInfo },
  ].filter((i) => i.value);
  if (!items.length) return null;
  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: withAlpha('#E11D48', 0.08),
        borderWidth: 1,
        borderColor: withAlpha('#E11D48', 0.25),
        gap: spacing.sm,
      }}
    >
      <AppText variant="overline" color="#BE123C">
        {t('family.health.important')}
      </AppText>
      {items.map((i) => (
        <InfoRow key={i.label} emoji={i.emoji} label={i.label} value={i.value} />
      ))}
    </View>
  );
}

// ---------- Stat tiles ----------

function Tile({
  emoji,
  label,
  value,
  sub,
  tint,
  onPress,
}: {
  emoji: string;
  label: string;
  value: string | null;
  sub?: string | null;
  tint: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? t('family.profile.tapToAdd')}`}
      style={(s) => ({
        flexBasis: 112,
        flexGrow: 1,
        padding: spacing.md,
        gap: 2,
        borderRadius: radius.lg,
        backgroundColor: value ? withAlpha(tint, interaction(s).hovered ? 0.2 : 0.13) : colors.surface,
        borderWidth: value ? 0 : 1.5,
        borderStyle: value ? 'solid' : 'dashed',
        borderColor: withAlpha(tint, 0.45),
        opacity: interaction(s).pressed ? 0.75 : 1,
      })}
    >
      <AppText variant="heading">{emoji}</AppText>
      <AppText variant="caption" tone="textMuted">
        {label}
      </AppText>
      <AppText variant={value ? 'title' : 'smallStrong'} tone={value ? 'text' : 'textSubtle'} numberOfLines={1}>
        {value ?? t('family.profile.tapToAdd')}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone="textSubtle" numberOfLines={1}>
          {sub}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Height, weight, blood group and sizes at a glance; tap one to fill it in. */
export function StatTiles({ member, onMeasure }: { member: Member; onMeasure: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing } = useTheme();
  const { save, saving } = useSavePart(member);
  const [editing, setEditing] = useState<'blood' | 'shoes' | 'clothing' | null>(null);
  const height = latest(member.measurements, 'heightCm');
  const weight = latest(member.measurements, 'weightKg');
  const size = (key: string) => member.sizes?.find((s) => s.key === key)?.value ?? null;
  const since = (d: string) => fromDateKey(d).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const delta = (cur: number, prev: number, unit: string, date: string) => {
    const d = cur - prev;
    if (!d) return t('family.profile.sameSince', { date: since(date) });
    return t('family.profile.deltaSince', { delta: `${d > 0 ? '+' : ''}${fmt(d, locale)} ${unit}`, date: since(date) });
  };
  const setSize = (key: string, value: string) => {
    const rest = (member.sizes ?? []).filter((s) => s.key !== key);
    save({ sizes: value.trim() ? [...rest, { key, value: value.trim() }] : rest }, () => setEditing(null));
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Tile
        emoji="📏"
        label={t('family.measure.height')}
        tint="#0EA5E9"
        value={height.last ? `${fmt(height.last.heightCm!, locale)} cm` : null}
        sub={
          height.last && height.prev
            ? delta(height.last.heightCm!, height.prev.heightCm!, 'cm', height.prev.date)
            : height.last
              ? since(height.last.date)
              : null
        }
        onPress={onMeasure}
      />
      <Tile
        emoji="⚖️"
        label={t('family.measure.weight')}
        tint="#8B5CF6"
        value={weight.last ? `${fmt(weight.last.weightKg!, locale)} kg` : null}
        sub={
          weight.last && weight.prev
            ? delta(weight.last.weightKg!, weight.prev.weightKg!, 'kg', weight.prev.date)
            : weight.last
              ? since(weight.last.date)
              : null
        }
        onPress={onMeasure}
      />
      <Tile
        emoji="🩸"
        label={t('family.form.bloodType')}
        tint="#E11D48"
        value={member.health?.bloodType || null}
        onPress={() => setEditing('blood')}
      />
      <Tile emoji="👟" label={t('family.sizes.shoes')} tint="#F59E0B" value={size('shoes')} onPress={() => setEditing('shoes')} />
      <Tile emoji="👕" label={t('family.sizes.clothing')} tint="#10B981" value={size('clothing')} onPress={() => setEditing('clothing')} />

      <FieldsSheet
        visible={editing === 'blood'}
        title={t('family.form.bloodType')}
        fields={[{ key: 'bloodType', label: t('family.form.bloodType'), emoji: '🩸', placeholder: t('family.health.bloodPlaceholder') }]}
        values={{ bloodType: member.health?.bloodType }}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={(v) => save({ health: { ...member.health, bloodType: v.bloodType.trim() || null } }, () => setEditing(null))}
      />
      {(['shoes', 'clothing'] as const).map((k) => (
        <FieldsSheet
          key={k}
          visible={editing === k}
          title={t(`family.sizes.${k}`)}
          fields={[{ key: k, label: t(`family.sizes.${k}`), emoji: k === 'shoes' ? '👟' : '👕' }]}
          values={{ [k]: size(k) }}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(v) => setSize(k, v[k])}
        />
      ))}
    </View>
  );
}

// ---------- Growth ----------

function MeasurementForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const { t } = useTranslation();
  const today = useToday();
  const { spacing } = useTheme();
  const { save, saving } = useSavePart(member);
  const [date, setDate] = useState(formatDateInput(today));
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const dateKey = parseDateInput(date);
  const canSave = !!dateKey && (num(height) !== null || num(weight) !== null);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('family.measure.add')}
      subtitle={t('family.measure.hint')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button
            label={t('common.save')}
            loading={saving}
            disabled={!canSave}
            onPress={() =>
              save(
                {
                  measurements: [
                    ...(member.measurements ?? []),
                    { id: createId(), date: dateKey!, heightCm: num(height), weightKg: num(weight) },
                  ].sort((a, b) => a.date.localeCompare(b.date)),
                },
                onClose,
              )
            }
          />
        </>
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={`📏  ${t('family.measure.height')} (cm)`}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="120"
            autoFocus
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={`⚖️  ${t('family.measure.weight')} (kg)`}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="24,5"
          />
        </View>
      </View>
      <TextField
        label={t('family.measure.date')}
        value={date}
        onChangeText={setDate}
        placeholder={t('forms.datePlaceholder')}
        error={date.trim() && !dateKey ? t('forms.invalidDate') : null}
        inputMode="numeric"
      />
    </Sheet>
  );
}

export function MeasurementSheet({ member, visible, onClose }: { member: Member; visible: boolean; onClose: () => void }) {
  return visible ? <MeasurementForm member={member} onClose={onClose} /> : null;
}

/** Height / weight history with little bars, newest first. */
export function GrowthCard({ member, onAdd }: { member: Member; onAdd: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { spacing, radius, colors } = useTheme();
  const { save } = useSavePart(member);
  const list = [...(member.measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const maxH = Math.max(1, ...list.map((m) => m.heightCm ?? 0));
  return (
    <SectionCard
      title={t('family.measure.title')}
      icon="trending-up"
      accent="#0EA5E9"
      action={{ label: t('family.measure.addShort'), onPress: onAdd }}
    >
      {list.length ? (
        <View style={{ gap: spacing.sm }}>
          {list.slice(0, 8).map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppText variant="small" tone="textMuted" style={{ width: 86 }}>
                {fromDateKey(m.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' })}
              </AppText>
              <View style={{ flex: 1, gap: 4 }}>
                {m.heightCm ? (
                  <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }}>
                    <View
                      style={{
                        width: `${Math.round((m.heightCm / maxH) * 100)}%`,
                        height: 10,
                        borderRadius: radius.pill,
                        backgroundColor: '#0EA5E9',
                      }}
                    />
                  </View>
                ) : null}
                <AppText variant="smallStrong">
                  {[m.heightCm ? `${fmt(m.heightCm, locale)} cm` : null, m.weightKg ? `${fmt(m.weightKg, locale)} kg` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <IconButton
                icon="x"
                size={14}
                label={t('common.delete')}
                onPress={() => save({ measurements: (member.measurements ?? []).filter((x) => x.id !== m.id) })}
              />
            </View>
          ))}
        </View>
      ) : (
        <Pressable onPress={onAdd} accessibilityRole="button">
          <AppText variant="small" tone="textMuted">
            {t('family.measure.empty')}
          </AppText>
        </Pressable>
      )}
    </SectionCard>
  );
}

// ---------- Health ----------

export function HealthCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { save, saving } = useSavePart(member);
  const [editing, setEditing] = useState(false);
  const h = member.health ?? {};
  const isChild = member.relation === 'child';
  const fields: (FieldDef & { key: keyof MemberHealth })[] = [
    { key: 'allergies', label: t('family.form.allergies'), emoji: '⚠️', placeholder: t('family.health.allergiesPlaceholder') },
    { key: 'intolerances', label: t('family.health.intolerances'), emoji: '🥛', placeholder: t('family.health.intolerancesPlaceholder') },
    { key: 'conditions', label: t('family.health.conditions'), emoji: '🫁', placeholder: t('family.health.conditionsPlaceholder') },
    { key: 'medication', label: t('family.form.medication'), emoji: '💊' },
    { key: 'vaccines', label: t('family.health.vaccines'), emoji: '💉', placeholder: t('family.health.vaccinesPlaceholder') },
    { key: 'doctor', label: isChild ? t('family.form.pediatrician') : t('family.form.doctor'), emoji: '🩺' },
    { key: 'healthCard', label: t('family.health.healthCard'), emoji: '💳' },
    { key: 'insurance', label: t('family.health.insurance'), emoji: '🏥', placeholder: t('family.health.insurancePlaceholder') },
    { key: 'notes', label: t('family.form.healthNotes'), emoji: '📝', multiline: true },
  ];
  const shown = fields.filter((f) => h[f.key]);
  return (
    <SectionCard
      title={t('family.form.health')}
      icon="heart"
      accent="#E11D48"
      action={{ label: shown.length ? t('common.edit') : t('family.profile.fill'), onPress: () => setEditing(true) }}
    >
      {shown.length ? (
        <View style={{ gap: spacing.md }}>
          {shown.map((f) => (
            <InfoRow key={f.key} emoji={f.emoji!} label={f.label} value={h[f.key]} />
          ))}
        </View>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('family.health.empty')}
        </AppText>
      )}
      <FieldsSheet
        visible={editing}
        title={t('family.form.health')}
        fields={fields}
        values={{ ...h }}
        saving={saving}
        onClose={() => setEditing(false)}
        onSave={(v) =>
          save({ health: { ...h, ...Object.fromEntries(fields.map((f) => [f.key, v[f.key].trim() || null])) } }, () => setEditing(false))
        }
      />
    </SectionCard>
  );
}

// ---------- Favourites ----------

export function FavoritesCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const { save, saving } = useSavePart(member);
  const [editing, setEditing] = useState(false);
  const favs = member.favorites ?? [];
  const value = (k: string) => favs.find((f) => f.key === k)?.value ?? '';
  return (
    <SectionCard
      title={t('family.favorites.title')}
      icon="star"
      accent="#F59E0B"
      action={{ label: favs.length ? t('common.edit') : t('family.profile.fill'), onPress: () => setEditing(true) }}
    >
      {favs.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FAVORITE_PRESETS.filter((k) => value(k)).map((k) => (
            <View
              key={k}
              style={{
                flexBasis: 150,
                flexGrow: 1,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(k === 'dislike' ? '#64748B' : member.color, 0.12),
                gap: 2,
              }}
            >
              <AppText variant="caption" tone="textMuted">
                {FAVORITE_EMOJI[k]} {t(`family.favorites.${k}`)}
              </AppText>
              <AppText variant="bodyStrong">{value(k)}</AppText>
            </View>
          ))}
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
          <AppText variant="small" tone="textMuted">
            {t('family.favorites.empty', { name: member.name.split(' ')[0] })}
          </AppText>
        </Pressable>
      )}
      <FieldsSheet
        visible={editing}
        title={t('family.favorites.title')}
        subtitle={t('family.favorites.hint')}
        fields={FAVORITE_PRESETS.map((k) => ({ key: k, label: t(`family.favorites.${k}`), emoji: FAVORITE_EMOJI[k] }))}
        values={Object.fromEntries(FAVORITE_PRESETS.map((k) => [k, value(k)]))}
        saving={saving}
        onClose={() => setEditing(false)}
        onSave={(v) =>
          save({ favorites: FAVORITE_PRESETS.filter((k) => v[k].trim()).map((k) => ({ key: k, value: v[k].trim() })) }, () =>
            setEditing(false),
          )
        }
      />
    </SectionCard>
  );
}

// ---------- Gift ideas ----------

export function GiftIdeasCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { save } = useSavePart(member);
  const [text, setText] = useState('');
  const ideas = member.giftIdeas ?? [];
  const add = () => {
    const v = text.trim();
    if (!v) return;
    save({ giftIdeas: [...ideas, v] });
    setText('');
  };
  return (
    <SectionCard title={t('family.gifts.title')} icon="gift" accent="#EC4899">
      <View style={{ gap: spacing.xs }}>
        {ideas.map((g, i) => (
          <View key={`${g}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="body">🎁</AppText>
            <AppText variant="body" style={{ flex: 1 }} selectable>
              {g}
            </AppText>
            <IconButton
              icon="x"
              size={14}
              label={t('common.delete')}
              onPress={() => save({ giftIdeas: ideas.filter((_, j) => j !== i) })}
            />
          </View>
        ))}
        <TextField
          compact
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          returnKeyType="done"
          leftIcon="plus"
          placeholder={t('family.gifts.placeholder')}
        />
      </View>
    </SectionCard>
  );
}

// ---------- Emergency ----------

export function EmergencyCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { save, saving } = useSavePart(member);
  const [editing, setEditing] = useState(false);
  const e = member.emergency ?? {};
  const has = !!(e.name || e.phone);
  return (
    <SectionCard
      title={t('family.emergency.title')}
      icon="phone-call"
      accent="#DC2626"
      action={{ label: has ? t('common.edit') : t('family.profile.fill'), onPress: () => setEditing(true) }}
    >
      {has ? (
        <View style={{ gap: spacing.sm }}>
          <InfoRow
            emoji="🆘"
            label={e.relation || t('family.emergency.contact')}
            value={[e.name, e.phone].filter(Boolean).join(' · ')}
            right={
              e.phone ? (
                <Button
                  label={t('family.emergency.call')}
                  icon="phone"
                  size="sm"
                  variant="secondary"
                  onPress={() => void Linking.openURL(`tel:${e.phone!.replace(/\s+/g, '')}`)}
                />
              ) : null
            }
          />
        </View>
      ) : (
        <AppText variant="small" tone="textMuted">
          {t('family.emergency.empty')}
        </AppText>
      )}
      <FieldsSheet
        visible={editing}
        title={t('family.emergency.title')}
        fields={[
          { key: 'name', label: t('family.emergency.name'), emoji: '👤' },
          { key: 'relation', label: t('family.emergency.relation'), emoji: '🤝', placeholder: t('family.emergency.relationPlaceholder') },
          { key: 'phone', label: t('family.form.phone'), emoji: '📞', keyboard: 'phone-pad' },
        ]}
        values={{ ...e }}
        saving={saving}
        onClose={() => setEditing(false)}
        onSave={(v) =>
          save(
            {
              emergency:
                v.name.trim() || v.phone.trim()
                  ? { name: v.name.trim() || null, relation: v.relation.trim() || null, phone: v.phone.trim() || null }
                  : null,
            },
            () => setEditing(false),
          )
        }
      />
    </SectionCard>
  );
}
