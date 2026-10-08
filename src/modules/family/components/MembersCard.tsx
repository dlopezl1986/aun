import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { interaction } from '@/components/ui/interaction';
import { LoadingState } from '@/components/ui/States';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useChildren } from '../hooks';
import { familyMeta } from '../meta';
import { ageFrom } from '../selectors';
import type { Member } from '../types';
import { ChildAvatar } from './ChildAvatar';

/** The family at a glance: one tile per member (photo, type, age, activities). */
export function MembersCard({ onOpen, onAdd }: { onOpen: (m: Member) => void; onAdd: () => void }) {
  return (
    <Card>
      <MembersBody onOpen={onOpen} onAdd={onAdd} />
    </Card>
  );
}

function MembersBody({ onOpen, onAdd }: { onOpen: (m: Member) => void; onAdd: () => void }) {
  const { t } = useTranslation();
  const { spacing, radius, colors } = useTheme();
  const today = useToday();
  const members = useChildren();
  return (
    <>
      <CardHeader title={t('family.members')} icon="users" accent={familyMeta.accent} subtitle={t('family.membersHint')} />
      {members.isLoading ? (
        <LoadingState />
      ) : members.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {members.data.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => onOpen(m)}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}, ${t(`family.relations.${m.relation}`)}`}
              accessibilityHint={t('family.openProfileHint')}
              style={(s) => ({
                width: 172,
                padding: spacing.md,
                gap: spacing.xs,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderTopWidth: 4,
                borderColor: interaction(s).hovered ? withAlpha(m.color, 0.6) : colors.border,
                borderTopColor: m.color,
                backgroundColor: withAlpha(m.color, interaction(s).hovered ? 0.12 : 0.06),
              })}
            >
              <ChildAvatar child={m} size={56} />
              <AppText variant="subheading" numberOfLines={1} style={{ marginTop: spacing.xs }}>
                {m.name}
              </AppText>
              <AppText variant="small" tone="textMuted" numberOfLines={1}>
                {[t(`family.relations.${m.relation}`), m.birthDate ? t('family.age', { count: ageFrom(m.birthDate, today) }) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              {m.activities.length ? (
                <AppText variant="caption" tone="textSubtle" numberOfLines={1}>
                  ⚽ {m.activities.map((a) => a.name).join(', ')}
                </AppText>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t('family.addMember')}
            style={(s) => ({
              width: 132,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              backgroundColor: interaction(s).hovered ? colors.surfaceMuted : 'transparent',
            })}
          >
            <Icon name="user-plus" size={22} color={colors.textMuted} />
            <AppText variant="smallStrong" tone="textMuted" align="center">
              {t('family.addMember')}
            </AppText>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
          <AppText variant="body" tone="textMuted">
            {t('family.noMembers')}
          </AppText>
          <Button label={t('family.addMember')} variant="soft" icon="user-plus" onPress={onAdd} />
        </View>
      )}
    </>
  );
}
