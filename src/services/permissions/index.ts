/**
 * Generic sharing & permission model (section 12/35). Designed for calendars
 * first, reusable by Family, 2ndBrain folders, task projects, etc.
 */
export type ShareRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'updateContainer' | 'share' | 'managePermissions';

const matrix: Record<ShareRole, readonly PermissionAction[]> = {
  owner: ['read', 'create', 'update', 'delete', 'updateContainer', 'share', 'managePermissions'],
  admin: ['read', 'create', 'update', 'delete', 'updateContainer', 'share', 'managePermissions'],
  editor: ['read', 'create', 'update'],
  viewer: ['read'],
};

export function can(role: ShareRole | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  return matrix[role].includes(action);
}

export type ShareStatus = 'pending' | 'accepted' | 'rejected' | 'revoked';

/** A share/invitation of any resource with another AUN user. Persisted by the backend (Phase 9). */
export interface ShareGrant {
  id: string;
  resourceType: 'calendar' | 'family' | 'folder' | 'project' | (string & {});
  resourceId: string;
  ownerId: string;
  inviteeEmail: string;
  inviteeUserId?: string | null;
  role: Exclude<ShareRole, 'owner'>;
  status: ShareStatus;
  createdAt: string;
  respondedAt?: string | null;
}
