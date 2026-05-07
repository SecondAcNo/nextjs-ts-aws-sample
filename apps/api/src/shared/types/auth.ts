export const roles = ["employee", "manager", "admin"] as const;

export type Role = (typeof roles)[number];

export type AuthUser = {
  userId: string;
  role: Role;
};