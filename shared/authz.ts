export const PERMISSIONS = [
  'identity.grants.read',
  'identity.grants.manage_non_owner',
  'identity.owner.manage',
  'audit.read',
  'admin.dashboard.read',
  'crm.read',
  'crm.write',
  'bookings.read_all',
  'bookings.manage',
  'availability.manage_all',
  'finance.read',
  'finance.manage',
  'communications.send',
  'integrations.execute',
  'automations.execute',
  'candidates.read',
  'candidates.review',
  'candidates.decide',
  'professionals.read',
  'professionals.manage',
  'training.consume',
  'training.review',
  'training.content.manage',
  'training.certify',
  'profile.client.manage_self',
  'profile.candidate.manage_self',
  'profile.professional.manage_self',
  'bookings.read_own',
  'bookings.request_own',
  'bookings.read_assigned',
  'bookings.update_assigned_status',
  'availability.manage_self',
  'assistant.chat.use',
  'assistant.read_scoped',
  'system.outbox.execute',
  'system.cron.execute',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  'owner',
  'admin',
  'operations_manager',
  'finance',
  'candidate_reviewer',
  'training_reviewer',
  'professional',
  'candidate',
  'client',
  'automation_service',
  'ai_assistant',
] as const;

export type Role = (typeof ROLES)[number];

const HUMAN_PERMISSIONS = PERMISSIONS.filter(
  (permission) =>
    !permission.startsWith('system.') && permission !== 'assistant.read_scoped',
);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: HUMAN_PERMISSIONS,
  admin: [
    'identity.grants.read',
    'identity.grants.manage_non_owner',
    'audit.read',
    'admin.dashboard.read',
    'crm.read',
    'crm.write',
    'bookings.read_all',
    'bookings.manage',
    'availability.manage_all',
    'finance.read',
    'communications.send',
    'integrations.execute',
    'automations.execute',
    'candidates.read',
    'candidates.review',
    'professionals.read',
    'professionals.manage',
    'training.review',
    'training.content.manage',
    'training.certify',
  ],
  operations_manager: [
    'admin.dashboard.read',
    'crm.read',
    'crm.write',
    'bookings.read_all',
    'bookings.manage',
    'availability.manage_all',
    'communications.send',
    'candidates.read',
    'professionals.read',
  ],
  finance: ['bookings.read_all', 'finance.read', 'finance.manage'],
  candidate_reviewer: ['candidates.read', 'candidates.review'],
  training_reviewer: [
    'professionals.read',
    'training.review',
    'training.content.manage',
    'training.certify',
  ],
  professional: [
    'training.consume',
    'profile.professional.manage_self',
    'bookings.read_assigned',
    'bookings.update_assigned_status',
    'availability.manage_self',
  ],
  candidate: ['profile.candidate.manage_self'],
  client: [
    'profile.client.manage_self',
    'bookings.read_own',
    'bookings.request_own',
    'assistant.chat.use',
  ],
  automation_service: [
    'communications.send',
    'integrations.execute',
    'system.outbox.execute',
    'system.cron.execute',
  ],
  ai_assistant: ['assistant.read_scoped'],
};

export const PERMISSIONS_VERSION = 2;

const PERMISSION_SET = new Set<string>(PERMISSIONS);
const ROLE_SET = new Set<string>(ROLES);

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_SET.has(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function resolvePermissions(
  roles: readonly Role[],
  allow: readonly Permission[] = [],
  deny: readonly Permission[] = [],
): Set<Permission> {
  const resolved = new Set<Permission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) resolved.add(permission);
  }

  for (const permission of allow) resolved.add(permission);
  for (const permission of deny) resolved.delete(permission);

  return resolved;
}
