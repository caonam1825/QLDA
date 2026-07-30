import { useState, useEffect } from "react";
import { X, User, Lock } from "lucide-react";
import { api } from "../api";
import { STATUS } from "../constants";

// Truyền `staticTasks` khi đã có sẵn dữ liệu (VD: lọc từ project.tasks đang
// tải trong Dashboard) — không gọi API. Truyền `personKey` khi cần gọi
// /reports/by-person để lấy việc của người đó trên TẤT CẢ dự án (dùng ở
// bảng KPI / Tổng hợp, nơi không có sẵn danh sách task theo từng dự án).
export default function PersonTasksModal({ name, staticTasks, personKey, onClose }) {
  const [tasks, setTasks] = useState(staticTasks || null);
  const [loading, setLoading] = useState(!staticTasks && !!personKey);
  const [error, setError] = useState("");

  useEffect(() => {
    if (staticTasks || !personKey) return;
    let cancelled = false;
    setLoading(true);
    api.getByPerson(personKey)
      .then(d => { if (!cancelled) setTasks(d.tasks); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personKey, staticTasks]);

  const sorted = (tasks || []).slice().sort((a, b) => {
    const da = a.due || a.progress?.due || "9999";
    const db_ = b.due || b.progress?.due || "9999";
    return da < db_ ? -1 : 1;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><User size={16} /> Công việc của {name}</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && sorted.length === 0 && (
          <p className="invite-hint">Chưa có công việc nào được gán cho người này.</p>
        )}

        {!loading && sorted.length > 0 && (
          <ul className="report-list">
            {sorted.map(t => {
              const status = t.status || t.progress?.status || "todo";
              const due = t.due ?? t.progress?.due ?? "";
              const dueLocked = t.dueLocked ?? t.progress?.dueLocked;
              const st = STATUS[status] || STATUS.todo;
              const overdue = t.overdue || (due && status !== "done" && due < new Date().toISOString().slice(0, 10));
              return (
                <li key={t.id} className={`report-item ${overdue ? "report-item-danger" : ""}`}>
                  <span className="report-item-title">{t.title}</span>
                  <span className="report-item-meta">
                    <span className="task-status-pill" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    {t.projectName && <> · {t.projectName}</>}
                    {due && <> · <b>Hạn:</b> {due}{dueLocked && <Lock size={10} style={{ verticalAlign: -1, marginLeft: 2 }} />}</>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
