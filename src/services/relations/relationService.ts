import type { Repository } from '@/storage/repository';
import type { BaseEntity, EntityRef } from '@/types/entity';

/**
 * Cross-module links (section 48): document ↔ task, task ↔ event,
 * event ↔ child, email → task… Stored as a generic edge list so any module
 * can relate to any other without importing it.
 */
export type RelationKind = 'related' | 'attachment' | 'createdFrom' | 'about';

export interface Relation extends BaseEntity {
  from: EntityRef;
  to: EntityRef;
  kind: RelationKind;
}

const sameRef = (a: EntityRef, b: EntityRef) => a.module === b.module && a.type === b.type && a.id === b.id;

export class RelationService {
  constructor(private readonly repo: Repository<Relation>) {}

  async link(from: EntityRef, to: EntityRef, kind: RelationKind = 'related'): Promise<Relation> {
    const existing = (await this.repo.list()).find((r) => sameRef(r.from, from) && sameRef(r.to, to) && r.kind === kind);
    return existing ?? this.repo.create({ from, to, kind });
  }

  async relatedTo(ref: EntityRef): Promise<Relation[]> {
    return (await this.repo.list()).filter((r) => sameRef(r.from, ref) || sameRef(r.to, ref));
  }

  async unlink(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
