import type { OpTopic } from '../types';

/** "T5 · Derecho administrativo", or "Tema 5" when it has no title. */
export function topicLabel(topic: Pick<OpTopic, 'number' | 'title'>, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const title = topic.title.trim();
  return title ? `T${topic.number} · ${title}` : t('op.syllabus.topic', { number: topic.number });
}

/** "T1, T2, T5" for a study day. */
export function shortTopics(ids: string[], topics: OpTopic[]): string {
  return topics
    .filter((x) => ids.includes(x.id))
    .map((x) => `T${x.number}`)
    .join(', ');
}
