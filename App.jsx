import { useState, useEffect, useMemo } from "react";
import { Users2, X, Plus, Trash2, MessageCircle, Link2Off, KeyRound, Search } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";
import PersonTasksModal from "./PersonTasksModal";

const emptyForm = { name: "", position: "", department: "", email: "", phone: "" };
const emptyLogin = { mode: "none", loginPhone: "", loginPassword: "", role: "viewer" }; // mode: 'none' | 'grant' | 'link'

// Danh bạ nhân viên TOÀN CÔNG TY, quản lý ngay từ Trang chủ — thêm 1 lần ở
// đây, rồi vào từng dự án chỉ cần tích chọn (mục "Nhân viên" trong dự án),
// không cần nhập lại thông tin/số điện thoại.
export default function CompanyStaffPanel({ canManage, onClose }) {
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [login, setLogin] = useState(emptyLogin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zaloCodeFor, setZaloCodeFor] = useState(null);
  const [tasksFor, setTasksFor] = useState(null);

  function load() {
    setLoading(true);
    api.getStaffDirectory()
      .then(d => setDirectory(d.staff))
      .catch(e => setError(e.message || "Không tải được danh bạ nhân viên"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(s => `${s.name} ${s.position} ${s.department} ${s.phone}`.toLowerCase().includes(q));
  }, [directory, query]);

  async function handleSubmitNew(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vui lòng nhập tên nhân viên"); return; }
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (login.mode === "grant") {
        payload.grantLogin = true;
        payload.loginPhone = login.loginPhone || form.phone;
        payload.loginPassword = login.loginPassword;
      } else if (login.mode === "link") {
        payload.linkExistingPhone = login.loginPhone || form.phone;
      }
      await api.createCompanyStaff(payload);
      setForm(emptyForm);
      setLogin(emptyLogin);
      setShowNewForm(false);
      load();
    } catch (err) {
      setError(err.message || "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  async function handleGetZaloCode(staffId) {
    try {
      const { code } = await api.getZaloCode(staffId);
      setZaloCodeFor({ staffId, code });
    } catch (err) {
      setError(err.message || "Không lấy được mã liên kết Zalo");
    }
  }

  async function handleUnlinkZalo(staffId) {
    try {
      await api.unlinkZalo(staffId);
      if (zaloCodeFor?.staffId === staffId) setZaloCodeFor(null);
      load();
    } catch (err) {
      setError(err.message || "Không huỷ được liên kết Zalo");
    }
  }

  async function handleDeletePermanently(staffId) {
    try {
      await api.deleteStaffPermanently(staffId);
      if (tasksFor?.id === staffId) setTasksFor(null);
      load();
    } catch (err) {
      setError(err.message || "Không xoá được");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card staff-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Users2 size={16} /> Nhân viên — Ban quản lý dự án</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Đây là danh bạ nhân viên dùng CHUNG cho toàn công ty. Thêm hồ sơ 1 lần ở đây — sau đó vào từng dự án
          chỉ cần <b>tích chọn</b> ai thuộc dự án đó (mục "Nhân viên" trong dự án), không cần nhập lại thông tin.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="staff-search-row">
          <Search size={14} />
          <input type="text" placeholder="Tìm theo tên, chức vụ, phòng ban, SĐT…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <p className="invite-hint">Đang tải danh bạ…</p>
        ) : (
          <div className="staff-directory-list">
            {filtered.length === 0 && <p className="invite-hint">Chưa có nhân viên nào phù hợp — thêm mới bên dưới.</p>}
            {filtered.map(s => (
              <div key={s.id} className="staff-directory-row">
                <span className="avatar-circle avatar-clickable" onClick={() => setTasksFor(s)} title={`Xem việc của ${s.name}`}>
                  {(s.name || "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="member-info">
                  <span className="member-name member-name-clickable" onClick={() => setTasksFor(s)}>{s.name}</span>
                  <span className="member-email">
                    {[s.position, s.department].filter(Boolean).join(" · ") || "—"}
                    {s.phone ? ` · ${s.phone}` : ""}
                    {" · thuộc "}{s.projectIds.length} dự án
                  </span>
                </div>
                {s.hasLogin && <span className="zalo-status zalo-status-on"><KeyRound size={12} /> Có tài khoản</span>}
                <span className={`zalo-status ${s.zaloLinked ? "zalo-status-on" : "zalo-status-off"}`}>
                  <MessageCircle size={12} /> {s.zaloLinked ? "Đã liên kết Zalo" : "Chưa liên kết Zalo"}
                </span>
                {canManage && (
                  <>
                    {s.zaloLinked ? (
                      <button className="icon-btn" title="Huỷ liên kết Zalo" onClick={() => handleUnlinkZalo(s.id)} type="button"><Link2Off size={13} /></button>
                    ) : (
                      <button className="icon-btn" title="Lấy mã liên kết Zalo" onClick={() => handleGetZaloCode(s.id)} type="button"><MessageCircle size={13} /></button>
                    )}
                    <ConfirmButton icon={Trash2} title="Xoá vĩnh viễn khỏi toàn hệ thống" confirmLabel="Xoá hẳn?" danger onConfirm={() => handleDeletePermanently(s.id)} />
                  </>
                )}
                {zaloCodeFor?.staffId === s.id && (
                  <div className="zalo-code-hint zalo-code-hint-inline">
                    Nhờ <b>{s.name}</b> nhắn mã <code className="zalo-code">{zaloCodeFor.code}</code> cho Zalo OA công ty để liên kết.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="staff-new-section">
            {!showNewForm ? (
              <button className="add-task-btn" onClick={() => setShowNewForm(true)} type="button">
                <Plus size={13} /> Thêm nhân viên mới vào danh bạ
              </button>
            ) : (
              <form className="staff-form" onSubmit={handleSubmitNew}>
                <div className="staff-form-grid">
                  <input type="text" placeholder="Họ và tên *" required
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <input type="text" placeholder="Chức vụ"
                    value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                  <input type="text" placeholder="Phòng / đơn vị"
                    value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                  <input type="email" placeholder="Email"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <input type="text" placeholder="Số điện thoại"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>

                <div className="staff-login-box">
                  <div className="staff-login-mode-row">
                    <label className="staff-login-toggle">
                      <input type="radio" name="companyLoginMode" checked={login.mode === "none"}
                        onChange={() => setLogin(l => ({ ...l, mode: "none" }))} />
                      <span>Không cấp đăng nhập (chỉ thêm vào danh bạ)</span>
                    </label>
                    <label className="staff-login-toggle">
                      <input type="radio" name="companyLoginMode" checked={login.mode === "link"}
                        onChange={() => setLogin(l => ({ ...l, mode: "link" }))} />
                      <span>✓ Đã có tài khoản — chỉ liên kết bằng SĐT</span>
                    </label>
                    <label className="staff-login-toggle">
                      <input type="radio" name="companyLoginMode" checked={login.mode === "grant"}
                        onChange={() => setLogin(l => ({ ...l, mode: "grant" }))} />
                      <span>Cấp tài khoản mới (đặt SĐT + mật khẩu)</span>
                    </label>
                  </div>

                  {login.mode === "link" && (
                    <div className="staff-form-grid">
                      <input type="tel" placeholder="SĐT đã đăng ký (mặc định lấy SĐT ở trên) *" required
                        value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                    </div>
                  )}
                  {login.mode === "grant" && (
                    <div className="staff-form-grid">
                      <input type="tel" placeholder="SĐT đăng nhập (mặc định lấy SĐT ở trên)"
                        value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                      <input type="text" placeholder="Mật khẩu (tối thiểu 6 ký tự) *" required
                        value={login.loginPassword} onChange={e => setLogin(l => ({ ...l, loginPassword: e.target.value }))} />
                    </div>
                  )}
                  <p className="invite-hint">
                    Quyền cụ thể trong từng dự án (chỉ xem / thêm quy trình / chỉnh sửa toàn quyền…) chọn sau, ngay
                    khi tích người này vào từng dự án.
                  </p>
                </div>

                <div className="staff-form-actions">
                  <button type="submit" disabled={busy}><Plus size={14} /> Thêm vào danh bạ</button>
                  <button type="button" className="staff-cancel-edit" onClick={() => { setShowNewForm(false); setForm(emptyForm); setLogin(emptyLogin); }}>
                    Huỷ
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {tasksFor && (
        <PersonTasksModal
          name={tasksFor.name}
          personKey={tasksFor.phone ? `phone:${tasksFor.phone}` : `name:${tasksFor.name}|${tasksFor.department}`}
          onClose={() => setTasksFor(null)}
        />
      )}
    </div>
  );
}
