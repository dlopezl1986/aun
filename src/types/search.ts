import type { Services } from '@/services/container';
import type { EntityRef } from './entity';

/**
 * Global Search contract (section 49). Each module exposes a SearchSource;
 * the global search fans out to all ENABLED modules and merges results.
 * Later an AI-powered source can implement the same contract.
 */
export interface SearchResult {
  ref: EntityRef;
  title: string;
  subtitle?: string;
  /** i18n key describing the kind of item ("Tarea", "Carpeta"…). */
  kindKey?: string;
  /** ISO date shown (localised) next to the result, if relevant. */
  date?: string;
  score: number;
  /** Href to open the result. */
  route?: string;
}

export interface SearchQuery {
  text: string;
  limit?: number;
}

export interface SearchSource {
  search(query: SearchQuery, services: Services): Promise<SearchResult[]>;
}

/** Case/accent-insensitive matching shared by all modules. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function matchScore(value: string, query: string): number {
  const v = normalizeSearch(value);
  const q = normalizeSearch(query);
  if (!q || !v.includes(q)) return 0;
  return v.startsWith(q) ? 2 : 1;
}
