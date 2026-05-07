import { canViewDailyReport } from "../../../shared/auth/permissions";
import type { AuthUser } from "../../../shared/types/auth";
import type { DailyReport } from "../types";

export function listViewableDailyReports(
  user: AuthUser,
  reports: DailyReport[],
): DailyReport[] {
  return reports.filter((report) => canViewDailyReport(user, report));
}