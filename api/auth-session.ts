import type { VercelRequest, VercelResponse } from '@vercel/node';

import { PERMISSIONS_VERSION, ROLE_PERMISSIONS, type Role } from '../shared/authz.js';
import { authorize, type AuthorizedActor } from './_lib/authorize.js';
import { authenticate, type AuthenticatedIdentity } from './_lib/authenticate.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';

export interface AuthSessionDependencies {
  authenticate(req: VercelRequest): Promise<AuthenticatedIdentity>;
  resolveGrantedActor(identity: AuthenticatedIdentity): Promise<AuthorizedActor>;
  resolveLegacyRole(identity: AuthenticatedIdentity): Promise<Role>;
}

interface LegacyEmployeeRecord {
  exists: boolean;
  active?: unknown;
  status?: unknown;
}

function isOperationalProfessional(employee: LegacyEmployeeRecord): boolean {
  return employee.active === true || employee.status === 'active';
}

export function resolveLegacyRoleFromRecords(
  identity: AuthenticatedIdentity,
  directEmployee: LegacyEmployeeRecord,
  emailMatches: readonly LegacyEmployeeRecord[] = [],
): Role {
  if (directEmployee.exists) {
    return isOperationalProfessional(directEmployee) ? 'professional' : 'candidate';
  }

  if (!identity.emailVerified || !identity.email) return 'client';
  if (emailMatches.some(isOperationalProfessional)) return 'professional';
  if (emailMatches.some((employee) => employee.exists)) return 'candidate';
  return 'client';
}

async function resolveLegacyRole(
  identity: AuthenticatedIdentity,
): Promise<Role> {
  const employee = await getAdminFirestore()
    .collection('employees')
    .doc(identity.uid)
    .get();

  if (employee.exists || !identity.emailVerified || !identity.email) {
    return resolveLegacyRoleFromRecords(identity, {
      exists: employee.exists,
      active: employee.exists ? employee.get('active') : undefined,
      status: employee.exists ? employee.get('status') : undefined,
    });
  }

  const legacyEmployees = await getAdminFirestore()
    .collection('employees')
    .where('email', '==', identity.email)
    .limit(5)
    .get();

  return resolveLegacyRoleFromRecords(
    identity,
    { exists: false },
    legacyEmployees.docs.map((document) => ({
      exists: true,
      active: document.get('active'),
      status: document.get('status'),
    })),
  );
}

const defaultDependencies: AuthSessionDependencies = {
  authenticate,
  resolveGrantedActor: (identity) => authorize(identity, []),
  resolveLegacyRole,
};

export function createAuthSessionHandler(
  dependencies: AuthSessionDependencies = defaultDependencies,
) {
  return async function authSessionHandler(
    req: VercelRequest,
    res: VercelResponse,
  ): Promise<void> {
    applyNoStore(res);
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      return;
    }

    try {
      const identity = await dependencies.authenticate(req);
      let roles: Role[];
      let permissions: string[];
      let authzSource: 'access_grant' | 'legacy_email' | 'legacy_profile' | 'default_client';

      try {
        const actor = await dependencies.resolveGrantedActor(identity);
        roles = actor.roles;
        permissions = actor.permissions;
        authzSource = actor.authzSource;
      } catch (error) {
        if (!(error instanceof HttpError) || error.code !== 'PERMISSION_DENIED') {
          throw error;
        }

        const legacyRole = await dependencies.resolveLegacyRole(identity);
        roles = [legacyRole];
        permissions = [...ROLE_PERMISSIONS[legacyRole]];
        authzSource = legacyRole === 'client' ? 'default_client' : 'legacy_profile';
      }

      res.status(200).json({
        uid: identity.uid,
        roles,
        permissions,
        permissionsVersion: PERMISSIONS_VERSION,
        authzSource,
      });
    } catch (error) {
      const httpError = toHttpError(error);
      res.status(httpError.status).json({
        error: httpError.code,
        message: httpError.message,
      });
    }
  };
}

export default createAuthSessionHandler();
