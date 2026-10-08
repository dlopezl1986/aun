import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useServices } from '@/services/ServicesProvider';
import { useEnabledModules } from '@/state/userSettingsStore';
import type { EntityRef } from '@/types/entity';
import type { AppModule, LinkItem, LinkSource } from '@/types/module';

export interface AvailableSource {
  module: AppModule;
  source: LinkSource;
}

/** Link sources offered by ENABLED modules (optionally excluding the caller). */
export function useLinkSources(excludeModuleId?: string): AvailableSource[] {
  const modules = useEnabledModules();
  return useMemo(
    () =>
      modules.filter((m) => m.id !== excludeModuleId).flatMap((module) => (module.linkSources ?? []).map((source) => ({ module, source }))),
    [modules, excludeModuleId],
  );
}

export interface ResolvedLink extends LinkItem {
  module: AppModule;
  icon: LinkSource['icon'];
}

/**
 * Resolves stored refs to display items. Links to disabled modules or deleted
 * entities are simply not shown (the refs are kept, nothing is lost).
 */
export function useResolvedLinks(refs: EntityRef[]) {
  const services = useServices();
  const sources = useLinkSources();
  const key = refs.map((r) => `${r.module}:${r.type}:${r.id}`).join('|');
  return useQuery({
    queryKey: ['u', services.userId, 'links', key, sources.map((s) => s.module.id).join(',')],
    enabled: refs.length > 0,
    staleTime: 0,
    queryFn: async (): Promise<ResolvedLink[]> => {
      const out: ResolvedLink[] = [];
      for (const { module, source } of sources) {
        const ids = refs.filter((r) => r.module === module.id && r.type === source.type).map((r) => r.id);
        if (!ids.length) continue;
        for (const item of await source.resolve(services, ids)) out.push({ ...item, module, icon: source.icon });
      }
      return out;
    },
  });
}

export const sameRef = (a: EntityRef, b: EntityRef) => a.module === b.module && a.type === b.type && a.id === b.id;
