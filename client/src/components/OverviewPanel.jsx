import { useState, useEffect } from "react";
import { LayoutGrid, X, AlertTriangle, Clock3, Trophy } from "lucide-react";
import { api } from "../api";

export default function OverviewPanel({ onClose }) {
  const [tab, setTab] = useState("overview"); // 'overview' | 'kpi'
  const [overview, setOverview] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getOverview(), api.getKPI()])
      .then(([ov, kp]) => { if (!cancelled) { setOverview(ov); setKpi(kp); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card report-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><LayoutGrid size={16} /> Tổng hợp toàn hệ thống</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <div className="report-tabs">
          <button className={`report-tab ${tab === "overview" ? "report-tab-active" : ""}`} onClick={() => setTab("overview")} type="button">Tổng hợp dự án</button>
          <button className={`report-tab ${tab === "kpi" ? "report-tab-active" : ""}`} onClick={() => setTab("kpi")} type="button">Xếp hạng KPI nhân viên</button>
        </div>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && tab === "overview" && overview && (
          <div className="report-body">
            <section className="report-section">
              <h4 className="report-section-title">Tất cả dự án ({overview.projects.length})</h4>
              <table className="report-table">
                <thead>
                  <tr><th>Dự án</th><th>Tổng việc</th><th>Hoàn thành</th><th>% hoàn thành</th><th>Trễ hạn</th></tr>
                </thead>
                <tbody>
                  {overview.projects.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.total}</td>
                      <td>{p.done}</td>
                      <td>{p.percent}%</td>
                      <td className={p.overdue > 0 ? "report-cell-danger" : ""}>{p.overdue}</td>
                    </tr>
                  ))}
                  <tr className="report-table-total">
                    <td>Tổng cộng</td>
                    <td>{overview.totals.total}</td>
                    <td>{overview.totals.done}</td>
                    <td>{overview.totals.total ? Math.round((overview.totals.done / overview.totals.total) * 100) : 0}%</td>
                    <td className={overview.totals.overdue > 0 ? "report-cell-danger" : ""}>{overview.totals.overdue}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {overview.overdueList.length > 0 && (
              <section className="report-section">
                <h4 className="report-section-title report-title-danger"><AlertTriangle size={14} /> Trễ hạn — tất cả dự án ({overview.overdueList.length})</h4>
                <ul className="report-list">
                  {overview.overdueList.map(t => (
                    <li key={t.id} className="report-item report-item-danger">
                      <span className="report-item-title">{t.title || "(chưa đặt tên)"}</span>
                      <span className="report-item-meta">{t.projectName} · {t.assignee} · hạn {t.due}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {overview.dueSoonList.length > 0 && (
              <section className="report-section">
                <h4 className="report-section-title report-title-warn"><Clock3 size={14} /> Sắp đến hạn (2 ngày tới) — tất cả dự án</h4>
                <ul className="report-list">
                  {overview.dueSoonList.map(t => (
                    <li key={t.id} className="report-item report-item-warn">
                      <span className="report-item-title">{t.title || "(chưa đặt tên)"}</span>
                      <span className="report-item-meta">{t.projectName} · {t.assignee} · hạn {t.due}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {!loading && tab === "kpi" && kpi && (
          <div className="report-body">
            <section className="report-section">
              <h4 className="report-section-title"><Trophy size={14} /> Xếp hạng theo điểm KPI</h4>
              <p className="invite-hint">
                Điểm = (hoàn thành đúng hạn × 3) + (hoàn thành trễ hạn × 1) − (đang trễ hạn × 2) − (đang vướng mắc × 1).
                Một người tham gia nhiều dự án được gộp chung theo số điện thoại.
              </p>
              {kpi.ranking.length === 0 ? (
                <p className="invite-hint">Chưa có dữ liệu — cần gán công việc cho nhân viên cụ thể trước.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Nhân viên</th><th>Dự án</th><th>Được giao</th>
                      <th>Hoàn thành</th><th>Đúng hạn</th><th>Đang trễ hạn</th><th>Điểm KPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpi.ranking.map(r => (
                      <tr key={`${r.name}-${r.department}`} className={r.rank <= 3 ? "report-row-top" : ""}>
                        <td>{r.rank}</td>
                        <td>{r.name}{r.position ? <span className="report-item-meta-inline"> · {r.position}</span> : ""}</td>
                        <td>{r.projects.join(", ")}</td>
                        <td>{r.assigned}</td>
                        <td>{r.completed} ({r.completionRate}%)</td>
                        <td>{r.completedOnTime} ({r.onTimeRate}%)</td>
                        <td className={r.overdueOpen > 0 ? "report-cell-danger" : ""}>{r.overdueOpen}</td>
                        <td className="report-cell-score">{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
