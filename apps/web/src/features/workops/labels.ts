import type { AdminUser, AttendanceStatus, Expense, Role } from "./types";

export function roleLabel(role: Role | string): string {
  const labels: Record<string, string> = {
    admin: "管理者",
    employee: "従業員",
    manager: "マネージャー",
  };

  return labels[role] ?? role;
}

export function attendanceStatusLabel(status: AttendanceStatus | string | undefined): string {
  const labels: Record<string, string> = {
    finished: "退勤済み",
    not_started: "未打刻",
    working: "勤務中",
  };

  return labels[status ?? ""] ?? "-";
}

export function expenseStatusLabel(status: Expense["status"] | string): string {
  const labels: Record<string, string> = {
    approved: "承認済み",
    draft: "下書き",
    rejected: "却下",
    submitted: "申請中",
  };

  return labels[status] ?? status;
}

export function authModeLabel(mode: "local" | "cognito"): string {
  const labels: Record<"local" | "cognito", string> = {
    cognito: "AWS認証",
    local: "ローカル",
  };

  return labels[mode];
}

export function roleScopeLabel(role: Role | string | undefined): string {
  const labels: Record<string, string> = {
    admin: "全体管理と監査確認",
    employee: "自分の業務データ",
    manager: "自分と従業員の承認対象",
  };

  return labels[role ?? ""] ?? "認証後に確定";
}

export function rolePermissionLabels(role: Role | string | undefined): string[] {
  if (role === "admin") {
    return ["日報・勤怠・経費の利用", "経費申請の承認・却下", "ユーザー管理", "操作履歴の確認"];
  }

  if (role === "manager") {
    return ["日報・勤怠・経費の利用", "従業員の経費申請を承認・却下"];
  }

  if (role === "employee") {
    return ["日報・勤怠・経費の利用", "自分の申請状況を確認"];
  }

  return ["認証後に利用可能な権限を表示"];
}

export function formatCurrencyYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    style: "currency",
  }).format(amount);
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "expense.approved": "経費を承認",
    "expense.rejected": "経費を却下",
    "expense.submitted": "経費を申請",
  };

  return labels[action] ?? action;
}

export function resourceTypeLabel(resourceType: string): string {
  const labels: Record<string, string> = {
    attendance: "勤怠",
    daily_report: "日報",
    expense_request: "経費申請",
    user: "ユーザー",
  };

  return labels[resourceType] ?? resourceType;
}

export function countUsersByRole(users: AdminUser[], role: AdminUser["role"]): number {
  return users.filter((user) => user.role === role).length;
}

export function countExpensesByStatus(expenses: Expense[], status: Expense["status"]): number {
  return expenses.filter((expense) => expense.status === status).length;
}
