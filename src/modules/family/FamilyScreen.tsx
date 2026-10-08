import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { ChildFormSheet } from './components/ChildFormSheet';
import { FamilyChecklist } from './components/FamilyChecklist';
import { FamilyAccess } from './components/FamilyAccess';
import { FamilySharing } from './components/FamilySharing';
import { MembersCard } from './components/MembersCard';
import { familyMeta } from './meta';
import { useServices } from '@/services/ServicesProvider';
import type { Member } from './types';

/** Familia: members (each with their own calendar), "Para mañana" and sharing. */
export function FamilyScreen() {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<{ open: boolean; child: Member | null }>({ open: false, child: null });
  const openMember = (m: Member) => router.navigate({ pathname: '/family/child/[id]', params: { id: m.id } });
  // Sharing between accounts needs the cloud (Firebase); in local mode the old explanation stays.
  const cloudSharing = !!useServices().sharing;
  const { invite } = useLocalSearchParams<{ invite?: string }>();

  return (
    <Screen>
      <PageHeader
        title={t('modules.family.title')}
        subtitle={t('family.subtitle')}
        icon={familyMeta.icon}
        accent={familyMeta.accent}
        actions={<Button label={t('family.addMember')} icon="user-plus" onPress={() => setSheet({ open: true, child: null })} />}
      />
      <MembersCard onOpen={openMember} onAdd={() => setSheet({ open: true, child: null })} />
      <FamilyChecklist list="tomorrow" />
      {cloudSharing ? (
        <FamilyAccess openInvite={invite === '1'} onInviteClosed={() => router.setParams({ invite: undefined })} />
      ) : (
        <FamilySharing />
      )}
      <ChildFormSheet
        visible={sheet.open}
        child={sheet.child}
        onClose={() => setSheet({ open: false, child: null })}
        onCreated={openMember}
      />
    </Screen>
  );
}
