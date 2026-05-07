"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { Metric, Panel } from "@/components/panel";
import { createWorkOpsApi } from "@/features/workops/api";
import {
  completeCognitoLogin,
  getAuthMode,
  getStoredCognitoSession,
  signOutWithCognito,
  startCognitoLogin,
  type CognitoSession,
} from "@/features/workops/auth";
import { formatDateTime } from "@/features/workops/format";
import {
  attendanceStatusLabel,
  auditActionLabel,
  countExpensesByStatus,
  countUsersByRole,
  expenseStatusLabel,
  formatCurrencyYen,
  resourceTypeLabel,
  roleLabel,
} from "@/features/workops/labels";
import type {
  AdminUser,
  ApiUser,
  AttendanceRecord,
  AuditLog,
  DailyReport,
  Expense,
} from "@/features/workops/types";

import { ApprovalsPanel } from "./approvals-panel";
import { AttendancePanel } from "./attendance-panel";
import { DailyReportsPanel } from "./daily-reports-panel";
import { ExpensesPanel } from "./expenses-panel";
import { WorkOpsAppFrame } from "./workops-app-frame";

export type WorkOpsPage =
  | "dashboard"
  | "reports"
  | "attendance"
  | "expenses"
  | "approvals"
  | "admin-users"
  | "admin-audit-logs";

const devUsers = [
  { email: "employee@example.com", label: "従業員" },
  { email: "manager@example.com", label: "マネージャー" },
  { email: "admin@example.com", label: "管理者" },
] as const;

const pageTitles: Record<WorkOpsPage, string> = {
  dashboard: "ダッシュボード",
  reports: "日報",
  attendance: "勤怠",
  expenses: "経費申請",
  approvals: "承認",
  "admin-users": "ユーザー管理",
  "admin-audit-logs": "操作履歴",
};

const pageDescriptions: Record<WorkOpsPage, string> = {
  dashboard: "業務データの概要、今日の勤怠、承認待ち件数を確認します。",
  reports: "日報を作成し、登録済みの日報を一覧で確認します。",
  attendance: "今日の出勤・退勤を記録し、勤怠履歴を確認します。",
  expenses: "経費申請を作成し、自分が扱える申請の状態を確認します。",
  approvals: "マネージャーまたは管理者として、承認待ちの経費申請を処理します。",
  "admin-users": "管理者として、登録済みユーザーとロールを確認します。",
  "admin-audit-logs": "管理者として、業務操作の履歴を確認します。",
};

export function WorkOpsShell({ currentPage }: { currentPage: WorkOpsPage }) {
  const authMode = getAuthMode();
  const [selectedEmail, setSelectedEmail] = useState<string>(devUsers[0].email);
  const [cognitoSession, setCognitoSession] = useState<CognitoSession | null>(null);
  const [me, setMe] = useState<ApiUser | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [approvals, setApprovals] = useState<Expense[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reportTitle, setReportTitle] = useState("");
  const [reportBody, setReportBody] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePurpose, setExpensePurpose] = useState("");
  const [message, setMessage] = useState("読み込み中");
  const [isLoading, setIsLoading] = useState(false);

  const api = useMemo(
    () =>
      createWorkOpsApi(
        authMode === "local"
          ? {
              mode: "local",
              email: selectedEmail,
            }
          : {
              mode: "cognito",
              accessToken: cognitoSession?.accessToken ?? "",
            },
      ),
    [authMode, cognitoSession, selectedEmail],
  );

  const loadDashboard = useCallback(async () => {
    if (authMode === "cognito" && !cognitoSession) {
      setMessage("Cognitoでサインインしてください");
      return;
    }

    setIsLoading(true);
    setMessage("読み込み中");

    try {
      const dashboard = await api.loadDashboard();

      setMe(dashboard.me);
      setReports(dashboard.reports);
      setTodayAttendance(dashboard.todayAttendance);
      setAttendanceHistory(dashboard.attendanceHistory);
      setExpenses(dashboard.expenses);
      setApprovals(dashboard.approvals);
      setAdminUsers(dashboard.adminUsers);
      setAuditLogs(dashboard.auditLogs);

      setMessage("表示中");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [api, authMode, cognitoSession]);

  useEffect(() => {
    if (authMode !== "cognito") {
      return;
    }

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      queueMicrotask(() => setMessage(`Cognitoサインイン失敗: ${error}`));
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (!code) {
      queueMicrotask(() => setCognitoSession(getStoredCognitoSession()));
      return;
    }

    void completeCognitoLogin(code)
      .then((session) => {
        setCognitoSession(session);
        setMessage("Cognitoサインイン完了");
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((error_: unknown) => {
        setMessage(error_ instanceof Error ? error_.message : "Cognitoサインインに失敗しました");
      });
  }, [authMode]);

  useEffect(() => {
    // Initial and user-switch data synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  async function signInWithCognito() {
    setMessage("Cognitoへリダイレクト中");
    await startCognitoLogin();
  }

  function signOutFromCognito() {
    setCognitoSession(null);
    setMe(null);
    setReports([]);
    setTodayAttendance(null);
    setAttendanceHistory([]);
    setExpenses([]);
    setApprovals([]);
    setAdminUsers([]);
    setAuditLogs([]);
    setMessage("サインアウトしました");
    signOutWithCognito();
  }

  async function createDailyReport() {
    setIsLoading(true);
    setMessage("処理中");

    try {
      await api.createDailyReport({
        title: reportTitle,
        body: reportBody,
      });
      setReportTitle("");
      setReportBody("");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "日報の作成に失敗しました");
      setIsLoading(false);
    }
  }

  async function createExpense() {
    setIsLoading(true);
    setMessage("処理中");

    try {
      await api.createExpense({
        title: expenseTitle,
        amount: Number(expenseAmount),
        purpose: expensePurpose,
      });
      setExpenseTitle("");
      setExpenseAmount("");
      setExpensePurpose("");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "経費申請の作成に失敗しました");
      setIsLoading(false);
    }
  }

  async function clockIn() {
    await runMutation(() => api.clockIn(), "出勤処理に失敗しました");
  }

  async function clockOut() {
    await runMutation(() => api.clockOut(), "退勤処理に失敗しました");
  }

  async function submitExpense(id: string) {
    await runMutation(() => api.submitExpense(id), "経費申請の提出に失敗しました");
  }

  async function approveExpense(id: string) {
    await runMutation(() => api.approveExpense(id), "承認処理に失敗しました");
  }

  async function rejectExpense(id: string) {
    await runMutation(() => api.rejectExpense(id), "却下処理に失敗しました");
  }

  async function runMutation(action: () => Promise<unknown>, fallbackMessage: string) {
    setIsLoading(true);
    setMessage("処理中");

    try {
      await action();
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallbackMessage);
      setIsLoading(false);
    }
  }

  const canApprove = me?.role === "manager" || me?.role === "admin";
  const canAdmin = me?.role === "admin";

  return (
    <WorkOpsAppFrame
      authMode={authMode}
      canAdmin={canAdmin}
      canApprove={canApprove}
      devUsers={devUsers}
      isLoading={isLoading}
      me={me}
      message={message}
      onSelectedEmailChange={setSelectedEmail}
      onSignIn={signInWithCognito}
      onSignOut={signOutFromCognito}
      pageDescription={pageDescriptions[currentPage]}
      pageTitle={pageTitles[currentPage]}
      selectedEmail={selectedEmail}
    >
      <PageBody
        approvals={approvals}
        attendanceHistory={attendanceHistory}
        auditLogs={auditLogs}
        canAdmin={canAdmin}
        canApprove={canApprove}
        currentPage={currentPage}
        expenseAmount={expenseAmount}
        expensePurpose={expensePurpose}
        expenseTitle={expenseTitle}
        expenses={expenses}
        isLoading={isLoading}
        onAmountChange={setExpenseAmount}
        onApprove={approveExpense}
        onClockIn={clockIn}
        onClockOut={clockOut}
        onCreateDailyReport={createDailyReport}
        onCreateExpense={createExpense}
        onPurposeChange={setExpensePurpose}
        onReject={rejectExpense}
        onReportBodyChange={setReportBody}
        onReportTitleChange={setReportTitle}
        onSubmitExpense={submitExpense}
        onTitleChange={setExpenseTitle}
        reportBody={reportBody}
        reports={reports}
        reportTitle={reportTitle}
        todayAttendance={todayAttendance}
        users={adminUsers}
      />
    </WorkOpsAppFrame>
  );
}

function PageBody({
  approvals,
  attendanceHistory,
  auditLogs,
  canAdmin,
  canApprove,
  currentPage,
  expenseAmount,
  expensePurpose,
  expenseTitle,
  expenses,
  isLoading,
  onAmountChange,
  onApprove,
  onClockIn,
  onClockOut,
  onCreateDailyReport,
  onCreateExpense,
  onPurposeChange,
  onReject,
  onReportBodyChange,
  onReportTitleChange,
  onSubmitExpense,
  onTitleChange,
  reportBody,
  reports,
  reportTitle,
  todayAttendance,
  users,
}: {
  approvals: Expense[];
  attendanceHistory: AttendanceRecord[];
  auditLogs: AuditLog[];
  canAdmin: boolean;
  canApprove: boolean;
  currentPage: WorkOpsPage;
  expenseAmount: string;
  expensePurpose: string;
  expenseTitle: string;
  expenses: Expense[];
  isLoading: boolean;
  onAmountChange: (value: string) => void;
  onApprove: (id: string) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onCreateDailyReport: () => void;
  onCreateExpense: () => void;
  onPurposeChange: (value: string) => void;
  onReject: (id: string) => void;
  onReportBodyChange: (value: string) => void;
  onReportTitleChange: (value: string) => void;
  onSubmitExpense: (id: string) => void;
  onTitleChange: (value: string) => void;
  reportBody: string;
  reports: DailyReport[];
  reportTitle: string;
  todayAttendance: AttendanceRecord | null;
  users: AdminUser[];
}) {
  if (currentPage === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="日報" value={reports.length} />
          <Metric label="勤怠" value={attendanceStatusLabel(todayAttendance?.status)} />
          <Metric label="経費申請" value={expenses.length} />
          <Metric label="承認待ち" value={approvals.length} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="最近の日報">
            <DataTable
              columns={["日付", "ロール", "タイトル"]}
              rows={reports.slice(0, 5).map((report) => [
                report.workDate,
                roleLabel(report.ownerRole),
                report.title,
              ])}
            />
          </Panel>
          <Panel title="承認待ちの経費">
            <DataTable
              columns={["件名", "申請者", "金額", "状態"]}
              rows={approvals.slice(0, 5).map((expense) => [
                expense.title,
                roleLabel(expense.ownerRole),
                formatCurrencyYen(expense.amount),
                expenseStatusLabel(expense.status),
              ])}
            />
          </Panel>
        </div>
      </div>
    );
  }

  if (currentPage === "reports") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="日報件数" value={reports.length} />
          <Metric label="最新日付" value={reports[0]?.workDate ?? "-"} />
          <Metric label="表示対象" value="自分と権限範囲" />
        </div>
        <DailyReportsPanel
          isLoading={isLoading}
          onBodyChange={onReportBodyChange}
          onCreate={onCreateDailyReport}
          onTitleChange={onReportTitleChange}
          reportBody={reportBody}
          reportTitle={reportTitle}
          reports={reports}
        />
      </div>
    );
  }

  if (currentPage === "attendance") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="今日の状態" value={attendanceStatusLabel(todayAttendance?.status)} />
          <Metric label="勤怠履歴" value={attendanceHistory.length} />
          <Metric label="基準タイムゾーン" value="Asia/Tokyo" />
        </div>
        <AttendancePanel
          attendanceHistory={attendanceHistory}
          isLoading={isLoading}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
          todayAttendance={todayAttendance}
        />
      </div>
    );
  }

  if (currentPage === "expenses") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="経費申請" value={expenses.length} />
          <Metric label="下書き" value={countExpensesByStatus(expenses, "draft")} />
          <Metric label="申請中" value={countExpensesByStatus(expenses, "submitted")} />
          <Metric label="承認済み" value={countExpensesByStatus(expenses, "approved")} />
        </div>
        <ExpensesPanel
          expenseAmount={expenseAmount}
          expensePurpose={expensePurpose}
          expenseTitle={expenseTitle}
          expenses={expenses}
          isLoading={isLoading}
          onAmountChange={onAmountChange}
          onCreate={onCreateExpense}
          onPurposeChange={onPurposeChange}
          onSubmit={onSubmitExpense}
          onTitleChange={onTitleChange}
        />
      </div>
    );
  }

  if (currentPage === "approvals") {
    if (!canApprove) {
      return <AccessDenied />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="承認待ち" value={approvals.length} />
          <Metric label="対象範囲" value="従業員" />
          <Metric label="操作" value="承認 / 却下" />
        </div>
        <ApprovalsPanel
          approvals={approvals}
          onApprove={onApprove}
          onReject={onReject}
        />
      </div>
    );
  }

  if (currentPage === "admin-users") {
    if (!canAdmin) {
      return <AccessDenied />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="ユーザー" value={users.length} />
          <Metric label="従業員" value={countUsersByRole(users, "employee")} />
          <Metric label="マネージャー" value={countUsersByRole(users, "manager")} />
          <Metric label="管理者" value={countUsersByRole(users, "admin")} />
        </div>
        <Panel title="ユーザー一覧">
          <DataTable
            columns={["名前", "メールアドレス", "ロール"]}
            rows={users.map((user) => [user.name, user.email, roleLabel(user.role)])}
          />
        </Panel>
      </div>
    );
  }

  if (!canAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="履歴件数" value={auditLogs.length} />
        <Metric label="最新操作" value={auditActionLabel(auditLogs[0]?.action ?? "-")} />
        <Metric label="監査対象" value="業務操作" />
      </div>
      <Panel title="操作履歴">
        <DataTable
          columns={["実行者", "操作", "対象", "日時"]}
          rows={auditLogs.map((log) => [
            log.actor.email,
            auditActionLabel(log.action),
            resourceTypeLabel(log.resourceType),
            formatDateTime(log.createdAt),
          ])}
        />
      </Panel>
    </div>
  );
}

function AccessDenied() {
  return (
    <Panel title="アクセス権限がありません">
      <p className="text-sm text-slate-600">
        この画面は現在のロールでは表示できません。API側の認可も同じルールで保護されています。
      </p>
    </Panel>
  );
}
