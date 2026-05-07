import type {
  AdminUser,
  ApiUser,
  AttendanceRecord,
  AuditLog,
  DailyReport,
  DashboardData,
  Expense,
} from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type WorkOpsApiAuth =
  | {
      mode: "local";
      email: string;
    }
  | {
      mode: "cognito";
      accessToken: string;
    };

export function createWorkOpsApi(auth: WorkOpsApiAuth) {
  const defaultHeaders: Record<string, string> =
    auth.mode === "local"
      ? {
          "content-type": "application/json",
          "x-dev-user-email": auth.email,
        }
      : {
          authorization: `Bearer ${auth.accessToken}`,
          "content-type": "application/json",
        };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: mergeHeaders(defaultHeaders, init?.headers),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  return {
    approveExpense: (id: string) =>
      request(`/approvals/expenses/${id}/approve`, { method: "POST" }),
    clockIn: () => request("/attendance/clock-in", { method: "POST" }),
    clockOut: () => request("/attendance/clock-out", { method: "POST" }),
    createDailyReport: (input: { title: string; body: string }) =>
      request("/daily-reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createExpense: (input: { title: string; amount: number; purpose: string }) =>
      request("/expenses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    loadDashboard: async (): Promise<DashboardData> => {
      const meResponse = await request<{ user: ApiUser }>("/me");
      const reportsResponse = await request<{ reports: DailyReport[] }>("/daily-reports");
      const attendanceResponse = await request<{ attendance: AttendanceRecord }>("/attendance/today");
      const historyResponse = await request<{ attendanceRecords: AttendanceRecord[] }>("/attendance/history");
      const expensesResponse = await request<{ expenses: Expense[] }>("/expenses");

      let approvals: Expense[] = [];
      let adminUsers: AdminUser[] = [];
      let auditLogs: AuditLog[] = [];

      if (meResponse.user.role === "manager" || meResponse.user.role === "admin") {
        const approvalsResponse = await request<{ expenses: Expense[] }>("/approvals/expenses");
        approvals = approvalsResponse.expenses;
      }

      if (meResponse.user.role === "admin") {
        const usersResponse = await request<{ users: AdminUser[] }>("/admin/users");
        const logsResponse = await request<{ auditLogs: AuditLog[] }>("/admin/audit-logs");
        adminUsers = usersResponse.users;
        auditLogs = logsResponse.auditLogs;
      }

      return {
        me: meResponse.user,
        reports: reportsResponse.reports,
        todayAttendance: attendanceResponse.attendance,
        attendanceHistory: historyResponse.attendanceRecords,
        expenses: expensesResponse.expenses,
        approvals,
        adminUsers,
        auditLogs,
      };
    },
    rejectExpense: (id: string) =>
      request(`/approvals/expenses/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "MVP画面から却下しました。" }),
      }),
    submitExpense: (id: string) =>
      request(`/expenses/${id}/submit`, { method: "POST" }),
  };
}

function mergeHeaders(
  defaultHeaders: Record<string, string>,
  requestHeaders: HeadersInit | undefined,
): Headers {
  const headers = new Headers(defaultHeaders);

  if (!requestHeaders) {
    return headers;
  }

  new Headers(requestHeaders).forEach((value, key) => {
    headers.set(key, value);
  });

  return headers;
}
