import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { Buffer } from "node:buffer";

import { approveExpense } from "../domains/approval/use-cases/approve-expense";
import { listPendingExpensesForApproval } from "../domains/approval/use-cases/list-pending-expenses-for-approval";
import { rejectExpense } from "../domains/approval/use-cases/reject-expense";
import { listViewableDailyReports } from "../domains/daily-report/use-cases/list-viewable-daily-reports";
import type { DailyReport } from "../domains/daily-report/types";
import { listViewableExpenses } from "../domains/expense/use-cases/list-viewable-expenses";
import type { Expense } from "../domains/expense/types";
import {
  canEditDailyReport,
  canSubmitExpense,
  canViewAdminPage,
  canViewAttendance,
} from "../shared/auth/permissions";
import { prisma } from "../shared/database/prisma";
import { authenticateFetchRequest, type AuthenticatedUser } from "./auth";

type HttpHandler = (request: Request) => Promise<Response>;
type AuthenticatedHttpHandler = (
  request: Request,
  user: AuthenticatedUser,
) => Promise<Response>;

const jsonHeaders = {
  "Access-Control-Allow-Headers": "authorization,content-type,x-dev-user-email",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

export function createApiServer(): Server {
  return createServer((request, response) => {
    handleNodeRequest(request, response).catch((error: unknown) => {
      console.error(error);
      writeNodeResponse(
        response,
        json(500, {
          error: "INTERNAL_SERVER_ERROR",
        }),
      ).catch((writeError: unknown) => {
        console.error(writeError);
        response.end();
      });
    });
  });
}

export function startServer(port: number): Server {
  const server = createApiServer();
  server.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });

  return server;
}

export async function handleFetchRequest(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: jsonHeaders,
        status: 204,
      });
    }

    const routeKey = getRouteKey(request);
    const handler = routes[routeKey] ?? getDynamicRouteHandler(request);

    if (!handler) {
      return json(404, {
        error: "NOT_FOUND",
      });
    }

    return await handler(request);
  } catch (error: unknown) {
    console.error(error);

    return json(500, {
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

const routes: Record<string, HttpHandler> = {
  "GET /health": async () =>
    json(200, {
      ok: true,
    }),
  "GET /me": withAuth(async (_request, user) =>
    json(200, {
      user,
    }),
  ),
  "GET /admin/users": withAuth(async (_request, user) => {
    if (!canViewAdminPage(user)) {
      return json(403, {
        error: "FORBIDDEN",
      });
    }

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    return json(200, {
      users: users.map((adminUser) => ({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        createdAt: adminUser.createdAt.toISOString(),
        updatedAt: adminUser.updatedAt.toISOString(),
      })),
    });
  }),
  "GET /admin/audit-logs": withAuth(async (_request, user) => {
    if (!canViewAdminPage(user)) {
      return json(403, {
        error: "FORBIDDEN",
      });
    }

    const auditLogs = await prisma.auditLog.findMany({
      include: {
        actor: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return json(200, {
      auditLogs: auditLogs.map((auditLog) => ({
        id: auditLog.id,
        actorUserId: auditLog.actorUserId,
        actor: {
          id: auditLog.actor.id,
          email: auditLog.actor.email,
          name: auditLog.actor.name,
          role: auditLog.actor.role,
        },
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt.toISOString(),
      })),
    });
  }),
  "GET /daily-reports": withAuth(async (_request, user) => {
    const reports = await prisma.dailyReport.findMany({
      include: {
        user: true,
      },
      orderBy: [
        {
          workDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const viewableReports = listViewableDailyReports(
      user,
      reports.map((report): DailyReport => ({
        id: report.id,
        userId: report.userId,
        ownerRole: report.user.role,
        workDate: toDateOnlyString(report.workDate),
        title: report.title,
        body: report.body,
      })),
    );

    return json(200, {
      reports: viewableReports,
    });
  }),
  "POST /daily-reports": withAuth(async (request, user) => {
    const body = await readJsonBody(request);
    const validation = parseDailyReportInput(body);

    if (!validation.ok) {
      return json(400, {
        error: "BAD_REQUEST",
        message: validation.message,
      });
    }

    const report = await prisma.dailyReport.create({
      data: {
        userId: user.userId,
        workDate: getTokyoWorkDate(),
        title: validation.value.title,
        body: validation.value.body,
      },
      include: {
        user: true,
      },
    });

    return json(201, {
      report: toDailyReportDomain(report),
    });
  }),
  "GET /attendance/today": withAuth(async (_request, user) => {
    const workDate = getTokyoWorkDate();
    const attendance = await prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: user.userId,
          workDate,
        },
      },
    });

    return json(200, {
      attendance: attendance
        ? serializeAttendance({
            ...attendance,
            ownerRole: user.role,
          })
        : {
            userId: user.userId,
            ownerRole: user.role,
            workDate: toDateOnlyString(workDate),
            status: "not_started",
            clockInAt: null,
            clockOutAt: null,
          },
    });
  }),
  "POST /attendance/clock-in": withAuth(async (_request, user) => {
    const now = new Date();
    const workDate = getTokyoWorkDate(now);

    const existingAttendance = await prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: user.userId,
          workDate,
        },
      },
    });

    if (existingAttendance) {
      return json(409, {
        error: "INVALID_ATTENDANCE_STATUS",
        message: "Today's attendance has already started.",
      });
    }

    const attendance = await prisma.attendanceRecord.create({
      data: {
        userId: user.userId,
        workDate,
        clockInAt: now,
        status: "working",
      },
    });

    return json(201, {
      attendance: serializeAttendance({
        ...attendance,
        ownerRole: user.role,
      }),
    });
  }),
  "POST /attendance/clock-out": withAuth(async (_request, user) => {
    const now = new Date();
    const workDate = getTokyoWorkDate(now);

    const attendance = await prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: user.userId,
          workDate,
        },
      },
    });

    if (!attendance || attendance.status !== "working") {
      return json(409, {
        error: "INVALID_ATTENDANCE_STATUS",
        message: "Clock-out is allowed only while working.",
      });
    }

    const updatedAttendance = await prisma.attendanceRecord.update({
      where: {
        id: attendance.id,
      },
      data: {
        clockOutAt: now,
        status: "finished",
      },
    });

    return json(200, {
      attendance: serializeAttendance({
        ...updatedAttendance,
        ownerRole: user.role,
      }),
    });
  }),
  "GET /attendance/history": withAuth(async (request, user) => {
    const requestedUserId = getQueryValue(request, "userId") ?? user.userId;
    const targetUser = await prisma.user.findUnique({
      where: {
        id: requestedUserId,
      },
    });

    if (!targetUser) {
      return json(404, {
        error: "NOT_FOUND",
      });
    }

    if (
      !canViewAttendance(user, {
        userId: targetUser.id,
        ownerRole: targetUser.role,
      })
    ) {
      return json(403, {
        error: "FORBIDDEN",
      });
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        userId: targetUser.id,
      },
      orderBy: {
        workDate: "desc",
      },
    });

    return json(200, {
      attendanceRecords: records.map((record) =>
        serializeAttendance({
          ...record,
          ownerRole: targetUser.role,
        }),
      ),
    });
  }),
  "GET /expenses": withAuth(async (_request, user) => {
    const expenses = await findExpenses();
    const viewableExpenses = listViewableExpenses(user, expenses);

    return json(200, {
      expenses: viewableExpenses.map(serializeExpense),
    });
  }),
  "POST /expenses": withAuth(async (request, user) => {
    const body = await readJsonBody(request);
    const validation = parseExpenseInput(body);

    if (!validation.ok) {
      return json(400, {
        error: "BAD_REQUEST",
        message: validation.message,
      });
    }

    const expense = await prisma.expenseRequest.create({
      data: {
        userId: user.userId,
        title: validation.value.title,
        amount: validation.value.amount,
        purpose: validation.value.purpose,
        status: "draft",
      },
      include: {
        user: true,
      },
    });

    return json(201, {
      expense: serializeExpense(toExpenseDomain(expense)),
    });
  }),
  "GET /approvals/expenses": withAuth(async (_request, user) => {
    const expenses = await findExpenses();
    const pendingExpenses = listPendingExpensesForApproval(user, expenses);

    return json(200, {
      expenses: pendingExpenses.map(serializeExpense),
    });
  }),
};

async function handleNodeRequest(
  nodeRequest: IncomingMessage,
  nodeResponse: ServerResponse,
): Promise<void> {
  const request = await toFetchRequest(nodeRequest);
  const response = await handleFetchRequest(request);
  await writeNodeResponse(nodeResponse, response);
}

function withAuth(handler: AuthenticatedHttpHandler): HttpHandler {
  return async (request) => {
    const authResult = await authenticateFetchRequest(request);

    if (!authResult.ok) {
      return json(authResult.failure.statusCode, {
        error: authResult.failure.error,
        message: authResult.failure.message,
      });
    }

    return handler(request, authResult.user);
  };
}

async function findExpenses(): Promise<Expense[]> {
  const expenses = await prisma.expenseRequest.findMany({
    include: {
      user: true,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });

  return expenses.map(toExpenseDomain);
}

async function findExpense(id: string): Promise<Expense | null> {
  const expense = await prisma.expenseRequest.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });

  if (!expense) {
    return null;
  }

  return toExpenseDomain(expense);
}

function toExpenseDomain(expense: {
  id: string;
  userId: string;
  title: string;
  amount: number;
  purpose: string;
  submittedAt: Date | null;
  status: Expense["status"];
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  user: {
    role: Expense["ownerRole"];
  };
}): Expense {
  return {
    id: expense.id,
    userId: expense.userId,
    ownerRole: expense.user.role,
    title: expense.title,
    amount: expense.amount,
    purpose: expense.purpose,
    submittedAt: expense.submittedAt,
    status: expense.status,
    approverUserId: expense.approvedBy,
    approvedAt: expense.approvedAt,
    rejectedReason: expense.rejectedReason,
  };
}

function serializeExpense(expense: Expense): Record<string, unknown> {
  return {
    ...expense,
    submittedAt: expense.submittedAt?.toISOString() ?? null,
    approvedAt: expense.approvedAt?.toISOString() ?? null,
  };
}

function getRouteKey(request: Request): string {
  return `${request.method} ${getPath(request)}`;
}

function getDynamicRouteHandler(request: Request): HttpHandler | undefined {
  const method = request.method;
  const path = getPath(request);

  if (method === "GET") {
    const dailyReportMatch = path.match(/^\/daily-reports\/([^/]+)$/);

    if (dailyReportMatch?.[1]) {
      const reportId = decodeURIComponent(dailyReportMatch[1]);
      return withAuth((_innerRequest, user) => getDailyReport(user, reportId));
    }
  }

  if (method === "POST") {
    const submitMatch = path.match(/^\/expenses\/([^/]+)\/submit$/);

    if (submitMatch?.[1]) {
      const expenseId = decodeURIComponent(submitMatch[1]);
      return withAuth((_innerRequest, user) => submitExpense(user, expenseId));
    }

    const approveMatch = path.match(/^\/approvals\/expenses\/([^/]+)\/approve$/);

    if (approveMatch?.[1]) {
      const expenseId = decodeURIComponent(approveMatch[1]);
      return withAuth((_innerRequest, user) =>
        approveExpenseRequest(user, expenseId),
      );
    }

    const rejectMatch = path.match(/^\/approvals\/expenses\/([^/]+)\/reject$/);

    if (rejectMatch?.[1]) {
      const expenseId = decodeURIComponent(rejectMatch[1]);
      return withAuth((innerRequest, user) =>
        rejectExpenseRequest(innerRequest, user, expenseId),
      );
    }
  }

  if (method === "PUT") {
    const dailyReportMatch = path.match(/^\/daily-reports\/([^/]+)$/);

    if (dailyReportMatch?.[1]) {
      const reportId = decodeURIComponent(dailyReportMatch[1]);
      return withAuth((innerRequest, user) =>
        updateDailyReport(innerRequest, user, reportId),
      );
    }
  }

  return undefined;
}

async function getDailyReport(
  user: AuthenticatedUser,
  reportId: string,
): Promise<Response> {
  const report = await prisma.dailyReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      user: true,
    },
  });

  if (!report) {
    return json(404, {
      error: "NOT_FOUND",
    });
  }

  const dailyReport = toDailyReportDomain(report);

  if (!listViewableDailyReports(user, [dailyReport]).length) {
    return json(403, {
      error: "FORBIDDEN",
    });
  }

  return json(200, {
    report: dailyReport,
  });
}

async function updateDailyReport(
  request: Request,
  user: AuthenticatedUser,
  reportId: string,
): Promise<Response> {
  const body = await readJsonBody(request);
  const validation = parseDailyReportInput(body);

  if (!validation.ok) {
    return json(400, {
      error: "BAD_REQUEST",
      message: validation.message,
    });
  }

  const report = await prisma.dailyReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      user: true,
    },
  });

  if (!report) {
    return json(404, {
      error: "NOT_FOUND",
    });
  }

  const dailyReport = toDailyReportDomain(report);

  if (!canEditDailyReport(user, dailyReport)) {
    return json(403, {
      error: "FORBIDDEN",
    });
  }

  const updatedReport = await prisma.dailyReport.update({
    where: {
      id: report.id,
    },
    data: {
      title: validation.value.title,
      body: validation.value.body,
    },
    include: {
      user: true,
    },
  });

  return json(200, {
    report: toDailyReportDomain(updatedReport),
  });
}

async function submitExpense(
  user: AuthenticatedUser,
  expenseId: string,
): Promise<Response> {
  const expense = await findExpense(expenseId);

  if (!expense) {
    return json(404, {
      error: "NOT_FOUND",
    });
  }

  if (!canSubmitExpense(user, expense)) {
    return json(expense.status === "draft" ? 403 : 409, {
      error: expense.status === "draft" ? "FORBIDDEN" : "INVALID_STATUS",
    });
  }

  const submittedAt = new Date();

  const updatedExpense = await prisma.expenseRequest.update({
    where: {
      id: expense.id,
    },
    data: {
      status: "submitted",
      submittedAt,
    },
    include: {
      user: true,
    },
  });

  await prisma.approvalHistory.create({
    data: {
      targetType: "expense_request",
      targetId: expense.id,
      actorUserId: user.userId,
      action: "submitted",
      comment: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.userId,
      action: "expense.submitted",
      resourceType: "expense_request",
      resourceId: expense.id,
      metadata: {
        amount: expense.amount,
      },
    },
  });

  return json(200, {
    expense: serializeExpense(toExpenseDomain(updatedExpense)),
  });
}

async function approveExpenseRequest(
  user: AuthenticatedUser,
  expenseId: string,
): Promise<Response> {
  const expense = await findExpense(expenseId);

  if (!expense) {
    return json(404, {
      error: "NOT_FOUND",
    });
  }

  const approvedAt = new Date();
  const result = approveExpense(user, expense, approvedAt);

  if (!result.ok) {
    return json(result.error === "FORBIDDEN" ? 403 : 409, {
      error: result.error,
    });
  }

  const updatedExpense = await prisma.expenseRequest.update({
    where: {
      id: expense.id,
    },
    data: {
      status: result.value.status,
      approvedBy: user.userId,
      approvedAt,
      rejectedReason: null,
    },
    include: {
      user: true,
    },
  });

  await prisma.approvalHistory.create({
    data: {
      targetType: "expense_request",
      targetId: expense.id,
      actorUserId: user.userId,
      action: "approved",
      comment: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.userId,
      action: "expense.approved",
      resourceType: "expense_request",
      resourceId: expense.id,
      metadata: {
        previousStatus: expense.status,
        nextStatus: result.value.status,
      },
    },
  });

  return json(200, {
    expense: serializeExpense(toExpenseDomain(updatedExpense)),
  });
}

async function rejectExpenseRequest(
  request: Request,
  user: AuthenticatedUser,
  expenseId: string,
): Promise<Response> {
  const body = await readJsonBody(request);
  const reason = parseRejectReason(body);

  if (!reason.ok) {
    return json(400, {
      error: "BAD_REQUEST",
      message: reason.message,
    });
  }

  const expense = await findExpense(expenseId);

  if (!expense) {
    return json(404, {
      error: "NOT_FOUND",
    });
  }

  const rejectedAt = new Date();
  const result = rejectExpense(user, expense, reason.value, rejectedAt);

  if (!result.ok) {
    return json(result.error === "FORBIDDEN" ? 403 : 409, {
      error: result.error,
    });
  }

  const updatedExpense = await prisma.expenseRequest.update({
    where: {
      id: expense.id,
    },
    data: {
      status: result.value.status,
      approvedBy: user.userId,
      approvedAt: rejectedAt,
      rejectedReason: reason.value,
    },
    include: {
      user: true,
    },
  });

  await prisma.approvalHistory.create({
    data: {
      targetType: "expense_request",
      targetId: expense.id,
      actorUserId: user.userId,
      action: "rejected",
      comment: reason.value,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.userId,
      action: "expense.rejected",
      resourceType: "expense_request",
      resourceId: expense.id,
      metadata: {
        previousStatus: expense.status,
        nextStatus: result.value.status,
      },
    },
  });

  return json(200, {
    expense: serializeExpense(toExpenseDomain(updatedExpense)),
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const rawBody = (await request.text()).trim();

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as unknown;
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const init: RequestInit = {
    headers,
    method: request.method ?? "GET",
  };

  if (init.method !== "GET" && init.method !== "HEAD") {
    const body = await readNodeBody(request);

    if (body.length > 0) {
      init.body = body.toString("utf8");
    }
  }

  return new Request(`http://localhost${request.url ?? "/"}`, init);
}

async function readNodeBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function writeNodeResponse(
  nodeResponse: ServerResponse,
  response: Response,
): Promise<void> {
  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers));

  if (response.status === 204) {
    nodeResponse.end();
    return;
  }

  nodeResponse.end(await response.text());
}

function parseExpenseInput(body: unknown):
  | { ok: true; value: { title: string; amount: number; purpose: string } }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object.",
    };
  }

  const title = parseRequiredString(body.title);
  const purpose = parseRequiredString(body.purpose);
  const amount = body.amount;

  if (
    !title ||
    !purpose ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return {
      ok: false,
      message: "title, purpose, and positive integer amount are required.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      amount,
      purpose,
    },
  };
}

function parseRejectReason(body: unknown):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object.",
    };
  }

  const reason = parseRequiredString(body.reason);

  if (!reason) {
    return {
      ok: false,
      message: "reason is required.",
    };
  }

  return {
    ok: true,
    value: reason,
  };
}

function parseDailyReportInput(body: unknown):
  | { ok: true; value: { title: string; body: string } }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object.",
    };
  }

  const title = parseRequiredString(body.title);
  const reportBody = parseRequiredString(body.body);

  if (!title || !reportBody) {
    return {
      ok: false,
      message: "title and body are required.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      body: reportBody,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getPath(request: Request): string {
  return new URL(request.url).pathname;
}

function getQueryValue(request: Request, key: string): string | undefined {
  return new URL(request.url).searchParams.get(key) ?? undefined;
}

function json(statusCode: number, body: unknown): Response {
  if (statusCode === 204) {
    return new Response(null, {
      headers: jsonHeaders,
      status: statusCode,
    });
  }

  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status: statusCode,
  });
}

function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getTokyoWorkDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to derive Asia/Tokyo work date.");
  }

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function toDailyReportDomain(report: {
  id: string;
  userId: string;
  workDate: Date;
  title: string;
  body: string;
  user: {
    role: DailyReport["ownerRole"];
  };
}): DailyReport {
  return {
    id: report.id,
    userId: report.userId,
    ownerRole: report.user.role,
    workDate: toDateOnlyString(report.workDate),
    title: report.title,
    body: report.body,
  };
}

function serializeAttendance(attendance: {
  id?: string;
  userId: string;
  ownerRole: DailyReport["ownerRole"];
  workDate: Date | string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  status: "not_started" | "working" | "finished";
}): Record<string, unknown> {
  return {
    id: attendance.id,
    userId: attendance.userId,
    ownerRole: attendance.ownerRole,
    workDate:
      attendance.workDate instanceof Date
        ? toDateOnlyString(attendance.workDate)
        : attendance.workDate,
    clockInAt: attendance.clockInAt?.toISOString() ?? null,
    clockOutAt: attendance.clockOutAt?.toISOString() ?? null,
    status: attendance.status,
  };
}
