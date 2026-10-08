import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '@/services/backend/firebase';
import { createId } from '@/utils/id';
import type { Invite, ShareRole, Space } from './spaces';

const INVITE_DAYS = 7;

export interface InviteInput {
  grants: Record<string, ShareRole>;
  assign: string | null;
  memberRecordId: string | null;
  memberName: string | null;
  /** spaceId → what to create if the space does not exist yet. */
  spaces: Record<string, { kind: Space['kind']; refId: string | null; name: string }>;
}

export class SharingError extends Error {
  constructor(readonly code: 'not-found' | 'expired' | 'used' | 'own' | 'denied' | 'offline') {
    super(code);
    this.name = 'SharingError';
  }
}

function mapError(e: unknown): never {
  const c = (e as { code?: string })?.code ?? '';
  if (c.includes('permission-denied')) throw new SharingError('denied');
  if (c.includes('unavailable')) throw new SharingError('offline');
  throw e;
}

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : ((v as string | null) ?? null));

function toInvite(code: string, d: Record<string, unknown>): Invite {
  return {
    code,
    ownerId: d.ownerId as string,
    ownerName: (d.ownerName as string) ?? '',
    grants: (d.grants as Record<string, ShareRole>) ?? {},
    assign: (d.assign as string) ?? null,
    memberRecordId: (d.memberRecordId as string) ?? null,
    memberName: (d.memberName as string) ?? null,
    spaceNames: (d.spaceNames as Record<string, string>) ?? {},
    createdAt: iso(d.createdAt) ?? '',
    expiresAt: iso(d.expiresAt) ?? '',
    usedBy: (d.usedBy as string) ?? null,
    usedByName: (d.usedByName as string) ?? null,
  };
}

/**
 * Sharing with other AUN accounts on Firebase: spaces, roles and
 * invitations. Everything here is checked again by firestore.rules.
 */
export class FirebaseSharingService {
  constructor(
    readonly me: string,
    /** Called after any change so sync sees the new spaces right away. */
    private readonly onSpacesChanged: () => void = () => undefined,
  ) {}

  private get db() {
    return firebaseDb();
  }

  myName(): string {
    const u = firebaseAuth().currentUser;
    return u?.displayName || u?.email?.split('@')[0] || 'AUN';
  }

  async spaces(): Promise<Space[]> {
    try {
      const snap = await getDocs(query(collection(this.db, 'spaces'), where('memberIds', 'array-contains', this.me)));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Space, 'id'>) }));
    } catch (e) {
      mapError(e);
    }
  }

  /** Creates one of my spaces if missing (only me in it), or refreshes its name. */
  async ensureSpace(id: string, def: { kind: Space['kind']; refId: string | null; name: string }): Promise<void> {
    const ref = doc(this.db, 'spaces', id);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ownerId: this.me,
          kind: def.kind,
          refId: def.refId,
          name: def.name,
          memberIds: [this.me],
          roles: {},
          names: { [this.me]: this.myName() },
          assignee: null,
          updatedAt: Timestamp.now(),
        });
      } else if (snap.data().name !== def.name) {
        await updateDoc(ref, { name: def.name, updatedAt: Timestamp.now() });
      }
    } catch (e) {
      mapError(e);
    }
  }

  /**
   * Owner: sets what a person can do in each of my spaces (`null` removes
   * them) and which calendar is "theirs".
   */
  async setAccess(
    person: { uid: string; name: string },
    changes: { spaceId: string; role: ShareRole | null; def: { kind: Space['kind']; refId: string | null; name: string } }[],
    assign?: string | null,
  ): Promise<void> {
    for (const c of changes) {
      if (c.role) await this.ensureSpace(c.spaceId, c.def);
      const ref = doc(this.db, 'spaces', c.spaceId);
      try {
        if (c.role) {
          await updateDoc(ref, {
            memberIds: arrayUnion(person.uid),
            [`roles.${person.uid}`]: c.role,
            [`names.${person.uid}`]: person.name,
            ...(assign !== undefined ? { assignee: assign === c.spaceId ? person.uid : null } : {}),
            updatedAt: Timestamp.now(),
          });
        } else {
          const snap = await getDoc(ref);
          if (!snap.exists() || !(snap.data().memberIds as string[]).includes(person.uid)) continue;
          await updateDoc(ref, {
            memberIds: arrayRemove(person.uid),
            [`roles.${person.uid}`]: deleteField(),
            [`names.${person.uid}`]: deleteField(),
            ...(snap.data().assignee === person.uid ? { assignee: null } : {}),
            updatedAt: Timestamp.now(),
          });
        }
      } catch (e) {
        mapError(e);
      }
    }
    this.onSpacesChanged();
  }

  async createInvite(input: InviteInput): Promise<Invite> {
    for (const [id, def] of Object.entries(input.spaces)) if (input.grants[id]) await this.ensureSpace(id, def);
    const code = `${createId()}${createId()}`.replace(/-/g, '').slice(0, 40);
    const now = Date.now();
    const data = {
      ownerId: this.me,
      ownerName: this.myName(),
      grants: input.grants,
      assign: input.assign,
      memberRecordId: input.memberRecordId,
      memberName: input.memberName,
      spaceNames: Object.fromEntries(Object.entries(input.spaces).map(([id, d]) => [id, d.name])),
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + INVITE_DAYS * 864e5),
      usedBy: null,
    };
    try {
      await setDoc(doc(this.db, 'invites', code), data);
    } catch (e) {
      mapError(e);
    }
    return toInvite(code, data);
  }

  async myInvites(): Promise<Invite[]> {
    try {
      const snap = await getDocs(query(collection(this.db, 'invites'), where('ownerId', '==', this.me)));
      return snap.docs.map((d) => toInvite(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (e) {
      mapError(e);
    }
  }

  async deleteInvite(code: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, 'invites', code));
    } catch (e) {
      mapError(e);
    }
  }

  async getInvite(code: string): Promise<Invite> {
    try {
      const snap = await getDoc(doc(this.db, 'invites', code));
      if (!snap.exists()) throw new SharingError('not-found');
      return toInvite(code, snap.data());
    } catch (e) {
      if (e instanceof SharingError) throw e;
      mapError(e);
    }
  }

  /** Claims the invitation and joins its spaces in one atomic write. */
  async acceptInvite(code: string): Promise<Invite> {
    const invite = await this.getInvite(code);
    if (invite.ownerId === this.me) throw new SharingError('own');
    if (invite.usedBy && invite.usedBy !== this.me) throw new SharingError('used');
    if (invite.usedBy === this.me) return invite; // already accepted (e.g. another device)
    if (new Date(invite.expiresAt).getTime() < Date.now()) throw new SharingError('expired');
    const name = this.myName();
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, 'invites', code), { usedBy: this.me, usedByName: name, usedAt: Timestamp.now() });
    for (const [spaceId, role] of Object.entries(invite.grants)) {
      batch.update(doc(this.db, 'spaces', spaceId), {
        memberIds: arrayUnion(this.me),
        [`roles.${this.me}`]: role,
        [`names.${this.me}`]: name,
        joinedWith: code,
        ...(invite.assign === spaceId ? { assignee: this.me } : {}),
        updatedAt: Timestamp.now(),
      });
    }
    try {
      await batch.commit();
    } catch (e) {
      mapError(e);
    }
    this.onSpacesChanged();
    return { ...invite, usedBy: this.me, usedByName: name };
  }
}
