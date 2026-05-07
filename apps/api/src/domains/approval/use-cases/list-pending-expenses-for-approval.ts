import { canApproveExpense, canViewApprovals } from "../../../shared/auth/permissions";
import type { AuthUser } from "../../../shared/types/auth";
import type { Expense } from "../../expense/types";

export function listPendingExpensesForApproval(
  user: AuthUser,
  expenses: Expense[],
): Expense[] {
  if (!canViewApprovals(user)) {
    return [];
  }

  return expenses.filter((expense) => canApproveExpense(user, expense));
}
