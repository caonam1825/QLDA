import { useState, useEffect } from "react";
import { ShieldCheck, X, KeyRound } from "lucide-react";
import { api } from "../api";

export default function AdminPanel({ currentUserId, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetFor, setResetFor] = useState(null); // user object
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.adminListUsers()
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggle(u) {
    try {
      await api.adminSetSuperAdmin(u.id, !u.isSuperAdmin);
      load();
    } catch (e) {
      setError(e.message || "Không đổi được quyền");
    }
  }

  function openReset(u) {
    setResetFor(u);
    setNewPassword("");
    setResetDone(false);
    setError("");
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Mật khẩu mới cần tối thiểu 6 ký tự"); return; }
    setBusy(true);
    try {
      await api.adminResetPassword(resetFor.id, newPassword);
      setResetDone(true);
    } catch (err) {
      setError(err.message || "Không đặt lại được mật khẩu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><ShieldCheck size={16} /> Quản trị hệ thống</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Quản trị hệ thống có toàn quyền trên MỌI dự án, kể cả khoá/mở khoá hạn hoàn thành, bất kể được thêm
          làm thành viên hay chưa. Chỉ cấp quyền này cho người thực sự cần thiết.
        </p>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && !resetFor && <div className="auth-error">{error}</div>}

        {!loading && !resetFor && (
          <div className="members-list">
            {users.map(u => (
              <div key={u.id} className="member-row">
                <div className="member-info">
                  <span className="member-name">{u.name}</span>
                  <span className="member-email">{u.phone}{u.email ? ` · ${u.email}` : ""}</span>
                </div>
                {u.isSuperAdmin ? (
                  <span className="zalo-status zalo-status-on"><ShieldCheck size={12} /> Quản trị hệ thống</span>
                ) : (
                  <span className="zalo-status zalo-status-off">Người dùng thường</span>
                )}
                <button className="icon-btn" title="Đặt lại mật khẩu (khi họ quên)" onClick={() => openReset(u)} type="button">
                  <KeyRound size={13} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => toggle(u)}
                  disabled={u.id === currentUserId && u.isSuperAdmin}
                  title={u.id === currentUserId && u.isSuperAdmin ? "Không thể tự thu hồi quyền của chính mình" : (u.isSuperAdmin ? "Thu hồi quyền" : "Cấp quyền Quản trị hệ thống")}
                  type="button"
                >
                  {u.isSuperAdmin ? "Thu hồi" : "Cấp quyền"}
                </button>
              </div>
            ))}
          </div>
        )}

        {resetFor && (
          <div>
            <h4 className="report-section-title">Đặt lại mật khẩu cho {resetFor.name}</h4>
            {resetDone ? (
              <>
                <p className="invite-hint">Đã đặt lại mật khẩu. Báo mật khẩu mới này cho {resetFor.name} để họ đăng nhập lại.</p>
                <div className="staff-form-actions">
                  <button type="button" onClick={() => setResetFor(null)}>Xong</button>
                </div>
              </>
            ) : (
              <form className="staff-form" onSubmit={handleReset}>
                <label className="field field-full">
                  <span className="field-label">Mật khẩu mới (tối thiểu 6 ký tự)</span>
                  <input type="text" required minLength={6} autoFocus value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </label>
                {error && <div className="auth-error">{error}</div>}
                <div className="staff-form-actions">
                  <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Đặt lại mật khẩu"}</button>
                  <button type="button" className="staff-cancel-edit" onClick={() => setResetFor(null)}>Huỷ</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
