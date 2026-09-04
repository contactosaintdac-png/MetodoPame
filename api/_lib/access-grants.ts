import { getAdminFirestore } from './firebase-admin.js';
import {
  PERMISSIONS_VERSION,
  isPermission,
  isRole,
  type Permission,
  type Role,
} from '../../shared/authz.js';

export type ClaimSyncState = 'pending' | 'synced' | 'error';

export interface AccessGrant {
  schemaVersion: 1;
  active: boolean;
  roles: Role[];
  effectivePermissions: Permission[];
  permissionsVersion: number;
  claimSyncState: ClaimSyncState;
}

export interface AccessGrantRepository {
  getByUid(uid: string): Promise<AccessGrant | null>;
}

export function parseAccessGrant(value: unknown): AccessGrant | null {
  if (!value || typeof value !== 'object') return null;
  const grant = value as Record<string, unknown>;

  if (
    grant.schemaVersion !== 1 ||
    typeof grant.active !== 'boolean' ||
    !Array.isArray(grant.roles) ||
    !grant.roles.every(isRole) ||
    !Array.isArray(grant.effectivePermissions) ||
    !grant.effectivePermissions.every(isPermission) ||
    typeof grant.permissionsVersion !== 'number' ||
    !['pending', 'synced', 'error'].includes(String(grant.claimSyncState))
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    active: grant.active,
    roles: [...new Set(grant.roles as Role[])],
    effectivePermissions: [
      ...new Set(grant.effectivePermissions as Permission[]),
    ],
    permissionsVersion: grant.permissionsVersion,
    claimSyncState: grant.claimSyncState as ClaimSyncState,
  };
}

export function createFirestoreAccessGrantRepository(): AccessGrantRepository {
  return {
    async getByUid(uid) {
      const snapshot = await getAdminFirestore().collection('access_grants').doc(uid).get();
      if (!snapshot.exists) return null;

      const parsed = parseAccessGrant(snapshot.data());
      if (!parsed || parsed.permissionsVersion !== PERMISSIONS_VERSION) {
        return {
          schemaVersion: 1,
          active: false,
          roles: [],
          effectivePermissions: [],
          permissionsVersion: Number(snapshot.get('permissionsVersion') ?? -1),
          claimSyncState: 'error',
        };
      }

      return parsed;
    },
  };
}
