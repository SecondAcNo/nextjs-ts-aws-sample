import type { UseCaseResult } from "../../../shared/types/use-case-result";
import type { AuthUser } from "../../../shared/types/auth";
import { canApproveExpense } from "../../../shared/auth/permissions";
import type { Expense } from "../../expense/types";

export type RejectExpenseError = "FORBIDDEN" | "INVALID_STATUS";

export function rejectExpense(
  user: AuthUser,
  expense: Expense,
  reason: string,
  approvedAt: Date = new Date(),
): UseCaseResult<Expense, RejectExpenseError> {
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
      status: "rejected",
      approverUserId: user.userId,
      approvedAt,
      rejectedReason: reason,
    },
  };
}
