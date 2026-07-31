import { useState } from "react";
import { UserCircle2, X, KeyRound, MessageCircle, Link2Off, ExternalLink } from "lucide-react";
import { api } from "../api";

export default function UpdateProfileModal({ user, onUpdated, onOpenPassword, onClose }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [position, setPosition] = useState(user.position || "");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zaloCode, setZaloCode] = useState("");
  const [zaloLinked, setZaloLinked] = useState(user.zaloLinked);
  const [zaloError, setZaloError] = useState("");
  const [zaloBusy, setZaloBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Vui lòng nhập họ tên"); return; }
    setError("");
    setBusy(true);
    try {
      const { user: updated } = await api.updateMe({ name: name.trim(), email, position });
      onUpdated(updated);
      setDone(true);
    } catch (err) {
      setError(err.message || "Không cập nhật được");
    } finally {
      setBusy(false);
    }
  }

  async function handleGetZaloCode() {
    setZaloBusy(true);
    setZaloError("");
    try {
      const { code } = await api.getMyZaloCode();
      setZaloCode(code);
    } catch (err) {
      setZaloError(err.message || "Không lấy được mã liên kết Zalo");
    } finally {
      setZaloBusy(false);
    }
  }

  async function handleUnlinkZalo() {
    setZaloBusy(true);
    setZaloError("");
    try {
      await api.unlinkMyZalo();
      setZaloLinked(false);
      setZaloCode("");
    } catch (err) {
      setZaloError(err.message || "Không huỷ được liên kết");
    } finally {
      setZaloBusy(false);
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
            <span className="field-label">Chức vụ</span>
            <input type="text" placeholder="VD: Trưởng ban dự án" value={position} onChange={e => setPosition(e.target.value)} />
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

        <div className="staff-login-box" style={{ marginTop: 10 }}>
          <div className="bulk-assign-title" style={{ marginBottom: 6 }}>
            <MessageCircle size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Kết nối Zalo (nhận nhắc việc)
          </div>

          {zaloError && <div className="auth-error">{zaloError}</div>}

          {zaloLinked ? (
            <>
              <p className="invite-hint">✓ Đã liên kết Zalo — bạn sẽ nhận tin nhắc khi công việc trễ hạn/sắp đến hạn.</p>
              <button type="button" className="profile-change-password-btn" disabled={zaloBusy} onClick={handleUnlinkZalo}>
                <Link2Off size={13} /> Huỷ liên kết Zalo
              </button>
            </>
          ) : zaloCode ? (
            <p className="invite-hint">
              Mở Zalo, tìm Official Account của công ty và nhắn đúng mã: <code className="zalo-code">{zaloCode}</code> — hệ
              thống sẽ tự liên kết trong ít phút.
            </p>
          ) : (
            <>
              <p className="invite-hint">Chưa liên kết Zalo. Bấm nút dưới để lấy mã liên kết ngay.</p>
              <button type="button" className="profile-change-password-btn" disabled={zaloBusy} onClick={handleGetZaloCode}>
                <MessageCircle size={13} /> {zaloBusy ? "Đang lấy mã…" : "Kết nối Zalo ngay"}
              </button>
            </>
          )}

          <p className="invite-hint" style={{ marginTop: 8 }}>
            Công ty chưa có Zalo Official Account? Tạo miễn phí tại{" "}
            <a href="https://oa.zalo.me" target="_blank" rel="noreferrer">oa.zalo.me <ExternalLink size={10} style={{ verticalAlign: -1 }} /></a>{" "}
            — nhờ quản trị hệ thống cấu hình thêm để tính năng nhắc việc hoạt động (xem README mục 9).
          </p>
        </div>

        <button className="profile-change-password-btn" onClick={onOpenPassword} type="button">
          <KeyRound size={13} /> Đổi mật khẩu đăng nhập
        </button>
      </div>
    </div>
  );
}
