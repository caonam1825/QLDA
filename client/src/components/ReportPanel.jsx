import { useState, useEffect } from "react";
import { BarChart3, X, AlertTriangle, Clock3, CheckCircle2 } from "lucide-react";
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

export default function ReportPanel({ projectId, onClose }) {
  const [range, setRange] = useState("day");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          <button className={`report-tab ${range === "day" ? "report-tab-active" : ""}`} onClick={() => setRange("day")} type="button">Hôm nay</button>
          <button className={`report-tab ${range === "week" ? "report-tab-active" : ""}`} onClick={() => setRange("week")} type="button">Tuần này</button>
        </div>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {data && !loading && (
          <div className="report-body">
            {data.overdueList.length > 0 && (
              <section className="report-section">
                <h4 className="report-section-title report-title-danger"><AlertTriangle size={14} /> Trễ hạn — cần nhắc nhở ({data.overdueList.length})</h4>
                <ul className="report-list">
                  {data.overdueList.map(t => (
                    <li key={t.id} className="report-item report-item-danger">
                      <span className="report-item-title">{t.title || "(chưa đặt tên)"}</span>
                      <span className="report-item-meta">{phaseLabel(t.phase)} · {t.assignee} · hạn {t.due}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.dueSoonList.length > 0 && (
              <section className="report-section">
                <h4 className="report-section-title report-title-warn"><Clock3 size={14} /> Sắp đến hạn (trong 2 ngày tới)</h4>
                <ul className="report-list">
                  {data.dueSoonList.map(t => (
                    <li key={t.id} className="report-item report-item-warn">
                      <span className="report-item-title">{t.title || "(chưa đặt tên)"}</span>
                      <span className="report-item-meta">{phaseLabel(t.phase)} · {t.assignee} · hạn {t.due}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="report-section">
              <h4 className="report-section-title report-title-ok">
                <CheckCircle2 size={14} /> Đã hoàn thành {range === "day" ? "hôm nay" : "trong tuần"} ({data.doneCount})
              </h4>
              {data.updatedTasks.filter(t => t.status === "done").length === 0 ? (
                <p className="invite-hint">Chưa có công việc nào hoàn thành trong khoảng thời gian này.</p>
              ) : (
                <ul className="report-list">
                  {data.updatedTasks.filter(t => t.status === "done").map(t => (
                    <li key={t.id} className="report-item">
                      <span className="report-item-title">{t.title || "(chưa đặt tên)"}</span>
                      <span className="report-item-meta">{phaseLabel(t.phase)} · {t.assignee} · {formatTime(t.updatedAt)}</span>
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
