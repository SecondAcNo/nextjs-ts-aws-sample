import type { UseCaseResult } from "../../../shared/types/use-case-result";
import type { AuthUser } from "../../../shared/types/auth";
import { canApproveExpense } from "../../../shared/auth/permissions";
import type { Expense } from "../../expense/types";

export type ApproveExpenseError = "FORBIDDEN" | "INVALID_STATUS";

export function approveExpense(
  user: AuthUser,
  expense: Expense,
  approvedAt: Date = new Date(),
): UseCaseResult<Expense, ApproveExpenseError> {
  if (!canApproveExpense(user, expense)) {
    return {
      ok: false,
      error: expense.status === "submitted" ? "FORBIDDEN" : "INVALID_STATUS",
    };
  }

  if (expense.status !== "submitted") {
    return {
      ok: false,
      error: "INVALID_STATUS",
    };
  }

  return {
    ok: true,
    value: {
      ...expense,
      status: "approved",
      approverUserId: user.userId,
      approvedAt,
      rejectedReason: null,
    },
  };
}
