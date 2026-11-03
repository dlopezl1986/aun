import type { Repository } from '@/storage/repository';
import type { BaseEntity } from '@/types/entity';

/**
 * A profile photo shown in the family circles, synced with the family so it
 * appears on every device and for everyone in the family. `image` is a small
 * JPEG data URI (≈320 px) so it fits comfortably in a synced row.
 * Keys: `user:<uid>` (an account), `member:<id>` (Compartir familia), `child:<id>` (Familia profile).
 */
export interface PersonPhoto extends BaseEntity {
  personKey: string;
  image: string;
}

export class PersonPhotoService {
  constructor(private readonly photos: Repository<PersonPhoto>) {}

  /** personKey → image (the newest row wins if two devices set one at once). */
  async map(): Promise<Record<string, string>> {
    const rows = (await this.photos.list()).slice().sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    const out: Record<string, string> = {};
    for (const r of rows) if (r.image) out[r.personKey] = r.image;
    return out;
  }

  /** Sets (image) or removes (null) the photo of one person. */
  async set(personKey: string, image: string | null): Promise<void> {
    const rows = (await this.photos.list()).filter((r) => r.personKey === personKey);
    if (!image) {
      for (const r of rows) await this.photos.remove(r.id);
      return;
    }
    const [first, ...rest] = rows;
    if (first) await this.photos.update(first.id, { image });
    else await this.photos.create({ personKey, image });
    for (const r of rest) await this.photos.remove(r.id);
  }
}
