export const ALLOWED_USER_ROLES = [
  "sales_rep",
  "senior_ae",
  "manager",
  "sales_manager",
  "director",
  "admin",
  "site_manager",
  "ops_manager"
] as const;

export type UserRole = (typeof ALLOWED_USER_ROLES)[number];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  director: 80,
  manager: 60,
  sales_manager: 60,
  ops_manager: 50,
  site_manager: 30,
  senior_ae: 20,
  sales_rep: 10,
};

export interface RoleValidationResult {
  allowed: boolean;
  status: number;
  error?: string;
}

/**
 * Validates role assignment and creation permissions according to privilege rules:
 * 1. Role must be in ALLOWED_USER_ROLES
 * 2. Caller must have user-creation privilege (admin, director, or manager)
 * 3. Only admin or director can create or assign ops_manager
 * 4. Only admin, director or manager can create or assign site_manager
 * 5. Nobody can assign a role above their own
 */
export function validateRoleAssignment(callerRole: string, targetRole: string): RoleValidationResult {
  if (!ALLOWED_USER_ROLES.includes(targetRole as UserRole)) {
    return {
      allowed: false,
      status: 400,
      error: `role must be one of: ${ALLOWED_USER_ROLES.join(", ")}`,
    };
  }

  // Caller role must be authorized to create/manage users
  if (!["admin", "director", "manager"].includes(callerRole)) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: only admins, directors, and managers can create users",
    };
  }

  // only admin or director can create or assign ops_manager
  if (targetRole === "ops_manager" && !["admin", "director"].includes(callerRole)) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: only admin or director can create or assign ops_manager",
    };
  }

  // only admin, director or manager can create or assign site_manager
  if (targetRole === "site_manager" && !["admin", "director", "manager"].includes(callerRole)) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: only admin, director, or manager can create or assign site_manager",
    };
  }

  // nobody can assign a role above their own
  const callerRank = ROLE_HIERARCHY[callerRole as UserRole] ?? 0;
  const targetRank = ROLE_HIERARCHY[targetRole as UserRole] ?? 0;
  if (targetRank > callerRank) {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: nobody can assign a role above their own",
    };
  }

  return { allowed: true, status: 200 };
}
