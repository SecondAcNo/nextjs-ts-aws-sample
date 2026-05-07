import { AuthUser, Role } from "../types/auth";

const roleRank: Record<Role, number> = {
  employee: 1,
  manager: 2,
  admin: 3,
};

export function hasRole(user: AuthUser, requiredRole: Role): boolean {
  return roleRank[user.role] >= roleRank[requiredRole];
}

export function isEmployee(user: AuthUser): boolean {
  return user.role === "employee";
}

export function isManager(user: AuthUser): boolean {
  return user.role === "manager";
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === "admin";
}

export function isManagerOrAbove(user: AuthUser): boolean {
  return hasRole(user, "manager");
}