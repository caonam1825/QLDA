import { useState } from "react";
import { Users, X, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";

export default function MembersPanel({ project, isOwner, onClose, onChanged }) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.addMember(project.id, phone.trim(), role);
      setPhone("");
      onChanged();
    } catch (err) {
      setError(err.message || "Không thể thêm thành viên");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId) {
    try {
      await api.removeMember(project.id, userId);
      onChanged();
    } catch (err) {
      setError(err.message || "Không thể xoá thành viên");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Users size={16} /> Thành viên dự án</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <div className="members-list">
          {project.members.map(m => (
            <div key={m.id} className="member-row">
              <div className="member-info">
                <span className="member-name">{m.name}</span>
                <span className="member-email">{m.phone}{m.email ? ` · ${m.email}` : ""}</span>
              </div>
              <span className={`member-role member-role-${m.role}`}>
                {m.role === "owner" ? "Chủ dự án" : m.role === "viewer" ? "Chỉ xem" : "Chỉnh sửa"}
              </span>
              {isOwner && m.role !== "owner" && (
                <ConfirmButton icon={Trash2} title="Xoá khỏi dự án" confirmLabel="Xoá?" danger onConfirm={() => handleRemove(m.id)} />
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <form className="invite-form" onSubmit={handleInvite}>
            <div className="invite-form-row">
              <input
                type="tel" placeholder="Số điện thoại người đã có tài khoản…" required
                value={phone} onChange={e => setPhone(e.target.value)}
              />
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="editor">Chỉnh sửa</option>
                <option value="viewer">Chỉ xem</option>
              </select>
              <button type="submit" disabled={busy}><Plus size={14} /> Thêm</button>
            </div>
            <p className="invite-hint">Người được mời cần đã đăng ký tài khoản trên hệ thống này bằng đúng số điện thoại trên.</p>
            {error && <div className="auth-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
