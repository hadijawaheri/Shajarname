/** App roles — flat strings with hierarchy enforced in RolesGuard. */
export const APP_ROLES = ['admin', 'editor', 'member'] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Rank: higher can satisfy lower requirements when required includes that lower role. */
export const ROLE_RANK: Record<AppRole, number> = {
  member: 0,
  editor: 1,
  admin: 2,
};

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === 'string' &&
    (APP_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Whether `userRole` satisfies any of `required` roles.
 * Admin satisfies editor; exact match otherwise.
 */
export function roleSatisfies(
  userRole: string | undefined,
  required: string[],
): boolean {
  if (!userRole || !required.length) return false;
  if (required.includes(userRole)) return true;
  if (userRole === 'admin' && required.includes('editor')) return true;
  return false;
}

export function canMutateTree(role: string | undefined): boolean {
  return role === 'admin' || role === 'editor';
}

export function canManageUsers(role: string | undefined): boolean {
  return role === 'admin';
}
