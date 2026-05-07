import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuthUser, Role } from "../types/auth";
import {
  canApproveExpense,
  canEditDailyReport,
  canManageResourceOwner,
  canSubmitExpense,
  canViewAdminPage,
  canViewApprovals,
  canViewAttendance,
  canViewDailyReport,
  canViewExpense,
} from "./permissions";

function user(userId: string, role: Role): AuthUser {
  return { userId, role };
}

describe("role-based permissions", () => {
  const employee = user("employee-1", "employee");
  const manager = user("manager-1", "manager");
  const admin = user("admin-1", "admin");

  it("allows managers to manage employee-owned resources only", () => {
    assert.equal(
      canManageResourceOwner(manager, {
        userId: "employee-1",
        ownerRole: "employee",
      }),
      true,
    );

    assert.equal(
      canManageResourceOwner(manager, {
        userId: "manager-2",
        ownerRole: "manager",
      }),
      false,
    );

    assert.equal(
      canManageResourceOwner(manager, {
        userId: "admin-1",
        ownerRole: "admin",
      }),
      false,
    );
  });

  it("allows admins to manage any resource owner", () => {
    assert.equal(
      canManageResourceOwner(admin, {
        userId: "employee-1",
        ownerRole: "employee",
      }),
      true,
    );
    assert.equal(
      canManageResourceOwner(admin, {
        userId: "manager-1",
        ownerRole: "manager",
      }),
      true,
    );
    assert.equal(
      canManageResourceOwner(admin, {
        userId: "admin-2",
        ownerRole: "admin",
      }),
      true,
    );
  });

  it("allows users to view their own business records", () => {
    assert.equal(
      canViewDailyReport(manager, {
        userId: "manager-1",
        ownerRole: "manager",
      }),
      true,
    );
    assert.equal(
      canViewAttendance(manager, {
        userId: "manager-1",
        ownerRole: "manager",
      }),
      true,
    );
    assert.equal(
      canViewExpense(manager, {
        userId: "manager-1",
        ownerRole: "manager",
      }),
      true,
    );
  });

  it("allows managers to view employee records", () => {
    assert.equal(
      canViewDailyReport(manager, {
        userId: "employee-1",
        ownerRole: "employee",
      }),
      true,
    );
    assert.equal(
      canViewAttendance(manager, {
        userId: "employee-1",
        ownerRole: "employee",
      }),
      true,
    );
    assert.equal(
      canViewExpense(manager, {
        userId: "employee-1",
        ownerRole: "employee",
      }),
      true,
    );
  });

  it("prevents managers from viewing other manager or admin records", () => {
    assert.equal(
      canViewDailyReport(manager, {
        userId: "manager-2",
        ownerRole: "manager",
      }),
      false,
    );
    assert.equal(
      canViewAttendance(manager, {
        userId: "admin-1",
        ownerRole: "admin",
      }),
      false,
    );
    assert.equal(
      canViewExpense(manager, {
        userId: "admin-1",
        ownerRole: "admin",
      }),
      false,
    );
  });

  it("allows only the owner to edit daily reports", () => {
    assert.equal(canEditDailyReport(employee, { userId: "employee-1" }), true);
    assert.equal(canEditDailyReport(manager, { userId: "employee-1" }), false);
    assert.equal(canEditDailyReport(admin, { userId: "employee-1" }), false);
  });

  it("allows only the owner to submit draft expenses", () => {
    assert.equal(
      canSubmitExpense(employee, {
        userId: "employee-1",
        status: "draft",
      }),
      true,
    );
    assert.equal(
      canSubmitExpense(employee, {
        userId: "employee-1",
        status: "submitted",
      }),
      false,
    );
    assert.equal(
      canSubmitExpense(manager, {
        userId: "employee-1",
        status: "draft",
      }),
      false,
    );
  });

  it("allows managers to approve submitted employee expenses only", () => {
    assert.equal(
      canApproveExpense(manager, {
        userId: "employee-1",
        ownerRole: "employee",
        status: "submitted",
      }),
      true,
    );
    assert.equal(
      canApproveExpense(manager, {
        userId: "employee-1",
        ownerRole: "employee",
        status: "draft",
      }),
      false,
    );
    assert.equal(
      canApproveExpense(manager, {
        userId: "manager-2",
        ownerRole: "manager",
        status: "submitted",
      }),
      false,
    );
  });

  it("allows admins to approve submitted expenses for any role", () => {
    assert.equal(
      canApproveExpense(admin, {
        userId: "manager-1",
        ownerRole: "manager",
        status: "submitted",
      }),
      true,
    );
  });

  it("separates approval pages and admin pages by role", () => {
    assert.equal(canViewApprovals(employee), false);
    assert.equal(canViewApprovals(manager), true);
    assert.equal(canViewApprovals(admin), true);

    assert.equal(canViewAdminPage(employee), false);
    assert.equal(canViewAdminPage(manager), false);
    assert.equal(canViewAdminPage(admin), true);
  });
});
