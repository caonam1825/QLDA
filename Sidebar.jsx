import { useState, useEffect } from "react";
import { BarChart3, X, AlertTriangle, Clock3, CheckCircle2, Loader2, Lock, FileDown, FileText } from "lucide-react";
import { api } from "../api";
import { PHASES } from "../constants";

function phaseLabel(key) {
  return PHASES.find(p => p.key === key)?.label || key;
}

function formatTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function TaskList({ items, tone }) {
  return (
    <ul className="report-list">
      {items.map(t => (
        <li key={t.id} className={`report-item ${tone ? `report-item-${tone}` : ""}`}>
          <span className="report-item-title">{t.title}</span>
          <span className="report-item-meta">
            {phaseLabel(t.phase)} · <b>Người phụ trách:</b> {t.assignee}
            {t.due && <> · <b>Hạn:</b> {t.due}{t.dueLocked && <Lock size={10} style={{ verticalAlign: -1, marginLeft: 2 }} />}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportPanel({ projectId, onClose }) {
  const [range, setRange] = useState("day");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  async function handleExport(format) {
    setExporting(format);
    try {
      await api.exportProjectReport(projectId, range, format);
    } catch (e) {
      setError(e.message || "Không xuất được báo cáo");
    } finally {
      setExporting("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getReport(projectId, range)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, range]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card report-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><BarChart3 size={16} /> Báo cáo tiến độ</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <div className="report-tabs">
          <button className={`report-tab ${range === "day" ? "report-tab-active" : ""}`} onClick={() => setRange("day")} type="button">Báo cáo ngày</button>
          <button className={`report-tab ${range === "week" ? "report-tab-active" : ""}`} onClick={() => setRange("week")} type="button">Báo cáo tuần</button>
          <span className="report-tabs-spacer" />
          <button className="export-btn" disabled={!!exporting} onClick={() => handleExport("pdf")} type="button">
            <FileDown size={13} /> {exporting === "pdf" ? "Đang xuất…" : "Xuất PDF"}
          </button>
          <button className="export-btn" disabled={!!exporting} onClick={() => handleExport("docx")} type="button">
            <FileText size={13} /> {exporting === "docx" ? "Đang xuất…" : "Xuất Word"}
          </button>
        </div>

        {loading && <p className="invite-hint"><Loader2 size={13} className="spin" /> Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {data && !loading && (
          <div className="report-body">
            {data.overdueList.length > 0 && (
              <section className="report-section">
                <h4 className="report-section-title report-title-danger"><AlertTriangle size={14} /> Trễ hạn — cần nhắc nhở ({data.overdueList.length})</h4>
                <TaskList items={data.overdueList} tone="danger" />
              </section>
            )}

            <section className="report-section">
              <h4 className="report-section-title report-title-warn"><Clock3 size={14} /> Đang thực hiện ({data.inProgressList.length})</h4>
              {data.inProgressList.length === 0 ? (
                <p className="invite-hint">Không có công việc nào đang thực hiện.</p>
              ) : (
                <TaskList items={data.inProgressList} tone="warn" />
              )}
            </section>

            <section className="report-section">
              <h4 className="report-section-title">
                Dự kiến thực hiện ({range === "day" ? "2 ngày tới" : "7 ngày tới"}) ({data.upcomingList.length})
              </h4>
              {data.upcomingList.length === 0 ? (
                <p className="invite-hint">Không có việc nào sắp đến hạn trong khoảng thời gian này.</p>
              ) : (
                <TaskList items={data.upcomingList} />
              )}
            </section>

            <section className="report-section">
              <h4 className="report-section-title report-title-ok">
                <CheckCircle2 size={14} /> Đã hoàn thành {range === "day" ? "hôm nay" : "trong tuần"} ({data.doneCount})
              </h4>
              {data.doneList.length === 0 ? (
                <p className="invite-hint">Chưa có công việc nào hoàn thành trong khoảng thời gian này.</p>
              ) : (
                <ul className="report-list">
                  {data.doneList.map(t => (
                    <li key={t.id} className="report-item">
                      <span className="report-item-title">{t.title}</span>
                      <span className="report-item-meta">{phaseLabel(t.phase)} · <b>Người phụ trách:</b> {t.assignee} · {formatTime(t.updatedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="report-section">
              <h4 className="report-section-title">Tổng hợp theo nhân viên</h4>
              <table className="report-table">
                <thead>
                  <tr><th>Người phụ trách</th><th>Hoàn thành</th><th>Đang làm</th><th>Chưa làm</th><th>Trễ hạn</th></tr>
                </thead>
                <tbody>
                  {data.byStaff.map(s => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.done}</td>
                      <td>{s.doing}</td>
                      <td>{s.todo}</td>
                      <td className={s.overdue > 0 ? "report-cell-danger" : ""}>{s.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
