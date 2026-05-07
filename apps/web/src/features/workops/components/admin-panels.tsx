import { DataTable } from "@/components/data-table";
import { Panel } from "@/components/panel";
import { formatDateTime } from "../format";
import { auditActionLabel, resourceTypeLabel, roleLabel } from "../labels";
import type { AdminUser, AuditLog } from "../types";

export function AdminPanels({
  auditLogs,
  users,
}: {
  auditLogs: AuditLog[];
  users: AdminUser[];
}) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Panel id="admin" title="ユーザー一覧">
        <DataTable
          columns={["名前", "メールアドレス", "ロール"]}
          rows={users.map((user) => [user.name, user.email, roleLabel(user.role)])}
        />
      </Panel>
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
