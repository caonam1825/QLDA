import { useState } from "react";
import { UserCircle2, X, KeyRound } from "lucide-react";
import { api } from "../api";

export default function UpdateProfileModal({ user, onUpdated, onOpenPassword, onClose }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Vui lòng nhập họ tên"); return; }
    setError("");
    setBusy(true);
    try {
      const { user: updated } = await api.updateMe({ name: name.trim(), email });
      onUpdated(updated);
      setDone(true);
    } catch (err) {
      setError(err.message || "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><UserCircle2 size={16} /> Thông tin cá nhân</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <div className="profile-avatar-row">
          <span className="avatar-circle avatar-circle-lg">{(user.name || "?").trim().charAt(0).toUpperCase()}</span>
          <span className="member-email">Số điện thoại đăng nhập: <b>{user.phone}</b> (không đổi được ở đây)</span>
        </div>

        {done && <p className="invite-hint">Đã cập nhật thông tin cá nhân.</p>}

        <form className="staff-form" onSubmit={handleSubmit}>
          <label className="field field-full">
            <span className="field-label">Họ và tên</span>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="field field-full">
            <span className="field-label">Email (không bắt buộc)</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <div className="staff-form-actions">
            <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
            <button type="button" className="staff-cancel-edit" onClick={onClose}>Đóng</button>
          </div>
        </form>

        <button className="profile-change-password-btn" onClick={onOpenPassword} type="button">
          <KeyRound size={13} /> Đổi mật khẩu đăng nhập
        </button>
      </div>
    </div>
  );
}
