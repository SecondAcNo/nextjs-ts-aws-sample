import { DataTable } from "@/components/data-table";
import { Panel } from "@/components/panel";
import { formatCurrencyYen, roleLabel } from "../labels";
import type { Expense } from "../types";

export function ApprovalsPanel({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: Expense[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Panel id="approvals" title="承認">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">承認待ち一覧</p>
        <p className="mt-1 text-sm text-slate-600">権限範囲内の経費申請に対して承認・却下を行います。</p>
      </div>
      <DataTable
        columns={["件名", "申請者", "金額", "操作"]}
        rows={approvals.map((expense) => [
          expense.title,
          roleLabel(expense.ownerRole),
          formatCurrencyYen(expense.amount),
          <div className="flex gap-2" key={expense.id}>
            <button className="link-button" onClick={() => onApprove(expense.id)}>
              承認
            </button>
            <button className="link-button-danger" onClick={() => onReject(expense.id)}>
              却下
            </button>
          </div>,
        ])}
      />
    </Panel>
  );
}
