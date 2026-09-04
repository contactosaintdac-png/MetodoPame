import { getAdminAuth, getAdminFirestore } from './firebase-admin.js';
import { parseAccessGrant } from './access-grants.js';

/**
 * Firebase Auth is not part of a Firestore transaction. Firestore remains
 * authoritative; this best-effort projection is explicitly recoverable.
 */
export async function syncGrantClaims(uid: string): Promise<'synced' | 'error'> {
  const grantRef = getAdminFirestore().collection('access_grants').doc(uid);
  const snapshot = await grantRef.get();
  const grant = parseAccessGrant(snapshot.data());
  if (!grant) {
    await grantRef.set({ claimSyncState: 'error' }, { merge: true });
    return 'error';
  }

  try {
    await getAdminAuth().setCustomUserClaims(uid, {
      metodoPame: { roles: grant.roles, permissionsVersion: grant.permissionsVersion },
    });
    await grantRef.set({ claimSyncState: 'synced' }, { merge: true });
    return 'synced';
  } catch {
    await grantRef.set({ claimSyncState: 'error' }, { merge: true });
    return 'error';
  }
}
