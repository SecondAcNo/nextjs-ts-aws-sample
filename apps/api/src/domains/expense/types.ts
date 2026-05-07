import type { Role } from "../../shared/types/auth";

export const expenseStatuses = ["draft", "submitted", "approved", "rejected"] as const;

export type ExpenseStatus = (typeof expenseStatuses)[number];

export type Expense = {
  id: string;
  userId: string;
  ownerRole: Role;
  title: string;
  amount: number;
  purpose: string;
  submittedAt: Date | null;
  status: ExpenseStatus;
  approverUserId: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
};
