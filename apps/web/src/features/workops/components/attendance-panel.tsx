import { DataTable } from "@/components/data-table";
import { Panel } from "@/components/panel";
import { formatDateTime } from "../format";
import { attendanceStatusLabel, roleLabel } from "../labels";
import type { AttendanceRecord } from "../types";

export function AttendancePanel({
  attendanceHistory,
  isLoading,
  onClockIn,
  onClockOut,
  todayAttendance,
}: {
  attendanceHistory: AttendanceRecord[];
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  todayAttendance: AttendanceRecord | null;
}) {
  return (
    <Panel id="attendance" title="勤怠">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">今日の打刻</p>
        <p className="mt-1 text-sm text-slate-600">サーバー時刻を基準に出勤・退勤を記録します。</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="status-pill">{attendanceStatusLabel(todayAttendance?.status)}</span>
          <button className="button-secondary" disabled={isLoading} onClick={onClockIn}>
            出勤
          </button>
          <button className="button-secondary" disabled={isLoading} onClick={onClockOut}>
            退勤
          </button>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-bold text-slate-900">勤怠履歴</p>
        <DataTable
          columns={["日付", "ロール", "状態", "出勤時刻", "退勤時刻"]}
          rows={attendanceHistory.map((record) => [
            record.workDate,
            roleLabel(record.ownerRole),
            attendanceStatusLabel(record.status),
            formatDateTime(record.clockInAt),
            formatDateTime(record.clockOutAt),
          ])}
        />
      </div>
    </Panel>
  );
}
