import type { UserRole } from "@/server/db/schema";

export const ADMIN_ROLE: UserRole = "admin";

type RoleHolder = {
  role: UserRole;
};

export function isAdminRole(role: UserRole): boolean {
  return role === ADMIN_ROLE;
}

export function isAdminUser(user: RoleHolder | null | undefined): boolean {
  return user !== null && user !== undefined && isAdminRole(user.role);
}
