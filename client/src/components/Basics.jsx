import { useState, useEffect } from "react";

export function SealBadge({ percent }) {
  return (
    <div className="seal-badge" aria-label={`Tiến độ tổng thể ${percent}%`}>
      <svg viewBox="0 0 120 120" className="seal-ring">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F1E8" strokeOpacity="0.25" strokeWidth="3" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke="#F3F1E8" strokeWidth="3"
          strokeDasharray={`${(percent / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
          strokeLinecap="round" transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="seal-inner">
        <span className="seal-percent">{percent}%</span>
        <span className="seal-caption">HOÀN THÀNH</span>
      </div>
    </div>
  );
}

export function MiniBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mini-bar-wrap">
      <div className="mini-bar-track">
        <div className="mini-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mini-bar-text">{done}/{total} · {pct}%</span>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color: tint }}><Icon size={18} /></div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function IconBtn({ icon: Icon, onClick, title, danger, disabled }) {
  return (
    <button
      className={`icon-btn ${danger ? "icon-btn-danger" : ""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      type="button"
    >
      <Icon size={13} />
    </button>
  );
}

/* Two-step inline confirm, avoids native confirm() dialogs */
export function ConfirmButton({ icon: Icon, title, confirmLabel, onConfirm, danger }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <button
        className="icon-btn icon-btn-danger icon-btn-confirm"
        onClick={() => { setArmed(false); onConfirm(); }}
        type="button"
      >
        <Icon size={12} /> {confirmLabel || "Xác nhận"}
      </button>
    );
  }
  return (
    <button
      className={`icon-btn ${danger ? "icon-btn-danger" : ""}`}
      onClick={() => setArmed(true)}
      title={title}
      type="button"
    >
      <Icon size={13} />
    </button>
  );
}
