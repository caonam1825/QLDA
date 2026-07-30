import { useState } from "react";
import { Users2, X, Plus, Trash2, Pencil, MessageCircle, Link2Off } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";

const emptyForm = { name: "", position: "", department: "", email: "", phone: "" };

export default function StaffPanel({ project, readOnly, onClose, onChanged }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zaloCodeFor, setZaloCodeFor] = useState(null); // { staffId, code }

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
        await api.addStaff(project.id, form);
      }
      setForm(emptyForm);
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

        <div className="members-list">
          {project.staff.length === 0 && (
            <p className="invite-hint">Chưa có nhân viên nào. Thêm để có thể gán công việc và xem báo cáo theo từng người.</p>
          )}
          {project.staff.map(s => (
            <div key={s.id} className="staff-block">
              <div className="member-row staff-row">
                <div className="member-info">
                  <span className="member-name">{s.name}</span>
                  <span className="member-email">
                    {[s.position, s.department].filter(Boolean).join(" · ") || "—"}
                    {s.email ? ` · ${s.email}` : ""}
                  </span>
                </div>
                <span className={`zalo-status ${s.zaloLinked ? "zalo-status-on" : "zalo-status-off"}`}>
                  <MessageCircle size={12} /> {s.zaloLinked ? "Đã liên kết Zalo" : "Chưa liên kết Zalo"}
                </span>
                {!readOnly && (
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

        {!readOnly && (
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
            <div className="staff-form-actions">
              <button type="submit" disabled={busy}><Plus size={14} /> {editingId ? "Lưu thay đổi" : "Thêm nhân viên"}</button>
              {editingId && (
                <button type="button" className="staff-cancel-edit" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Huỷ sửa
                </button>
              )}
            </div>
            {error && <div className="auth-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
