import {
  PERMISSIONS_VERSION,
  isPermission,
  isRole,
  type Permission,
  type Role,
} from '../../shared/authz';

export type AuthzSource =
  | 'access_grant'
  | 'legacy_email'
  | 'legacy_profile'
  | 'default_client';

export interface AuthSession {
  uid: string;
  roles: readonly Role[];
  permissions: readonly Permission[];
  permissionsVersion: number;
  authzSource: AuthzSource;
}

export interface SessionUser {
  uid: string;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const AUTHZ_SOURCES = new Set<AuthzSource>([
  'access_grant',
  'legacy_email',
  'legacy_profile',
  'default_client',
]);

function isAuthSession(value: unknown, expectedUid: string): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthSession>;

  return (
    candidate.uid === expectedUid &&
    candidate.permissionsVersion === PERMISSIONS_VERSION &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every(isRole) &&
    Array.isArray(candidate.permissions) &&
    candidate.permissions.every(isPermission) &&
    typeof candidate.authzSource === 'string' &&
    AUTHZ_SOURCES.has(candidate.authzSource as AuthzSource)
  );
}

export async function fetchAuthSession(
  user: SessionUser,
  fetcher: Fetcher = fetch,
  forceTokenRefresh = false,
): Promise<AuthSession> {
  const token = await user.getIdToken(forceTokenRefresh);
  const response = await fetcher('/api/auth-session', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Authorization session failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isAuthSession(payload, user.uid)) {
    throw new Error('Invalid authorization session');
  }

  return payload;
}

export function hasSessionPermission(
  session: AuthSession | null,
  permission: Permission,
): boolean {
  return session?.permissions.includes(permission) ?? false;
}

export function deriveApplicationRole(
  session: AuthSession | null,
): 'client' | 'specialist' | 'admin' {
  if (hasSessionPermission(session, 'admin.dashboard.read')) return 'admin';
  if (session?.roles.includes('professional')) return 'specialist';
  return 'client';
}
