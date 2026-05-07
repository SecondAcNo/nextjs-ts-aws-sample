import type { Role } from "../../shared/types/auth";

export type DailyReport = {
  id: string;
  userId: string;
  ownerRole: Role;
  workDate: string;
  title: string;
  body: string;
};
