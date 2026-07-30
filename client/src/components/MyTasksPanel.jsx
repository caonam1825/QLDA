import { useState, useEffect } from "react";
import { ListChecks, X, AlertTriangle, Clock3, CheckCircle2 } from "lucide-react";
import { api } from "../api";

function Section({ icon: Icon, title, tone, items, emptyText }) {
  return (
    <section className="report-section">
      <h4 className={`report-section-title ${tone ? `report-title-${tone}` : ""}`}><Icon size={14} /> {title} ({items.length})</h4>
      {items.length === 0 ? (
        <p className="invite-hint">{emptyText}</p>
      ) : (
        <ul className="report-list">
          {items.map(t => (
            <li key={t.id} className={`report-item ${tone ? `report-item-${tone}` : ""}`}>
              <span className="report-item-title">{t.title}</span>
              <span className="report-item-meta">
                {t.projectName} {t.due && <>· <b>Hạn:</b> {t.due}</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MyTasksPanel({ onClose }) {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.getMyTasks()
      .then(d => { if (!cancelled) setTasks(d.tasks); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const overdue = (tasks || []).filter(t => t.overdue);
  const doing = (tasks || []).filter(t => t.status === "doing" && !t.overdue);
  const done = (tasks || []).filter(t => t.status === "done");
  const todo = (tasks || []).filter(t => t.status === "todo" && !t.overdue);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card report-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><ListChecks size={16} /> Việc của tôi (tất cả dự án)</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && !error && tasks && tasks.length === 0 && (
          <p className="invite-hint">
            Bạn chưa được liên kết với hồ sơ nhân viên nào (hoặc chưa được gán việc). Liên hệ quản trị dự án để
            được cấp/liên kết tài khoản với đúng hồ sơ nhân viên của bạn trong mục "Nhân viên".
          </p>
        )}

        {!loading && tasks && tasks.length > 0 && (
          <div className="report-body">
            <Section icon={AlertTriangle} title="Trễ hạn" tone="danger" items={overdue} emptyText="Bạn không có việc nào trễ hạn — tốt lắm!" />
            <Section icon={Clock3} title="Đang thực hiện" tone="warn" items={doing} emptyText="Không có việc nào đang thực hiện." />
            <Section icon={ListChecks} title="Chưa bắt đầu" items={todo} emptyText="Không có việc nào chưa bắt đầu." />
            <Section icon={CheckCircle2} title="Đã hoàn thành" tone="ok" items={done} emptyText="Chưa có việc nào hoàn thành." />
          </div>
        )}
      </div>
    </div>
  );
}
