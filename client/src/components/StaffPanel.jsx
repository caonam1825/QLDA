import { useState } from "react";
import { Users2, X, Plus, Trash2, Pencil, MessageCircle, Link2Off, KeyRound } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";
import { ROLE_OPTIONS } from "../constants";
import PersonTasksModal from "./PersonTasksModal";

const emptyForm = { name: "", position: "", department: "", email: "", phone: "" };
const emptyLogin = { mode: "none", loginPhone: "", loginPassword: "", role: "viewer" }; // mode: 'none' | 'grant' | 'link'

export default function StaffPanel({ project, canManage, onClose, onChanged }) {
  const [form, setForm] = useState(emptyForm);
  const [login, setLogin] = useState(emptyLogin);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zaloCodeFor, setZaloCodeFor] = useState(null); // { staffId, code }
  const [tasksFor, setTasksFor] = useState(null); // staff object, để xem việc đang phụ trách

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
      onChanged();
    } catch (err) {
      setError(err.message || "Không huỷ được liên kết Zalo");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vui lòng nhập tên nhân viên"); return; }
    setError("");
    setBusy(true);
    try {
      if (editingId) {
        await api.updateStaff(editingId, form);
      } else {
        const payload = { ...form };
        if (login.mode === "grant") {
          payload.grantLogin = true;
          payload.loginPhone = login.loginPhone || form.phone;
          payload.loginPassword = login.loginPassword;
          payload.role = login.role;
        } else if (login.mode === "link") {
          payload.linkExistingPhone = login.loginPhone || form.phone;
          payload.role = login.role;
        }
        await api.addStaff(project.id, payload);
      }
      setForm(emptyForm);
      setLogin(emptyLogin);
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err.message || "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setForm({ name: s.name, position: s.position, department: s.department, email: s.email, phone: s.phone });
    setLogin(emptyLogin);
  }

  async function handleDelete(id) {
    try {
      await api.deleteStaff(id);
      if (editingId === id) { setEditingId(null); setForm(emptyForm); }
      onChanged();
    } catch (err) {
      setError(err.message || "Không xoá được");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Users2 size={16} /> Danh sách nhân viên</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Thêm nhân viên vào danh bạ để gán việc — <b>không cần họ tự đăng ký</b>. Nếu nhân viên đã có tài khoản
          (tự đăng ký hoặc được cấp ở dự án khác), chọn "✓ Đã có tài khoản" và chỉ cần nhập đúng SĐT để liên kết —
          không cần đặt lại mật khẩu. Nếu họ chưa có tài khoản, chọn "Cấp tài khoản mới" để admin tự đặt SĐT + mật khẩu.
        </p>

        <div className="members-list">
          {project.staff.length === 0 && (
            <p className="invite-hint">Chưa có nhân viên nào. Thêm để có thể gán công việc và xem báo cáo theo từng người.</p>
          )}
          {project.staff.map(s => (
            <div key={s.id} className="staff-block">
              <div className="member-row staff-row">
                <div className="member-info member-info-with-avatar">
                  <span className="avatar-circle avatar-clickable" onClick={() => setTasksFor(s)} title={`Xem việc của ${s.name}`}>
                    {(s.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <span className="member-name member-name-clickable" onClick={() => setTasksFor(s)}>{s.name}</span>
                    <span className="member-email">
                      {[s.position, s.department].filter(Boolean).join(" · ") || "—"}
                      {s.email ? ` · ${s.email}` : ""}
                    </span>
                  </div>
                </div>
                {s.hasLogin && (
                  <span className="zalo-status zalo-status-on"><KeyRound size={12} /> Có tài khoản đăng nhập</span>
                )}
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
                    <button className="icon-btn" title="Sửa" onClick={() => startEdit(s)} type="button"><Pencil size={13} /></button>
                    <ConfirmButton icon={Trash2} title="Xoá nhân viên" confirmLabel="Xoá?" danger onConfirm={() => handleDelete(s.id)} />
                  </>
                )}
              </div>
              {zaloCodeFor?.staffId === s.id && (
                <div className="zalo-code-hint">
                  Nhờ <b>{s.name}</b> mở Zalo, tìm Official Account của công ty và nhắn đúng mã:
                  {" "}<code className="zalo-code">{zaloCodeFor.code}</code>
                  {" "}— hệ thống sẽ tự liên kết trong ít phút. (Cần đã cấu hình Zalo OA — xem README.)
                </div>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <form className="staff-form" onSubmit={handleSubmit}>
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

            {!editingId && (
              <div className="staff-login-box">
                <div className="staff-login-mode-row">
                  <label className="staff-login-toggle">
                    <input type="radio" name="loginMode" checked={login.mode === "none"}
                      onChange={() => setLogin(l => ({ ...l, mode: "none" }))} />
                    <span>Không cấp đăng nhập (chỉ thêm vào danh bạ)</span>
                  </label>
                  <label className="staff-login-toggle">
                    <input type="radio" name="loginMode" checked={login.mode === "link"}
                      onChange={() => setLogin(l => ({ ...l, mode: "link" }))} />
                    <span>✓ Nhân viên đã có tài khoản — chỉ liên kết bằng SĐT</span>
                  </label>
                  <label className="staff-login-toggle">
                    <input type="radio" name="loginMode" checked={login.mode === "grant"}
                      onChange={() => setLogin(l => ({ ...l, mode: "grant" }))} />
                    <span>Cấp tài khoản mới (đặt SĐT + mật khẩu)</span>
                  </label>
                </div>

                {login.mode === "link" && (
                  <div className="staff-form-grid">
                    <input type="tel" placeholder="SĐT đã đăng ký (mặc định lấy SĐT ở trên) *" required
                      value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                    <select value={login.role} onChange={e => setLogin(l => ({ ...l, role: e.target.value }))}>
                      {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                )}

                {login.mode === "grant" && (
                  <div className="staff-form-grid">
                    <input type="tel" placeholder="SĐT đăng nhập (mặc định lấy SĐT ở trên)"
                      value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                    <input type="text" placeholder="Mật khẩu (tối thiểu 6 ký tự) *" required
                      value={login.loginPassword} onChange={e => setLogin(l => ({ ...l, loginPassword: e.target.value }))} />
                    <select value={login.role} onChange={e => setLogin(l => ({ ...l, role: e.target.value }))}>
                      {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="staff-form-actions">
              <button type="submit" disabled={busy}><Plus size={14} /> {editingId ? "Lưu thay đổi" : "Thêm nhân viên"}</button>
              {editingId && (
                <button type="button" className="staff-cancel-edit" onClick={() => { setEditingId(null); setForm(emptyForm); setLogin(emptyLogin); }}>
                  Huỷ sửa
                </button>
              )}
            </div>
            {error && <div className="auth-error">{error}</div>}
          </form>
        )}
      </div>

      {tasksFor && (
        <PersonTasksModal
          name={tasksFor.name}
          staticTasks={(project.tasks || []).filter(t => t.progress.assigneeStaffId === tasksFor.id)}
          onClose={() => setTasksFor(null)}
        />
      )}
    </div>
  );
}
