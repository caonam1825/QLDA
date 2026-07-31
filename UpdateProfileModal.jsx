import { useState, useEffect, useRef } from "react";

// Gõ phím mượt mà: cập nhật giao diện ngay lập tức (state cục bộ), nhưng chỉ
// gọi API lưu (onCommit) sau khi người dùng ngừng gõ ~500ms, hoặc khi rời
// khỏi ô nhập (blur) — thay vì gọi API + tải lại toàn bộ dự án trên MỖI ký
// tự gõ, vốn là nguyên nhân chính gây giật/lag khi sửa nội dung công việc.
function useDebouncedField(value, onCommit, delay = 500) {
  const [local, setLocal] = useState(value ?? "");
  const timerRef = useRef(null);
  const lastCommittedRef = useRef(value ?? "");

  useEffect(() => {
    // Chỉ đồng bộ lại từ props khi giá trị ngoài thay đổi mà KHÔNG phải do
    // chính lần commit gần nhất của mình gây ra (tránh giật con trỏ khi gõ).
    if (value !== lastCommittedRef.current) {
      setLocal(value ?? "");
      lastCommittedRef.current = value ?? "";
    }
  }, [value]);

  function commit(v) {
    clearTimeout(timerRef.current);
    if (v === lastCommittedRef.current) return;
    lastCommittedRef.current = v;
    onCommit(v);
  }

  function handleChange(e) {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(v), delay);
  }

  function handleBlur() {
    commit(local);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { local, handleChange, handleBlur };
}

export function DebouncedInput({ value, onCommit, delay, ...rest }) {
  const { local, handleChange, handleBlur } = useDebouncedField(value, onCommit, delay);
  return <input {...rest} value={local} onChange={handleChange} onBlur={handleBlur} />;
}

export function DebouncedTextarea({ value, onCommit, delay, ...rest }) {
  const { local, handleChange, handleBlur } = useDebouncedField(value, onCommit, delay);
  return <textarea {...rest} value={local} onChange={handleChange} onBlur={handleBlur} />;
}

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
export function ConfirmButton({ icon: Icon, title, confirmLabel, onConfirm, danger, disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  if (disabled) {
    return (
      <button className="icon-btn" title={title} type="button" disabled>
        <Icon size={13} />
      </button>
    );
  }

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
