import type { Services } from '@/services/container';
import type { AppModule } from '@/types/module';
import { normalizeSearch, type SearchResult } from '@/types/search';

export interface SearchGroup {
  module: AppModule;
  results: SearchResult[];
  total: number;
}

export const MIN_QUERY_LENGTH = 2;

/**
 * Global search (section 49): fans out to every ENABLED module exposing a
 * SearchSource, in parallel. A failing module never breaks the others.
 * The same entry point will later be backed by server/AI search.
 */
export async function runGlobalSearch(text: string, modules: AppModule[], services: Services, perModule = 5): Promise<SearchGroup[]> {
  if (normalizeSearch(text).length < MIN_QUERY_LENGTH) return [];
  const sources = modules.filter((m) => m.search);
  const settled = await Promise.allSettled(sources.map((m) => m.search!.search({ text }, services)));
  const groups: SearchGroup[] = [];
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled' || r.value.length === 0) return;
    const sorted = r.value.slice().sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    groups.push({ module: sources[i], results: sorted.slice(0, perModule), total: sorted.length });
  });
  // Modules with the best match first.
  return groups.sort((a, b) => (b.results[0]?.score ?? 0) - (a.results[0]?.score ?? 0) || a.module.nav.order - b.module.nav.order);
}
