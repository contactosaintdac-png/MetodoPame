import {
  PERMISSIONS_VERSION,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from '../../shared/authz.js';
import {
  createFirestoreAccessGrantRepository,
  type AccessGrant,
  type AccessGrantRepository,
} from './access-grants.js';
import type { AuthenticatedIdentity } from './authenticate.js';
import { HttpError } from './http-errors.js';

export type AuthzMode = 'legacy' | 'hybrid' | 'grants';
export type AuthorizationRequirementMode = 'all' | 'any';

export interface AuthorizedActor extends AuthenticatedIdentity {
  roles: Role[];
  permissions: Permission[];
  authzSource: 'access_grant' | 'legacy_email';
}

interface AuthorizeOptions {
  mode?: AuthzMode;
  requirementMode?: AuthorizationRequirementMode;
  grants?: AccessGrantRepository;
  legacyAdminEmails?: readonly string[];
}

function configuredMode(): AuthzMode {
  const value = process.env.AUTHZ_MODE;
  return value === 'legacy' || value === 'hybrid' || value === 'grants'
    ? value
    : 'grants';
}

function configuredLegacyEmails(): string[] {
  return (process.env.LEGACY_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function hasRequiredPermissions(
  actual: ReadonlySet<Permission>,
  required: readonly Permission[],
  mode: AuthorizationRequirementMode,
): boolean {
  return mode === 'any'
    ? required.some((permission) => actual.has(permission))
    : required.every((permission) => actual.has(permission));
}

function actorFromGrant(
  identity: AuthenticatedIdentity,
  grant: AccessGrant,
): AuthorizedActor {
  return {
    ...identity,
    roles: grant.roles,
    permissions: grant.effectivePermissions,
    authzSource: 'access_grant',
  };
}

function legacyAdminActor(identity: AuthenticatedIdentity): AuthorizedActor {
  return {
    ...identity,
    roles: ['admin'],
    permissions: [...ROLE_PERMISSIONS.admin],
    authzSource: 'legacy_email',
  };
}

function isLegacyAdmin(
  identity: AuthenticatedIdentity,
  emails: readonly string[],
): boolean {
  return Boolean(
    identity.emailVerified &&
      identity.email &&
      emails.some((email) => email.toLowerCase() === identity.email?.toLowerCase()),
  );
}

export async function authorize(
  identity: AuthenticatedIdentity,
  requiredPermission: Permission | readonly Permission[],
  options: AuthorizeOptions = {},
): Promise<AuthorizedActor> {
  const mode = options.mode ?? configuredMode();
  const requirements = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];
  const requirementMode = options.requirementMode ?? 'all';
  const legacyEmails = options.legacyAdminEmails ?? configuredLegacyEmails();

  let actor: AuthorizedActor | null = null;

  if (mode !== 'legacy') {
    let grant: AccessGrant | null;
    try {
      grant = await (options.grants ?? createFirestoreAccessGrantRepository()).getByUid(
        identity.uid,
      );
    } catch {
      throw new HttpError(
        503,
        'AUTHORIZATION_UNAVAILABLE',
        'Authorization service is unavailable',
      );
    }

    if (grant) {
      if (grant.permissionsVersion !== PERMISSIONS_VERSION) {
        throw new HttpError(
          403,
          'AUTHORIZATION_DATA_INVALID',
          'Authorization data requires reconciliation',
        );
      }
      if (!grant.active) {
        throw new HttpError(403, 'ACCESS_GRANT_INACTIVE', 'Access grant is inactive');
      }
      actor = actorFromGrant(identity, grant);
    }
  }

  if (!actor && mode !== 'grants' && isLegacyAdmin(identity, legacyEmails)) {
    actor = legacyAdminActor(identity);
  }

  if (!actor) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
  }

  if (
    !hasRequiredPermissions(
      new Set(actor.permissions),
      requirements as Permission[],
      requirementMode,
    )
  ) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
  }

  return actor;
}
