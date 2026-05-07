import { DataTable } from "@/components/data-table";
import { Panel } from "@/components/panel";
import { roleLabel } from "../labels";
import type { DailyReport } from "../types";

export function DailyReportsPanel({
  isLoading,
  onBodyChange,
  onCreate,
  onTitleChange,
  reports,
  reportBody,
  reportTitle,
}: {
  isLoading: boolean;
  onBodyChange: (value: string) => void;
  onCreate: () => void;
  onTitleChange: (value: string) => void;
  reports: DailyReport[];
  reportBody: string;
  reportTitle: string;
}) {
  return (
    <Panel id="daily-reports" title="日報">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">日報を作成</p>
        <p className="mt-1 text-sm text-slate-600">作業内容や共有事項を登録します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <input
            className="input"
            disabled={isLoading}
            placeholder="タイトル"
            value={reportTitle}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <input
            className="input"
            disabled={isLoading}
            placeholder="本文"
            value={reportBody}
            onChange={(event) => onBodyChange(event.target.value)}
          />
          <button className="button-primary" disabled={isLoading} onClick={onCreate}>
            作成
          </button>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-bold text-slate-900">日報一覧</p>
        <DataTable
          columns={["日付", "ロール", "タイトル", "本文"]}
          rows={reports.map((report) => [
            report.workDate,
            roleLabel(report.ownerRole),
            report.title,
            report.body,
          ])}
        />
      </div>
    </Panel>
  );
}
