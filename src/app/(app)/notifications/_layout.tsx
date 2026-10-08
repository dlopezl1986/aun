import { Stack } from 'expo-router';

import { ModuleGate } from '@/components/layout/ModuleGate';

export default function Layout() {
  return (
    <ModuleGate moduleId="notifications">
      <Stack screenOptions={{ headerShown: false }} />
    </ModuleGate>
  );
}
