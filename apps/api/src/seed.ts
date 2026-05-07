import { prisma } from "./shared/database/prisma";

const seedWorkDate = new Date("2026-04-26T00:00:00+09:00");

async function main(): Promise<void> {
  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {
      name: "Employee User",
      role: "employee",
    },
    create: {
      email: "employee@example.com",
      name: "Employee User",
      role: "employee",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {
      name: "Manager User",
      role: "manager",
    },
    create: {
      email: "manager@example.com",
      name: "Manager User",
      role: "manager",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "Admin User",
      role: "admin",
    },
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
    },
  });

  const seedUserIds = [employee.id, manager.id, admin.id];

  await prisma.auditLog.deleteMany({
    where: {
      actorUserId: {
        in: seedUserIds,
      },
    },
  });

  await prisma.approvalHistory.deleteMany({
    where: {
      actorUserId: {
        in: seedUserIds,
      },
    },
  });

  await prisma.expenseRequest.deleteMany({
    where: {
      userId: {
        in: seedUserIds,
      },
    },
  });

  await prisma.dailyReport.deleteMany({
    where: {
      userId: {
        in: seedUserIds,
      },
    },
  });

  await prisma.attendanceRecord.deleteMany({
    where: {
      userId: {
        in: seedUserIds,
      },
    },
  });

  await prisma.dailyReport.createMany({
    data: [
      {
        userId: employee.id,
        workDate: seedWorkDate,
        title: "Auth flow implementation",
        body: "Implemented local authorization checks.",
      },
      {
        userId: manager.id,
        workDate: seedWorkDate,
        title: "Approval review",
        body: "Reviewed pending expense requests.",
      },
    ],
  });

  await prisma.attendanceRecord.upsert({
    where: {
      userId_workDate: {
        userId: employee.id,
        workDate: seedWorkDate,
      },
    },
    update: {},
    create: {
      userId: employee.id,
      workDate: seedWorkDate,
      clockInAt: new Date("2026-04-26T09:00:00+09:00"),
      status: "working",
    },
  });

  const employeeExpense = await prisma.expenseRequest.create({
    data: {
      userId: employee.id,
      title: "Technical book",
      amount: 2750,
      purpose: "Study TypeScript and AWS application development.",
      status: "submitted",
      submittedAt: new Date("2026-04-26T10:00:00+09:00"),
    },
  });

  await prisma.expenseRequest.create({
    data: {
      userId: admin.id,
      title: "AWS event",
      amount: 15000,
      purpose: "Attend AWS learning event.",
      status: "submitted",
      submittedAt: new Date("2026-04-26T11:00:00+09:00"),
    },
  });

  await prisma.approvalHistory.create({
    data: {
      targetType: "expense_request",
      targetId: employeeExpense.id,
      actorUserId: employee.id,
      action: "submitted",
      comment: "Initial submission.",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: employee.id,
      action: "expense.submitted",
      resourceType: "expense_request",
      resourceId: employeeExpense.id,
      metadata: {
        amount: employeeExpense.amount,
      },
    },
  });

  console.log("Seed completed:");
  console.log(`- employee: ${employee.email}`);
  console.log(`- manager: ${manager.email}`);
  console.log(`- admin: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
