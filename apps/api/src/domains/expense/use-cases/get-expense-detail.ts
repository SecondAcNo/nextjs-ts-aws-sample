import type { AuthUser } from "../../../shared/types/auth";
import { canViewExpense } from "../../../shared/auth/permissions";
import type { Expense } from "../types";

export function getExpenseDetail(
  user: AuthUser,
  expense: Expense,
): Expense | null {
  if (!canViewExpense(user, expense)) {
    return null;
  }

  return expense;
}