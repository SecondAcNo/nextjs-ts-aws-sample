import type { AuthUser } from "../../../shared/types/auth";
import { canViewDailyReport } from "../../../shared/auth/permissions";
import type { DailyReport } from "../types";

export function getDailyReportDetail(
  user: AuthUser,
  report: DailyReport,
): DailyReport | null {
  if (!canViewDailyReport(user, report)) {
    return null;
  }

  return report;
}