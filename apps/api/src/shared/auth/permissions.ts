import type { DailyReport } from "../../domains/daily-report/types";
import type { Expense } from "../../domains/expense/types";
import type { AuthUser, Role } from "../types/auth";
import { isAdmin, isManagerOrAbove } from "./roles";

export type ResourceOwner = {
  userId: string;
  ownerRole: Role;
};

export function isSelf(user: AuthUser, targetUserId: string): boolean {
  return user.userId === targetUserId;
}

export function canViewOwnResource(
  user: AuthUser,
  resource: ResourceOwner,
): boolean {
  return isSelf(user, resource.userId);
}

export function canManageResourceOwner(
  user: AuthUser,
  resource: ResourceOwner,
): boolean {
  if (isAdmin(user)) {
    return true;
  }

  return user.role === "manager" && resource.ownerRole === "employee";
}

export function canViewApprovals(user: AuthUser): boolean {
  return isManagerOrAbove(user);
}

export function canViewAdminPage(user: AuthUser): boolean {
  return isAdmin(user);
}

export function canViewExpense(
  user: AuthUser,
  expense: Pick<Expense, "userId" | "ownerRole">,
): boolean {
  return isSelf(user, expense.userId) || canManageResourceOwner(user, expense);
}

export function canApproveExpense(
  user: AuthUser,
  expense: Pick<Expense, "userId" | "ownerRole" | "status">,
): boolean {
  return canManageResourceOwner(user, expense) && expense.status === "submitted";
}

export function canSubmitExpense(
  user: AuthUser,
  expense: Pick<Expense, "userId" | "status">,
): boolean {
  return isSelf(user, expense.userId) && expense.status === "draft";
}

export function canViewDailyReport(
  user: AuthUser,
  report: Pick<DailyReport, "userId" | "ownerRole">,
): boolean {
  return isSelf(user, report.userId) || canManageResourceOwner(user, report);
}

export function canEditDailyReport(
  user: AuthUser,
  report: Pick<DailyReport, "userId">,
): boolean {
  return isSelf(user, report.userId);
}

export function canViewAttendance(
  user: AuthUser,
  attendance: ResourceOwner,
): boolean {
  return isSelf(user, attendance.userId) || canManageResourceOwner(user, attendance);
}
