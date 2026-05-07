import { DataTable } from "@/components/data-table";
import { Panel } from "@/components/panel";
import { expenseStatusLabel, formatCurrencyYen } from "../labels";
import type { Expense } from "../types";

export function ExpensesPanel({
  expenseAmount,
  expensePurpose,
  expenseTitle,
  expenses,
  isLoading,
  onAmountChange,
  onCreate,
  onPurposeChange,
  onSubmit,
  onTitleChange,
}: {
  expenseAmount: string;
  expensePurpose: string;
  expenseTitle: string;
  expenses: Expense[];
  isLoading: boolean;
  onAmountChange: (value: string) => void;
  onCreate: () => void;
  onPurposeChange: (value: string) => void;
  onSubmit: (id: string) => void;
  onTitleChange: (value: string) => void;
}) {
  return (
    <Panel id="expenses" title="経費申請">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">経費を作成</p>
        <p className="mt-1 text-sm text-slate-600">件名、金額、利用目的を入力して申請データを作成します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_1.4fr_auto]">
          <input
            className="input"
            disabled={isLoading}
            placeholder="件名"
            value={expenseTitle}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <input
            className="input"
            disabled={isLoading}
            placeholder="金額"
            value={expenseAmount}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <input
            className="input"
            disabled={isLoading}
            placeholder="利用目的"
            value={expensePurpose}
            onChange={(event) => onPurposeChange(event.target.value)}
          />
          <button className="button-primary" disabled={isLoading} onClick={onCreate}>
            作成
          </button>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-bold text-slate-900">経費一覧</p>
        <DataTable
          columns={["件名", "金額", "状態", "操作"]}
          rows={expenses.map((expense) => [
            expense.title,
            formatCurrencyYen(expense.amount),
            expenseStatusLabel(expense.status),
            expense.status === "draft" ? (
              <button className="link-button" onClick={() => onSubmit(expense.id)}>
                申請
              </button>
            ) : (
              "-"
            ),
          ])}
        />
      </div>
    </Panel>
  );
}
