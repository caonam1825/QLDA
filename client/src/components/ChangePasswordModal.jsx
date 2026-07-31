import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { api } from "../api";

export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu mới không khớp");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      setError(err.message || "Không đổi được mật khẩu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><KeyRound size={16} /> Đổi mật khẩu đăng nhập</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        {done ? (
          <>
            <p className="invite-hint">Đã đổi mật khẩu thành công. Lần đăng nhập sau bạn dùng mật khẩu mới.</p>
            <div className="staff-form-actions">
              <button type="button" onClick={onClose}>Đóng</button>
            </div>
          </>
        ) : (
          <form className="staff-form" onSubmit={handleSubmit}>
            <label className="field field-full">
              <span className="field-label">Mật khẩu hiện tại</span>
              <input
                type="password" required autoFocus
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="field field-full">
              <span className="field-label">Mật khẩu mới (tối thiểu 6 ký tự)</span>
              <input
                type="password" required minLength={6}
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
              />
            </label>
            <label className="field field-full">
              <span className="field-label">Nhập lại mật khẩu mới</span>
              <input
                type="password" required minLength={6}
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              />
            </label>

            {error && <div className="auth-error">{error}</div>}

            <div className="staff-form-actions">
              <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Đổi mật khẩu"}</button>
              <button type="button" className="staff-cancel-edit" onClick={onClose}>Huỷ</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
