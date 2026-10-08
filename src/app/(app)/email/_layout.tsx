import { Stack } from 'expo-router';

import { ModuleGate } from '@/components/layout/ModuleGate';

export default function Layout() {
  return (
    <ModuleGate moduleId="email">
      <Stack screenOptions={{ headerShown: false }} />
    </ModuleGate>
  );
}
