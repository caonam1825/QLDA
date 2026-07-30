import { useState, useEffect } from "react";
import { X, User, Lock, AlertTriangle, Clock3, CheckCircle2, ListChecks } from "lucide-react";
import { api } from "../api";
import { STATUS } from "../constants";

// Truyền `staticTasks` khi đã có sẵn dữ liệu (VD: lọc từ project.tasks đang
// tải trong Dashboard) — không gọi API. Truyền `personKey` khi cần gọi
// /reports/by-person để lấy việc của người đó trên TẤT CẢ dự án (dùng ở
// bảng KPI / Tổng hợp, nơi không có sẵn danh sách task theo từng dự án).
export default function PersonTasksModal({ name, staticTasks, personKey, onClose }) {
  const [rawTasks, setRawTasks] = useState(staticTasks || null);
  const [loading, setLoading] = useState(!staticTasks && !!personKey);
  const [error, setError] = useState("");

  useEffect(() => {
    if (staticTasks || !personKey) return;
    let cancelled = false;
    setLoading(true);
    api.getByPerson(personKey)
      .then(d => { if (!cancelled) setRawTasks(d.tasks); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personKey, staticTasks]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const normalized = (rawTasks || []).map(t => {
    const status = t.status || t.progress?.status || "todo";
    const due = t.due ?? t.progress?.due ?? "";
    const dueLocked = t.dueLocked ?? t.progress?.dueLocked;
    const overdue = t.overdue ?? (!!due && status !== "done" && due < todayStr);
    return { id: t.id, title: t.title, status, due, dueLocked, overdue, projectName: t.projectName || "" };
  }).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  const overdue = normalized.filter(t => t.overdue);
  const doing = normalized.filter(t => t.status === "doing" && !t.overdue);
  const done = normalized.filter(t => t.status === "done");
  const todo = normalized.filter(t => t.status === "todo" && !t.overdue);

  function Group({ icon: Icon, title, tone, items, emptyText }) {
    return (
      <section className="report-section">
        <h4 className={`report-section-title ${tone ? `report-title-${tone}` : ""}`}><Icon size={14} /> {title} ({items.length})</h4>
        {items.length === 0 ? (
          <p className="invite-hint">{emptyText}</p>
        ) : (
          <ul className="report-list">
            {items.map(t => {
              const st = STATUS[t.status] || STATUS.todo;
              return (
                <li key={t.id} className={`report-item ${tone ? `report-item-${tone}` : ""}`}>
                  <span className="report-item-title">{t.title}</span>
                  <span className="report-item-meta">
                    <span className="task-status-pill" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    {t.projectName && <> · {t.projectName}</>}
                    {t.due && <> · <b>Hạn:</b> {t.due}{t.dueLocked && <Lock size={10} style={{ verticalAlign: -1, marginLeft: 2 }} />}</>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card report-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><User size={16} /> Công việc của {name}</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && normalized.length === 0 && (
          <p className="invite-hint">Chưa có công việc nào được gán cho người này.</p>
        )}

        {!loading && normalized.length > 0 && (
          <div className="report-body">
            <Group icon={AlertTriangle} title="Trễ hạn" tone="danger" items={overdue} emptyText="Không có việc nào trễ hạn." />
            <Group icon={Clock3} title="Đang thực hiện" tone="warn" items={doing} emptyText="Không có việc nào đang thực hiện." />
            <Group icon={ListChecks} title="Chưa bắt đầu" items={todo} emptyText="Không có việc nào chưa bắt đầu." />
            <Group icon={CheckCircle2} title="Đã hoàn thành" tone="ok" items={done} emptyText="Chưa có việc nào hoàn thành." />
          </div>
        )}
      </div>
    </div>
  );
}
