import { canViewExpense } from "../../../shared/auth/permissions";
import type { AuthUser } from "../../../shared/types/auth";
import type { Expense } from "../types";

export function listViewableExpenses(
  user: AuthUser,
  expenses: Expense[],
): Expense[] {
  return expenses.filter((expense) => canViewExpense(user, expense));
}