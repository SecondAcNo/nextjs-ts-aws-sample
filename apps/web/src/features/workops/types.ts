export type Role = "employee" | "manager" | "admin";

export type ApiUser = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export type DailyReport = {
  id: string;
  userId: string;
  ownerRole: Role;
  workDate: string;
  title: string;
  body: string;
};

export type AttendanceStatus = "not_started" | "working" | "finished";

export type AttendanceRecord = {
  id?: string;
  userId: string;
  ownerRole: Role;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceStatus;
};

export type Expense = {
  id: string;
  userId: string;
  ownerRole: Role;
  title: string;
  amount: number;
  purpose: string;
  submittedAt: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  approverUserId: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actor: AdminUser;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
};

export type DashboardData = {
  me: ApiUser;
  reports: DailyReport[];
  todayAttendance: AttendanceRecord;
  attendanceHistory: AttendanceRecord[];
  expenses: Expense[];
  approvals: Expense[];
  adminUsers: AdminUser[];
  auditLogs: AuditLog[];
};
